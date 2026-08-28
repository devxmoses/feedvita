import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import {  UpdateCartItemDto } from './dto/update-cart-item.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartsService {
  constructor(private readonly prisma:PrismaService){}
  
  async getCart(userId:string){
    const cart = await this.prisma.cart.findUnique({
      where:{userId},
      include:{items:{include:{product:true}}},
    });
    return cart ?? {userId,items:[]};
  }

  async addItem(userId:string,addCartItemDto:AddCartItemDto){
    const product = await this.prisma.product.findUnique({where:{id:addCartItemDto.productId}});
    if(!product) throw new NotFoundException(`Product with ID ${addCartItemDto.productId} not found`);
    if(!product.isActive) throw new BadRequestException(`Product "${product.name}" is not available`);

    const cart = await this.prisma.cart.upsert({
      where:{userId},
      update:{},
      create:{userId},
    });

    return this.prisma.cartItem.upsert({
      where:{cartId_productId:{cartId:cart.id, productId:product.id}},
      update:{quantity:{increment: addCartItemDto.quantity}},
      create:{cartId:cart.id, productId:product.id, quantity:addCartItemDto.quantity},

    })
  }


  async updateItem(userId:string, productId:string,updateCartItemDto:UpdateCartItemDto){
    const cart = await this.prisma.cart.findUnique({where:{id:userId}});
    if(!cart) throw new NotFoundException(`Your cart is empty`);

    const item = await this.prisma.cartItem.findUnique({
      where:{cartId_productId:{cartId:cart.id, productId:productId}},
    });
    if(!item) throw new NotFoundException(`Product ${productId} is not in your cart`)
    
      return this.prisma.cartItem.update({
      where:{id:item.id},
      data:{quantity:updateCartItemDto.quantity},
    });
  }

  async removeItem(userId:string,productId:string){
    const cart = await this.prisma.cart.findUnique({where:{id:userId}});
    if(!cart) throw new NotFoundException(`Your cart is empty`);

    const item = await this.prisma.cartItem.findUnique({
      where:{cartId_productId:{cartId:cart.id, productId:productId}},
    });
    if(!item) throw new NotFoundException(`Product ${productId} is not in your cart`)
    
    return this.prisma.cartItem.delete({
      where:{id:item.id}
    })
  }

  async clearCart(userId:string){
    const cart = await this.prisma.cart.findUnique({where:{id:userId}});
    if(!cart) return;
    await this.prisma.cartItem.deleteMany({where:{cartId:cart.id}});
  }
}
