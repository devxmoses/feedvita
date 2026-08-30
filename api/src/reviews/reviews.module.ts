import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewOwnerOrAdminGuard } from './guards/review-owner-or-admin.guard';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewOwnerOrAdminGuard],
})
export class ReviewsModule {}
