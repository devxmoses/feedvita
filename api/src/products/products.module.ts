import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductOwnerOrAdminGuard } from './guards/product-owner-or-admin.guard';
import { VendorOwnerToProductGuard } from './guards/vendor-owner.-to-product.guard';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductOwnerOrAdminGuard, VendorOwnerToProductGuard],
})
export class ProductsModule {}
