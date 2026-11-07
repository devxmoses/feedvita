import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../prisma/prisma.service';

describe('VendorsService', () => {
  let service: VendorsService;
  let prisma: any;
  let tx: { vendor: Record<string, jest.Mock>; user: Record<string, jest.Mock> };

  const VENDOR = { id: 'v1', name: 'Green Valley Nutrition', slug: 'green-valley-nutrition', ownerId: 'u1' };

  beforeEach(async () => {
    tx = {
      vendor: { create: jest.fn().mockResolvedValue(VENDOR) },
      user: { update: jest.fn() },
    };
    // Deliberately no `vendor`/`user` on the base client: create() must do both
    // writes through the transaction, and touching this.prisma instead would
    // throw here rather than quietly escape the transaction.
    prisma = {
      $transaction: jest.fn((cb: any) => cb(tx)),
      vendor: {
        findMany: jest.fn().mockResolvedValue([VENDOR]),
        findUnique: jest.fn().mockResolvedValue(VENDOR),
        update: jest.fn().mockResolvedValue(VENDOR),
        delete: jest.fn().mockResolvedValue(VENDOR),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(VendorsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('derives the slug from the name when none is given', async () => {
      await service.create('u1', { name: 'Green Valley Nutrition!' });

      expect(tx.vendor.create).toHaveBeenCalledWith({
        data: {
          name: 'Green Valley Nutrition!',
          description: undefined,
          slug: 'green-valley-nutrition',
          ownerId: 'u1',
        },
      });
    });

    it('normalises a slug that was supplied', async () => {
      await service.create('u1', { name: 'Anything', slug: '  Mixed CASE Slug  ' });

      expect(tx.vendor.create.mock.calls[0][0].data.slug).toBe('mixed-case-slug');
    });

    it('owns the vendor to the caller, not to anything in the body', async () => {
      await service.create('u1', { name: 'Green Valley Nutrition' });

      expect(tx.vendor.create.mock.calls[0][0].data.ownerId).toBe('u1');
    });

    // Creating the vendor and flipping isVendor must not be separable - a crash
    // between them would leave a vendor whose owner cannot act as one.
    it('flips the owner to isVendor inside the same transaction', async () => {
      await service.create('u1', { name: 'Green Valley Nutrition' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isVendor: true },
      });
    });

    it('returns the created vendor', async () => {
      await expect(service.create('u1', { name: 'Green Valley Nutrition' })).resolves.toEqual(VENDOR);
    });
  });

  describe('findOne', () => {
    it('returns the vendor', async () => {
      await expect(service.findOne('v1')).resolves.toEqual(VENDOR);
    });

    it('throws 404 when it does not exist', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('lists vendors', async () => {
      await expect(service.findAll()).resolves.toEqual([VENDOR]);
    });
  });

  describe('update', () => {
    it('checks the vendor exists first', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(prisma.vendor.update).not.toHaveBeenCalled();
    });

    it('normalises a new slug', async () => {
      await service.update('v1', { slug: 'New SLUG Here' });

      expect(prisma.vendor.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { slug: 'new-slug-here' },
      });
    });

    // Passing `slug: undefined` through would null out a perfectly good slug.
    it('leaves the slug alone when the patch does not mention it', async () => {
      await service.update('v1', { name: 'Renamed' });

      const { data } = prisma.vendor.update.mock.calls[0][0];
      expect(data).toEqual({ name: 'Renamed' });
      expect(data).not.toHaveProperty('slug');
    });
  });

  describe('remove', () => {
    it('checks the vendor exists first', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
      expect(prisma.vendor.delete).not.toHaveBeenCalled();
    });

    it('deletes it', async () => {
      await expect(service.remove('v1')).resolves.toEqual(VENDOR);
      expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
    });
  });
});
