import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrdersService {
  constructor (private readonly prisma:PrismaService){}
  async create(buyerId:string) {

    return this.prisma.$transaction(async (tx)=>{
      const cart = await tx.cart.findUnique({
        where:{userId:buyerId},
        include:{items:{include:{product:true}}},
      })
      if(!cart || cart.items.length === 0) throw new BadRequestException(`Your cart is empty`)


      const itemsData = cart.items.map((cartItem)=>{
        const product = cartItem.product;
        if(!product.isActive){
          throw new BadRequestException(`Product ${product.name} is no longer available`);
        }
        return{
          productId:product.id,
          vendorId:product.vendorId,
          productName:product.name,
          quantity: cartItem.quantity,
          unitPrice: product.price,
        }
      });

      for (const item of itemsData){
        const result = await tx.product.updateMany({
          where:{id:item.productId, stock:{gte:item.quantity}},
          data:{stock:{decrement:item.quantity}}
        });
        if(result.count === 0){
          throw new ConflictException(`Not enough stock for "${item.productName}`)
        }
      }

      const total = itemsData.reduce((sum,i)=>sum + i.unitPrice * i.quantity,0);
      
      const order = await tx.order.create({
        data:{
          buyerId,
          total,
          items:{create: itemsData},
        },
        include:{items:true},
      });

      await tx.cartItem.deleteMany({ where: {cartId:cart.id}});

      return order;
    });
  }

  findAllForBuyer(buyerId:string) {
    return this.prisma.order.findMany({
      where:{buyerId},
      include:{items:true},
      orderBy:{createdAt:'desc'}});
  }

  findAllForVendor(vendorId:string){
    return this.prisma.orderItem.findMany({
      where:{vendorId},
      include:{
        order:{select:{id:true, status:true, buyerId:true, createdAt:true}}
      },
      orderBy:{createdAt:'desc'}});
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where:{id},
      include:{items:true},
    })
    if(!order)throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  async updateStatus(id: string, updateOrderStatusDto: UpdateOrderStatusDto) {
    await this.findOne(id);
    if(updateOrderStatusDto.status === 'CANCELLED'){
      throw new BadRequestException('Use the cancel endpoint to cancel an order')
    }
    return this.prisma.order.update({
      where:{id},
      data:{
        ...updateOrderStatusDto
      }
    })
  }

  async cancel(id:string){
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where:{id},
        include: {items:true},
      });
      if(!order) throw new NotFoundException(`Order with ID ${id} not found`);
      if(order.status !== 'PENDING'){
        throw new ConflictException( `Order cannot be cancelled once it is ${order.status}`)
      }

      for (const item of order.items){
        await tx.product.update({
          where:{id:item.productId},
          data:{stock:{increment:item.quantity}},
        })
      }

      return tx.order.update({
        where:{id},
        data:{status:'CANCELLED'},
        include:{items:true},
      })
    })
  }

}
