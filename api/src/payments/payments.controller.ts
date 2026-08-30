import { Controller, Post, Body, Request, UseGuards, Headers, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { SkipThrottle } from '@nestjs/throttler';


@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-intent')
  createIntent(@Request() req, @Body() createPaymentIntentDto:CreatePaymentIntentDto){
    return this.paymentsService.createIntent(req.user.id, createPaymentIntentDto.orderId);
  }

  @SkipThrottle()
  @Post('webhook')
  handleWebhook(@Req() req: RawBodyRequest<ExpressRequest>, @Headers('stripe-signature') signature:string){
    return this.paymentsService.handleWebhookEvent(signature, req.rawBody!);
  }
}
