import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SpeciesService } from './species.service';
import { PrismaService } from '../prisma/prisma.service';
import { Segment } from '../../generated/prisma/enums';

describe('SpeciesService', () => {
  let service: SpeciesService;
  let prisma: any;
  let tx: any;

  const DOG = {
    id: 's1', name: 'Dog', slug: 'dog', segment: Segment.PET,
    isApproved: true, suggestedById: null,
  };

  beforeEach(async () => {
    tx = {
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]),
        update: jest.fn().mockResolvedValue({}),
      },
      species: {
        delete: jest.fn().mockResolvedValue(DOG),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...DOG, id: 's2', slug: 'dogs' }),
      },
    };

    prisma = {
      species: {
        findMany: jest.fn().mockResolvedValue([DOG]),
        findUnique: jest.fn().mockResolvedValue(DOG),
        upsert: jest.fn().mockResolvedValue(DOG),
        update: jest.fn().mockResolvedValue(DOG),
        delete: jest.fn().mockResolvedValue(DOG),
      },
      product: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SpeciesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SpeciesService);
  });

  describe('findAllApproved', () => {
    it('never returns an unapproved species', async () => {
      await service.findAllApproved({});

      expect(prisma.species.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isApproved: true } }),
      );
    });

    it('narrows to a segment when one is given', async () => {
      await service.findAllApproved({ segment: Segment.LIVESTOCK });

      expect(prisma.species.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isApproved: true, segment: Segment.LIVESTOCK },
        }),
      );
    });

    it('sorts alphabetically, because it populates a filter dropdown', async () => {
      await service.findAllApproved({});

      expect(prisma.species.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });
  });

  describe('findMine', () => {
    it('scopes to the calling user and includes pending rows', async () => {
      await service.findMine('u1');

      expect(prisma.species.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { suggestedById: 'u1' } }),
      );
      const where = prisma.species.findMany.mock.calls[0][0].where;
      expect(where).not.toHaveProperty('isApproved');
    });
  });

  describe('findPending', () => {
    it('returns only unapproved rows, oldest first', async () => {
      await service.findPending();

      expect(prisma.species.findMany).toHaveBeenCalledWith({
        where: { isApproved: false },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('findOne', () => {
    it('returns the species', async () => {
      await expect(service.findOne('s1')).resolves.toEqual(DOG);
    });

    it('throws when it does not exist', async () => {
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('suggest', () => {
    it('upserts on the slug so a race cannot 409', async () => {
      await service.suggest('u1', { name: 'Alpaca', segment: Segment.LIVESTOCK });

      expect(prisma.species.upsert).toHaveBeenCalledWith({
        where: { slug: 'alpaca' },
        update: {},
        create: {
          name: 'Alpaca',
          slug: 'alpaca',
          segment: Segment.LIVESTOCK,
          suggestedById: 'u1',
        },
      });
    });

    it('hands back an existing species untouched rather than renaming it', async () => {
      await service.suggest('u1', { name: 'Alpaca', segment: Segment.PET });

      // update:{} is the whole point - another vendor cannot re-segment a species
      expect(prisma.species.upsert.mock.calls[0][0].update).toEqual({});
    });

    it('slugifies a multi-word name', async () => {
      await service.suggest('u1', { name: 'Guinea Fowl', segment: Segment.LIVESTOCK });

      expect(prisma.species.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'guinea-fowl' } }),
      );
    });

    it('trims the stored name', async () => {
      await service.suggest('u1', { name: '  Alpaca  ', segment: Segment.LIVESTOCK });

      expect(prisma.species.upsert.mock.calls[0][0].create.name).toBe('Alpaca');
    });

    it('treats differently-cased submissions as the same species', async () => {
      await service.suggest('u1', { name: 'ALPACA', segment: Segment.LIVESTOCK });
      await service.suggest('u2', { name: 'alpaca', segment: Segment.LIVESTOCK });

      expect(prisma.species.upsert.mock.calls[0][0].where).toEqual({ slug: 'alpaca' });
      expect(prisma.species.upsert.mock.calls[1][0].where).toEqual({ slug: 'alpaca' });
    });

    it('records who suggested it', async () => {
      await service.suggest('u7', { name: 'Alpaca', segment: Segment.LIVESTOCK });

      expect(prisma.species.upsert.mock.calls[0][0].create.suggestedById).toBe('u7');
    });

    it('rejects a name that slugifies to nothing', async () => {
      await expect(
        service.suggest('u1', { name: '!!!', segment: Segment.LIVESTOCK }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.species.upsert).not.toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('sets isApproved', async () => {
      await service.approve('s1');

      expect(prisma.species.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { isApproved: true },
      });
    });

    it('throws for a species that does not exist', async () => {
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(service.approve('nope')).rejects.toThrow(NotFoundException);
      expect(prisma.species.update).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('recomputes the slug when the name changes', async () => {
      await service.update('s1', { name: 'Guinea Fowl' });

      expect(prisma.species.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { name: 'Guinea Fowl', slug: 'guinea-fowl' },
      });
    });

    it('changes the segment without touching the name', async () => {
      await service.update('s1', { segment: Segment.LIVESTOCK });

      expect(prisma.species.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { segment: Segment.LIVESTOCK },
      });
    });

    it('throws for a species that does not exist', async () => {
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { name: 'Dog' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('merge', () => {
    it('refuses to merge a species into itself', async () => {
      await expect(service.merge('s1', 's1')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('checks both species exist before touching anything', async () => {
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(service.merge('s1', 's2')).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('moves every product link to the target', async () => {
      await service.merge('s1', 's2');

      expect(tx.product.update).toHaveBeenCalledTimes(2);
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { species: { connect: { id: 's2' }, disconnect: { id: 's1' } } },
      });
    });

    it('deletes the duplicate inside the same transaction as the moves', async () => {
      await service.merge('s1', 's2');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.species.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      // the delete must go through tx, not the base client, or a failed move
      // would leave the species gone and its links cascaded away
      expect(prisma.species.delete).not.toHaveBeenCalled();
    });

    it('reports how many products moved and the surviving species', async () => {
      const result = await service.merge('s1', 's2');

      expect(result.merged).toBe(2);
      expect(result.target.id).toBe('s2');
    });

    it('still deletes the duplicate when no products reference it', async () => {
      tx.product.findMany.mockResolvedValue([]);

      const result = await service.merge('s1', 's2');

      expect(result.merged).toBe(0);
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.species.delete).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes a species nothing references', async () => {
      await service.remove('s1');

      expect(prisma.species.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });

    it('refuses to delete one still in use, and says how many', async () => {
      prisma.product.count.mockResolvedValue(3);

      await expect(service.remove('s1')).rejects.toThrow(ConflictException);
      await expect(service.remove('s1')).rejects.toThrow('3 product(s)');

      expect(prisma.species.delete).not.toHaveBeenCalled();
    });

    it('throws for a species that does not exist', async () => {
      prisma.species.findUnique.mockResolvedValue(null);

      await expect(service.remove('nope')).rejects.toThrow(NotFoundException);
    });
  });
});
