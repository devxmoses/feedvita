import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, createReviewDto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({ where: { id: createReviewDto.productId } });
    if (!product) throw new NotFoundException(`Product with ID ${createReviewDto.productId} not found`);

    const verifiedPurchase = await this.prisma.orderItem.findFirst({
      where: {
        productId: createReviewDto.productId,
        order: { buyerId: authorId, status: 'DELIVERED' },
      },
    });
    if (!verifiedPurchase) {
      throw new ForbiddenException('You can only review products from a delivered order');
    }

    return this.prisma.review.create({
      data: {
        ...createReviewDto,
        authorId,
      },
    });
  }

  findAll(productId?: string) {
    return this.prisma.review.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Review with ID ${id} not found`);
    return review;
  }

  async update(id: string, updateReviewDto: UpdateReviewDto) {
    await this.findOne(id);
    return this.prisma.review.update({ where: { id }, data: updateReviewDto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.review.delete({ where: { id } });
  }
}
