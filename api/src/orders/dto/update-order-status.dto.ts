import { IsEnum } from "class-validator";
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from "../../../generated/prisma/enums";

export class UpdateOrderStatusDto {
    @ApiProperty({ enum: OrderStatus, example: OrderStatus.SHIPPED, description: 'CANCELLED is rejected here - use PATCH /orders/:id/cancel so stock is restocked' })
    @IsEnum(OrderStatus)
    status!: OrderStatus
}
