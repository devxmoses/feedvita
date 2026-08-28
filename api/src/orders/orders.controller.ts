import {  Controller, Get, Post, Body, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderOwnerOrAdminGuard } from './guards/order-owner-or-admin.guard';
import { VendorOwnerToOrderGuard } from './guards/vendor-owner-to-order.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Request() req) {
    return this.ordersService.create(req.user.id);
  }

  @Get()
  findAllForBuyer(@Request() req) {
    return this.ordersService.findAllForBuyer(req.user.id);
  }

  @UseGuards(VendorOwnerToOrderGuard)
  @Get('vendor/:vendorId')
  findAllforVendor(@Param('vendorId') vendorId:string){
    return this.ordersService.findAllForVendor(vendorId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() updateOrderStatusDto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @UseGuards(OrderOwnerOrAdminGuard)
  @Patch(':id/cancel')
  cancel(@Param('id') id:string){
    return this.ordersService.cancel(id);
  }

}
