import { Controller, Post, Body, Request, UseGuards, Headers, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { SkipThrottle } from '@nestjs/throttler';


@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a Stripe payment attempt for one of your pending orders' })
  @ApiResponse({ status: 201, description: 'Returns a clientSecret for the frontend to complete with Stripe.js' })
  @ApiResponse({ status: 403, description: 'This is not your order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order is no longer PENDING' })
  @UseGuards(JwtAuthGuard)
  @Post('create-intent')
  createIntent(@Request() req, @Body() createPaymentIntentDto:CreatePaymentIntentDto){
    return this.paymentsService.createIntent(req.user.id, createPaymentIntentDto.orderId);
  }

  @ApiExcludeEndpoint()
  @SkipThrottle()
  @Post('webhook')
  handleWebhook(@Req() req: RawBodyRequest<ExpressRequest>, @Headers('stripe-signature') signature:string){
    return this.paymentsService.handleWebhookEvent(signature, req.rawBody!);
  }
}
