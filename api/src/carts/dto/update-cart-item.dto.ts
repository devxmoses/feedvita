import { OmitType } from '@nestjs/swagger';
import { AddCartItemDto } from './add-cart-item.dto';

export class UpdateCartItemDto extends OmitType(
    AddCartItemDto,['productId'] as const
){}
