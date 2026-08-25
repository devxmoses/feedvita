import { Module } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { VendorsController } from './vendors.controller';
import { VendorOwnerOrAdminGuard } from './guards/vendor-owner-or-admin.guard';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService, VendorOwnerOrAdminGuard],
  exports:[VendorsService],
})
export class VendorsModule {}
