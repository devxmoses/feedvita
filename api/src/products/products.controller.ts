import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VendorOwnerToProductGuard } from './guards/vendor-owner.-to-product.guard';
import { ProductOwnerOrAdminGuard } from './guards/product-owner-or-admin.guard';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product for a vendor you own' })
  @ApiResponse({ status:201, description: 'Product created '})
  @ApiResponse({ status: 403, description: 'You do not own this vendor' })
  @UseGuards(JwtAuthGuard, VendorOwnerToProductGuard)
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @ApiOperation({ summary: 'List products, optionally filtered by vendor or category' })
  @ApiQuery({ name: 'vendorId', required: false})
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiResponse({ status: 200, description: 'List of products' })
  @Get()
  findAll(@Query('vendorId') vendorId?:string, @Query('categoryId') categoryId?:string) {
    return this.productsService.findAll(vendorId, categoryId);
  }

  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id'})
  @ApiResponse({ status: 200, description: 'The product' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product you own' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  @ApiResponse({ status: 403, description: 'You do not own this product' })
  @UseGuards(JwtAuthGuard, ProductOwnerOrAdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product you own' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  @ApiResponse({ status: 403, description: 'You do not own this product' })
  @UseGuards(JwtAuthGuard, ProductOwnerOrAdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
