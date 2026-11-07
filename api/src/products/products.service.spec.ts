import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;

  const PRODUCT = {
    id: 'p1', name: 'Layer Feed 20kg', slug: 'layer-feed-20kg',
    price: 4999, stock: 10, isActive: true, vendorId: 'v1',
  };
  const BASE = { name: 'Layer Feed 20kg', price: 4999, vendorId: 'v1' };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn().mockResolvedValue(PRODUCT),
        findMany: jest.fn().mockResolvedValue([PRODUCT]),
        findUnique: jest.fn().mockResolvedValue(PRODUCT),
        update: jest.fn().mockResolvedValue(PRODUCT),
        delete: jest.fn().mockResolvedValue(PRODUCT),
      },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Poultry' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProductsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('derives the slug from the name', async () => {
      await service.create({ ...BASE, name: 'Layer Feed 20kg' });

      expect(prisma.product.create.mock.calls[0][0].data.slug).toBe('layer-feed-20kg');
    });

    it('normalises a slug that was supplied', async () => {
      await service.create({ ...BASE, slug: 'Layer FEED 20kg' });

      expect(prisma.product.create.mock.calls[0][0].data.slug).toBe('layer-feed-20kg');
    });

    // A product that defaulted to null stock would break the checkout decrement.
    it('defaults stock to 0 and isActive to true', async () => {
      await service.create(BASE);

      const { data } = prisma.product.create.mock.calls[0][0];
      expect(data.stock).toBe(0);
      expect(data.isActive).toBe(true);
    });

    it('keeps an explicit stock of 0 rather than treating it as missing', async () => {
      await service.create({ ...BASE, stock: 0 });

      expect(prisma.product.create.mock.calls[0][0].data.stock).toBe(0);
    });

    it('keeps an explicit isActive of false', async () => {
      await service.create({ ...BASE, isActive: false });

      expect(prisma.product.create.mock.calls[0][0].data.isActive).toBe(false);
    });

    it('rejects a category that does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...BASE, categoryId: 'nope' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('does not look up a category when none was given', async () => {
      await service.create(BASE);

      expect(prisma.category.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('filters by vendor', async () => {
      await service.findAll('v1');

      expect(prisma.product.findMany).toHaveBeenCalledWith({ where: { vendorId: 'v1' } });
    });

    it('filters by category', async () => {
      await service.findAll(undefined, 'c1');

      expect(prisma.product.findMany).toHaveBeenCalledWith({ where: { categoryId: 'c1' } });
    });

    it('filters by both at once', async () => {
      await service.findAll('v1', 'c1');

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { vendorId: 'v1', categoryId: 'c1' },
      });
    });

    it('applies no filter when neither is given', async () => {
      await service.findAll();

      expect(prisma.product.findMany).toHaveBeenCalledWith({ where: {} });
    });
  });

  describe('findOne', () => {
    it('returns the product', async () => {
      await expect(service.findOne('p1')).resolves.toEqual(PRODUCT);
    });

    it('throws 404 when it does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('checks the product exists first', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('rejects a category that does not exist', async () => {
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(service.update('p1', { categoryId: 'nope' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('normalises a new slug', async () => {
      await service.update('p1', { slug: 'New SLUG' });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { slug: 'new-slug' },
      });
    });

    it('leaves the slug alone when the patch does not mention it', async () => {
      await service.update('p1', { price: 5999 });

      const { data } = prisma.product.update.mock.calls[0][0];
      expect(data).toEqual({ price: 5999 });
      expect(data).not.toHaveProperty('slug');
    });
  });

  describe('remove', () => {
    it('checks the product exists first', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('deletes it', async () => {
      await expect(service.remove('p1')).resolves.toEqual(PRODUCT);
      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });
  });
});
