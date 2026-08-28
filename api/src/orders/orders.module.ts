import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderOwnerOrAdminGuard } from './guards/order-owner-or-admin.guard';
import { VendorOwnerToOrderGuard } from './guards/vendor-owner-to-order.guard';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrderOwnerOrAdminGuard, VendorOwnerToOrderGuard],
})
export class OrdersModule {}
