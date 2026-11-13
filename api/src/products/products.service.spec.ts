import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { Segment } from '../../generated/prisma/enums';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: any;

  const PRODUCT = {
    id: 'p1', name: 'Cold Pressed Ginger Shot 250ml', slug: 'cold-pressed-ginger-shot-250ml',
    price: 4999, stock: 10, isActive: true, vendorId: 'v1',
  };
  const BASE = {
    name: 'Cold Pressed Ginger Shot 250ml', price: 4999, vendorId: 'v1',
    segments: [Segment.HUMAN],
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn().mockResolvedValue(PRODUCT),
        findMany: jest.fn().mockResolvedValue([PRODUCT]),
        findUnique: jest.fn().mockResolvedValue(PRODUCT),
        update: jest.fn().mockResolvedValue(PRODUCT),
        delete: jest.fn().mockResolvedValue(PRODUCT),
        count: jest.fn().mockResolvedValue(1),
      },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', name: 'Beverages' }) },
      // mirror Prisma: `in` returns a row for each id that exists. The default
      // echoes every requested id back, so tests opt in to a missing one.
      species: {
        findMany: jest.fn(({ where }: any) =>
          Promise.resolve((where.id.in as string[]).map((id) => ({ id }))),
        ),
      },
      // the array form of $transaction: Prisma runs the operations it is handed
      // in one transaction, so the page and the count see the same snapshot
      $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProductsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('derives the slug from the name', async () => {
      await service.create({ ...BASE, name: 'Cold Pressed Ginger Shot 250ml' });

      expect(prisma.product.create.mock.calls[0][0].data.slug).toBe('cold-pressed-ginger-shot-250ml');
    });

    it('normalises a slug that was supplied', async () => {
      await service.create({ ...BASE, slug: 'Cold PRESSED Ginger Shot 250ml' });

      expect(prisma.product.create.mock.calls[0][0].data.slug).toBe('cold-pressed-ginger-shot-250ml');
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

  describe('create with species', () => {
    it('connects the species it was given', async () => {
      await service.create({ ...BASE, speciesIds: ['s1', 's2'] });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            species: { connect: [{ id: 's1' }, { id: 's2' }] },
          }),
        }),
      );
    });

    it('does not send speciesIds to Prisma as a column', async () => {
      await service.create({ ...BASE, speciesIds: ['s1', 's2'] });

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('speciesIds');
    });

    it('omits the relation entirely when no species are given', async () => {
      await service.create(BASE);

      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('species');
      expect(prisma.species.findMany).not.toHaveBeenCalled();
    });

    it('rejects a species id that does not exist, naming the missing one', async () => {
      prisma.species.findMany.mockResolvedValue([{ id: 's1' }]);

      await expect(
        service.create({ ...BASE, speciesIds: ['s1', 'ghost'] }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.create({ ...BASE, speciesIds: ['s1', 'ghost'] }),
      ).rejects.toThrow('ghost');

      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('stores the segments it was given', async () => {
      await service.create({ ...BASE, segments: [Segment.PET, Segment.LIVESTOCK] });

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            segments: [Segment.PET, Segment.LIVESTOCK],
          }),
        }),
      );
    });
  });

  describe('update with species', () => {
    it('replaces the species list rather than adding to it', async () => {
      await service.update('p1', { speciesIds: ['s1'] });

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ species: { set: [{ id: 's1' }] } }),
        }),
      );
    });

    it('does not send speciesIds to Prisma as a column', async () => {
      await service.update('p1', { speciesIds: ['s1'] });

      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('speciesIds');
    });

    it('clears the species list when given an empty array', async () => {
      await service.update('p1', { speciesIds: [] });

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ species: { set: [] } }),
        }),
      );
    });

    it('leaves species untouched when the key is absent', async () => {
      await service.update('p1', { price: 5999 });

      const data = prisma.product.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('species');
    });

    it('rejects a species id that does not exist', async () => {
      prisma.species.findMany.mockResolvedValue([]);

      await expect(
        service.update('p1', { speciesIds: ['ghost'] }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });

   describe('findAll', () => {
    // what the ValidationPipe hands the service once defaults have been applied
    const query = (over: Partial<FindProductsQueryDto> = {}) =>
      ({ page: 1, limit: 20, sortBy: 'createdAt', order: 'desc', ...over }) as FindProductsQueryDto;

    it('filters by vendor', async () => {
      await service.findAll(query({ vendorId: 'v1' }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vendorId: 'v1' } }),
      );
    });

    it('filters by category', async () => {
      await service.findAll(query({ categoryId: 'c1' }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { categoryId: 'c1' } }),
      );
    });

    it('filters by both at once', async () => {
      await service.findAll(query({ vendorId: 'v1', categoryId: 'c1' }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vendorId: 'v1', categoryId: 'c1' } }),
      );
    });

    it('applies no filter when neither is given', async () => {
      await service.findAll(query());

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('counts against the same filter as the page', async () => {
      await service.findAll(query({ vendorId: 'v1' }));

      expect(prisma.product.count).toHaveBeenCalledWith({ where: { vendorId: 'v1' } });
    });

    it('translates page and limit into skip and take', async () => {
      await service.findAll(query({ page: 3, limit: 10 }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('asks for the first page with no offset', async () => {
      await service.findAll(query({ page: 1, limit: 25 }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 25 }),
      );
    });

    it('sorts by the requested field and direction', async () => {
      await service.findAll(query({ sortBy: 'price', order: 'asc' }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { price: 'asc' } }),
      );
    });

    it('runs the page and the count in one transaction', async () => {
      await service.findAll(query());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });

    it('returns the rows under data with pagination meta', async () => {
      prisma.product.count.mockResolvedValue(47);

      const result = await service.findAll(query({ page: 2, limit: 20 }));

      expect(result.data).toEqual([PRODUCT]);
      expect(result.meta).toEqual({ total: 47, page: 2, limit: 20, pageCount: 3 });
    });

    it('matches any of the requested segments, not all of them', async () => {
      await service.findAll(query({ segments: [Segment.PET, Segment.HUMAN] }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { segments: { hasSome: [Segment.PET, Segment.HUMAN] } },
        }),
      );
    });

    // LIVESTOCK is a parent of POULTRY and AQUACULTURE, so the filter has to widen
    // or a chicken feed tagged POULTRY is invisible under the livestock navigation
    it('widens LIVESTOCK to include its kinds before querying', async () => {
      await service.findAll(query({ segments: [Segment.LIVESTOCK] }));

      const where = prisma.product.findMany.mock.calls[0][0].where;
      expect(where.segments.hasSome.sort()).toEqual(
        [Segment.AQUACULTURE, Segment.LIVESTOCK, Segment.POULTRY].sort(),
      );
    });

    it('does not widen a narrow kind', async () => {
      await service.findAll(query({ segments: [Segment.POULTRY] }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { segments: { hasSome: [Segment.POULTRY] } },
        }),
      );
    });

    it('counts against the widened filter, not the requested one', async () => {
      await service.findAll(query({ segments: [Segment.LIVESTOCK] }));

      const countWhere = prisma.product.count.mock.calls[0][0].where;
      expect(countWhere.segments.hasSome).toHaveLength(3);
    });

    it('ignores an empty segments array rather than matching nothing', async () => {
      await service.findAll(query({ segments: [] }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by species through the relation', async () => {
      await service.findAll(query({ speciesId: 's1' }));

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { species: { some: { id: 's1' } } } }),
      );
    });

    it('combines segment, species and vendor filters', async () => {
      await service.findAll(
        query({ vendorId: 'v1', segments: [Segment.PET], speciesId: 's1' }),
      );

      expect(prisma.product.count).toHaveBeenCalledWith({
        where: {
          vendorId: 'v1',
          segments: { hasSome: [Segment.PET] },
          species: { some: { id: 's1' } },
        },
      });
    });

    it('reports a pageCount of 0 for an empty result set', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      const result = await service.findAll(query());

      expect(result.data).toEqual([]);
      expect(result.meta.pageCount).toBe(0);
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

      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: { slug: 'new-slug' },
        }),
      );
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
