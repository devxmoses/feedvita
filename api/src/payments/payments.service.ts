import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
    private readonly stripe:Stripe;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService
    ){
        this.stripe = new Stripe(this.configService.get<string>('STRIPE_SECRET_KEY')!);
    }

    async createIntent(userId:string, orderId:string){
        const order = await this.prisma.order.findUnique({where:{id:orderId}});
        if(!order) throw new NotFoundException(`Order with ID ${orderId} not found`);
        if(order.buyerId !== userId) throw new ForbiddenException('This is not your order');
        if(order.status !== 'PENDING'){
            throw new ConflictException(`Order is already ${order.status}`);
        }

        // Stripe replays the original response for a repeated idempotency key rather
        // than opening a second intent, so a buyer who reloads checkout gets the same
        // intent back instead of two live ones they could both pay. Keys live 24h.

        const paymentIntent = await this.stripe.paymentIntents.create(
            {
                amount: order.total,
                currency: 'usd',
                metadata: { orderId: order.id},
            },
            {idempotencyKey:`order-intent-${order.id}`},
        );
        // upsert, not create: on a replayed intent the row already exists, and if an
        // earlier attempt opened the intent but died before writing the row, this call
        // heals it. Either way we end up with exactly one row per intent.
        await this.prisma.payment.upsert({
            where:{ stripePaymentIntentId: paymentIntent.id},
            update:{},
            create:{
                orderId: order.id,
                stripePaymentIntentId: paymentIntent.id,
                amount:order.total,
                currency:'usd',
            }
        });

        return { clientSecret: paymentIntent.client_secret}
    }

    async handleWebhookEvent(signature:string, rawBody: Buffer){
        let event: Stripe.Event;
        try{
            event = this.stripe.webhooks.constructEvent(
                rawBody,
                signature,
                this.configService.get<string>('STRIPE_WEBHOOK_SECRET')!,
            )
        } catch(err){
            throw new BadRequestException(`Webhook signature verification failed : ${(err as Error).message}`);
        }

        switch(event.type){
            case 'payment_intent.succeeded':{
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.prisma.$transaction(async(tx)=>{
                    const payment = await tx.payment.findUnique({
                        where:{stripePaymentIntentId:intent.id},
                        include:{order:true},
                    });
                     // An intent we have no row for is nothing we can act on. Returning
                    // quietly acknowledges the event; throwing would make Stripe retry
                    // the same dead event with backoff for about three days.
                    if(!payment) return;

                    await tx.payment.update({
                        where:{id: payment.id},
                        data:{status:'SUCCEEDED'}
                    });


                    // Only a still-pending order may become PAID. If the buyer cancelled
                    // while the charge was in flight, cancel() has already restocked the
                    // items, so flipping to PAID here would sell stock we no longer hold.
                    // Record the payment and leave the order cancelled; the money has to
                    // be refunded out of band.
                    if(payment.order.status === 'PENDING'){
                        await tx.order.update({
                            where:{id:payment.orderId},
                            data:{status:'PAID'},
                        });
                    }
                });
                break;
            }

            case 'payment_intent.payment_failed':{
                const intent = event.data.object as Stripe.PaymentIntent;
                // updateMany matches zero rows without throwing, so an unknown
                // intent is acknowledged instead of triggering Stripe retries.
              
                await this.prisma.payment.updateMany({
                    where:{ stripePaymentIntentId: intent.id},
                    data:{status:'FAILED'},
                });
                break;
            }
        }

        return { received: true};
    }
}
