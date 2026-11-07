import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartsService } from './carts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CartsService', () => {
  let service: CartsService;
  let prisma: {
    product: { findUnique: jest.Mock };
    cart: { findUnique: jest.Mock; upsert: jest.Mock };
    cartItem: {
      upsert: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', name: 'Layer Feed', isActive: true }),
      },
      cart: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cart1', userId: 'u1', items: [] }),
        upsert: jest.fn().mockResolvedValue({ id: 'cart1', userId: 'u1' }),
      },
      cartItem: {
        upsert: jest.fn().mockResolvedValue({ id: 'ci1', quantity: 2 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'ci1', quantity: 2 }),
        update: jest.fn().mockResolvedValue({ id: 'ci1', quantity: 5 }),
        delete: jest.fn().mockResolvedValue({ id: 'ci1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CartsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CartsService>(CartsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getCart', () => {
    it('loads the cart by userId with its items and their products', async () => {
      await service.getCart('u1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        include: { items: { include: { product: true } } },
      });
    });

    it('returns an empty cart shape without creating a row', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.getCart('u1')).resolves.toEqual({ userId: 'u1', items: [] });
      expect(prisma.cart.upsert).not.toHaveBeenCalled();
    });
  });

  describe('addItem', () => {
    it('404s when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem('u1', { productId: 'gone', quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.cart.upsert).not.toHaveBeenCalled();
    });

    it('rejects a deactivated product', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p1', name: 'Layer Feed', isActive: false });

      await expect(service.addItem('u1', { productId: 'p1', quantity: 1 })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.cart.upsert).not.toHaveBeenCalled();
    });

    it('upserts the cart by userId so a first add cannot race itself', async () => {
      await service.addItem('u1', { productId: 'p1', quantity: 2 });

      expect(prisma.cart.upsert).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        update: {},
        create: { userId: 'u1' },
      });
    });

    // Adding a product already in the cart must increment, not duplicate the row -
    // the compound unique key is what makes the upsert land on the existing item.
    it('increments an existing line item instead of duplicating it', async () => {
      await service.addItem('u1', { productId: 'p1', quantity: 2 });

      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_productId: { cartId: 'cart1', productId: 'p1' } },
        update: { quantity: { increment: 2 } },
        create: { cartId: 'cart1', productId: 'p1', quantity: 2 },
      });
    });
  });

  describe('updateItem', () => {
    // Regression: this looked the cart up with `where: { id: userId }`, passing a user
    // id as the cart's own primary key, so every quantity change 404'd.
    it('finds the cart by userId, not by treating the user id as the cart id', async () => {
      await service.updateItem('u1', 'p1', { quantity: 5 });

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('404s when the user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.updateItem('u1', 'p1', { quantity: 5 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });

    it('404s when that product is not in the cart', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.updateItem('u1', 'p1', { quantity: 5 })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.cartItem.update).not.toHaveBeenCalled();
    });

    it('sets the exact quantity rather than incrementing', async () => {
      await service.updateItem('u1', 'p1', { quantity: 5 });

      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'ci1' },
        data: { quantity: 5 },
      });
    });
  });

  describe('removeItem', () => {
    // Regression: same user-id-as-cart-id slip, so removal always 404'd.
    it('finds the cart by userId', async () => {
      await service.removeItem('u1', 'p1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('404s when the user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('u1', 'p1')).rejects.toThrow(NotFoundException);
      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
    });

    it('404s when that product is not in the cart', async () => {
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.removeItem('u1', 'p1')).rejects.toThrow(NotFoundException);
      expect(prisma.cartItem.delete).not.toHaveBeenCalled();
    });

    it('deletes the line item by its own id', async () => {
      await service.removeItem('u1', 'p1');

      expect(prisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: 'ci1' } });
    });
  });

  describe('clearCart', () => {
    // Regression: the same slip here failed SILENTLY - no cart was ever found, so the
    // method returned without deleting anything and DELETE /cart answered 200.
    it('finds the cart by userId and deletes every item in it', async () => {
      await service.clearCart('u1');

      expect(prisma.cart.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart1' } });
    });

    it('is a no-op when the user has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.clearCart('u1')).resolves.toBeUndefined();
      expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });
  });
});
