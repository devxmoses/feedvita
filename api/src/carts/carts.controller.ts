import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { CartsService } from './carts.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  getCart(@Request() req){
    return this.cartsService.getCart(req.user.id)
  }

  @Post('items')
  addItem(@Request() req, @Body() addCartItemDto:AddCartItemDto){
    return this.cartsService.addItem(req.user.id, addCartItemDto)
  }

  @Patch('items/:productId')
  updateItem(@Request() req, @Param('productId') productId:string,@Body() updateCartItemDto:UpdateCartItemDto){
    return this.cartsService.updateItem(req.user.id,productId, updateCartItemDto)
  }

  @Delete('items/:productId')
  removeItem(@Request() req, @Param('productId') productId:string){
    return this.cartsService.removeItem(req.user.id, productId);
  }

  @Delete()
  clearCart(@Request() req){
    return this.cartsService.clearCart(req.user.id)
  }



}
