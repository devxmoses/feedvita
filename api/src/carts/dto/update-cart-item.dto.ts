import { OmitType } from '@nestjs/mapped-types';
import { AddCartItemDto } from './add-cart-item.dto';

export class UpdateCartItemDto extends OmitType(
    AddCartItemDto,['productId'] as const
){}
