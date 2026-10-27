import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/enums'
import { Order } from '../orders/entities/order.entity';

const COLLECTED_STATUS: OrderStatus[] = [
    OrderStatus.PAID,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
];

@Injectable()
export class AdminService {
    constructor (private readonly prisma: PrismaService) {}

    async getStats(){
        return this.prisma.$transaction(async(tx)=>{
            const users = await tx.user.count();
            const vendors = await tx.vendor.count();
            const products = await tx.product.count();
            const orders = this.prisma.order.count();
            const reviews = this.prisma.review.count();

            const ordersByStatus = await tx.order.groupBy({
                by:['status'],
                _count:{_all:true},
                orderBy: {status:'asc'},
            });

            const revenue = await tx.order.aggregate({
                where:{ status: {in: COLLECTED_STATUS}},
                _sum: { total:true},
            });

            const topVendors = await tx.orderItem.groupBy({
                by: ['vendorId'],
                _sum: { quantity:true},
                _count:{_all:true},
                orderBy: {_sum:{quantity:'desc'}},
                take: 5,
            });
            
            return {
                totals: {users, vendors, products, orders, reviews},
                ordersByStatus: Object.fromEntries(
                    ordersByStatus.map((row)=>[row.status, row._count._all]),
                ),
                revenue:{
                    collected: revenue._sum.total ?? 0,
                    currency:'usd',
                    note:'Minor units. Counts PAID, SHIPPED AND DELIVERED orders only.',
                },
                topVendors: topVendors.map((row)=>({
                    vendorId: row.vendorId,
                    unitsSold: row._sum.quantity ?? 0,
                    lineItems: row._count._all,
                })),
            }
        });
    }
}
