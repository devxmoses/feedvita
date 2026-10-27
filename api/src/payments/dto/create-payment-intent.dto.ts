import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9i0j1', description: 'A PENDING order that belongs to you' })
  @IsString()
  orderId!: string;
}
