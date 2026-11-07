import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: {
    product: { findUnique: jest.Mock };
    orderItem: { findFirst: jest.Mock };
    review: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const aDto = (over: Record<string, unknown> = {}) =>
    ({ productId: 'p1', rating: 5, comment: 'Arrived cold and tasted fresh.', ...over }) as any;

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', name: 'Cold Pressed Ginger Shot' }) },
      orderItem: { findFirst: jest.fn().mockResolvedValue({ id: 'oi1' }) },
      review: {
        create: jest.fn().mockResolvedValue({ id: 'r1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'r1' }),
        delete: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create (verified purchase only)', () => {
    it('404s when the product does not exist, without checking eligibility', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create('u1', aDto())).rejects.toThrow(NotFoundException);
      expect(prisma.orderItem.findFirst).not.toHaveBeenCalled();
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('forbids a review when the author has no delivered order for the product', async () => {
      prisma.orderItem.findFirst.mockResolvedValue(null);

      await expect(service.create('u1', aDto())).rejects.toThrow(ForbiddenException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    // This is the security assertion for the whole module. Dropping buyerId would let
    // anyone review anything once a single delivered order existed; widening the status
    // would let people review things that were merely paid for and never received.
    it('scopes eligibility to this product, this buyer, and a DELIVERED order', async () => {
      await service.create('u1', aDto());

      expect(prisma.orderItem.findFirst).toHaveBeenCalledWith({
        where: {
          productId: 'p1',
          order: { buyerId: 'u1', status: 'DELIVERED' },
        },
      });
    });

    it('creates the review once eligibility passes', async () => {
      const result = await service.create('u1', aDto());

      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          rating: 5,
          comment: 'Arrived cold and tasted fresh.',
          authorId: 'u1',
        },
      });
      expect(result).toEqual({ id: 'r1' });
    });

    // The DTO is spread into `data`, so authorId must be applied after it. If that
    // order ever flipped, a crafted body could attribute a review to another user.
    it('always attributes the review to the authenticated user, never to the body', async () => {
      await service.create('u1', aDto({ authorId: 'someone-else' }));

      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ authorId: 'u1' }) }),
      );
    });
  });

  describe('findAll', () => {
    it('filters by product when a productId is given', async () => {
      await service.findAll('p1');

      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns every review when no productId is given', async () => {
      await service.findAll();

      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the review when it exists', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1', rating: 4 });

      await expect(service.findOne('r1')).resolves.toEqual({ id: 'r1', rating: 4 });
    });

    it('404s when the review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.findOne('gone')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('404s before writing when the review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.update('gone', { rating: 2 } as any)).rejects.toThrow(NotFoundException);
      expect(prisma.review.update).not.toHaveBeenCalled();
    });

    it('applies the patch to an existing review', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });

      await service.update('r1', { rating: 2 } as any);

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { rating: 2 },
      });
    });
  });

  describe('remove', () => {
    it('404s before deleting when the review does not exist', async () => {
      prisma.review.findUnique.mockResolvedValue(null);

      await expect(service.remove('gone')).rejects.toThrow(NotFoundException);
      expect(prisma.review.delete).not.toHaveBeenCalled();
    });

    it('deletes an existing review', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'r1' });

      await service.remove('r1');

      expect(prisma.review.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });
});
