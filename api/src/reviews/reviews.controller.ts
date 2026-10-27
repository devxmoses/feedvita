import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewOwnerOrAdminGuard } from './guards/review-owner-or-admin.guard';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Review a product you have received' })
  @ApiResponse({ status: 201, description: 'Review created' })
  @ApiResponse({ status: 403, description: 'You can only review products from a delivered order' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 409, description: 'You have already reviewed this product' })
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Request() req, @Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(req.user.id, createReviewDto);
  }

  @ApiOperation({ summary: 'List reviews, optionally filtered by product' })
  @ApiQuery({ name: 'productId', required: false })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  @Get()
  findAll(@Query('productId') productId?: string) {
    return this.reviewsService.findAll(productId);
  }

  @ApiOperation({ summary: 'Get a single review by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'The review' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit your own review' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Review updated' })
  @ApiResponse({ status: 403, description: 'You can only modify your own review' })
  @UseGuards(JwtAuthGuard, ReviewOwnerOrAdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewsService.update(id, updateReviewDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your own review (admins can moderate any)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  @ApiResponse({ status: 403, description: 'You can only modify your own review' })
  @UseGuards(JwtAuthGuard, ReviewOwnerOrAdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
