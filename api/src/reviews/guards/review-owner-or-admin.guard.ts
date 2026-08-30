import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewOwnerOrAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user, params } = request;

    if (!user) return false;
    if (user.isAdmin) return true;

    const review = await this.prisma.review.findUnique({
      where: { id: params.id },
      select: { authorId: true },
    });
    if (!review) throw new NotFoundException(`Review with ID ${params.id} not found`);
    if (review.authorId === user.id) return true;

    throw new ForbiddenException('You can only modify your own review');
  }
}
