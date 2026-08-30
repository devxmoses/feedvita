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

        const paymentIntent = await this.stripe.paymentIntents.create({
            amount: order.total,
            currency: 'usd',
            metadata: { orderId: order.id},
        });

        await this.prisma.payment.create({
            data:{
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
                    const payment = await tx.payment.update({
                        where:{stripePaymentIntentId:intent.id},
                        data:{status:'SUCCEEDED'}
                    });
                    await tx.order.update({
                        where:{id:payment.orderId},
                        data:{status:'PAID'},
                    })
                });
                break;
            }

            case 'payment_intent.payment_failed':{
                const intent = event.data.object as Stripe.PaymentIntent;
                await this.prisma.payment.update({
                    where:{ stripePaymentIntentId: intent.id},
                    data:{status:'FAILED'},
                });
                break;
            }
        }

        return { received: true};
    }
}
