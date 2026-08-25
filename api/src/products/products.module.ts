import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductOwnerOrAdminGuard } from './guards/product-owner-or-admin.guard';
import { VendorOwnerGuard } from './guards/vendor-owner.guard';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductOwnerOrAdminGuard, VendorOwnerGuard],
})
export class ProductsModule {}
