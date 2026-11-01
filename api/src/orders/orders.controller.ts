import {  Controller, Get, Post, Body, Patch, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderOwnerOrAdminGuard } from './guards/order-owner-or-admin.guard';
import { VendorOwnerToOrderGuard } from './guards/vendor-owner-to-order.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiOperation({ summary: 'Check out: turn your current cart into an order' })
  @ApiResponse({ status: 201, description: 'Order created, stock decremented, cart cleared' })
  @ApiResponse({ status: 400, description: 'Your cart is empty, or a product is no longer available' })
  @ApiResponse({ status: 409, description: 'Not enough stock for one of the products' })
  @Post()
  create(@Request() req) {
    return this.ordersService.create(req.user.id);
  }

  @ApiOperation({ summary: 'List your own orders' })
  @ApiResponse({ status: 200, description: 'List of your orders' })
  @Get()
  findAllForBuyer(@Request() req) {
    return this.ordersService.findAllForBuyer(req.user.id);
  }

  @ApiOperation({ summary: 'List order items for a vendor you own (fulfilment view)' })
  @ApiParam({ name: 'vendorId' })
  @ApiResponse({ status: 200, description: 'Order items belonging to that vendor' })
  @ApiResponse({ status: 403, description: 'You can only view orders for your own vendor' })
  @UseGuards(VendorOwnerToOrderGuard)
  @Get('vendor/:vendorId')
  findAllforVendor(@Param('vendorId') vendorId:string){
    return this.ordersService.findAllForVendor(vendorId);
  }

  @ApiOperation({ summary: 'Get a single order by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'The order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @ApiOperation({ summary: 'Update an order status (admin only)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Order status updated' })
  @ApiResponse({ status: 400, description: 'Use the cancel endpoint to cancel an order' })
  @ApiResponse({ status: 403, description: 'Admins only' })
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @Patch(':id')
  updateStatus(@Param('id') id: string, @Body() updateOrderStatusDto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, updateOrderStatusDto);
  }

  @ApiOperation({ summary: 'Cancel your own pending order (restocks the items)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Order cancelled and stock restored' })
  @ApiResponse({ status: 403, description: 'You can only cancel your own order' })
  @ApiResponse({ status: 409, description: 'Order has already moved past PENDING' })
  @UseGuards(OrderOwnerOrAdminGuard)
  @Patch(':id/cancel')
  cancel(@Param('id') id:string){
    return this.ordersService.cancel(id);
  }

}
