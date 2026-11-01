import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CartsService } from './carts.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @ApiOperation({ summary: 'Get your cart with its items and their products' })
  @ApiResponse({ status: 200, description: 'Your cart (empty shape if you have never added anything)' })
  @Get()
  getCart(@Request() req){
    return this.cartsService.getCart(req.user.id)
  }

  @ApiOperation({ summary: 'Add a product to your cart (increments if already present)' })
  @ApiResponse({ status: 201, description: 'Cart item created or incremented' })
  @ApiResponse({ status: 400, description: 'Product is not available' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Post('items')
  addItem(@Request() req, @Body() addCartItemDto:AddCartItemDto){
    return this.cartsService.addItem(req.user.id, addCartItemDto)
  }

  @ApiOperation({ summary: 'Set the exact quantity of a product in your cart' })
  @ApiParam({ name: 'productId' })
  @ApiResponse({ status: 200, description: 'Cart item quantity updated' })
  @ApiResponse({ status: 404, description: 'That product is not in your cart' })
  @Patch('items/:productId')
  updateItem(@Request() req, @Param('productId') productId:string,@Body() updateCartItemDto:UpdateCartItemDto){
    return this.cartsService.updateItem(req.user.id,productId, updateCartItemDto)
  }

  @ApiOperation({ summary: 'Remove a product from your cart' })
  @ApiParam({ name: 'productId' })
  @ApiResponse({ status: 200, description: 'Cart item removed' })
  @ApiResponse({ status: 404, description: 'That product is not in your cart' })
  @Delete('items/:productId')
  removeItem(@Request() req, @Param('productId') productId:string){
    return this.cartsService.removeItem(req.user.id, productId);
  }

  @ApiOperation({ summary: 'Empty your cart' })
  @ApiResponse({ status: 200, description: 'Cart emptied' })
  @Delete()
  clearCart(@Request() req){
    return this.cartsService.clearCart(req.user.id)
  }



}
