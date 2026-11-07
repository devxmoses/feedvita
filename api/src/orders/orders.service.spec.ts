import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/enums';

type TxMock = {
  cart: { findUnique: jest.Mock };
  cartItem: { deleteMany: jest.Mock };
  product: { updateMany: jest.Mock; update: jest.Mock };
  order: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
};

describe('OrdersService', () => {
  let service: OrdersService;
  let tx: TxMock;
  let prisma: {
    order: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    orderItem: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const aProduct = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    name: 'Layer Feed',
    price: 1000,
    stock: 10,
    vendorId: 'v1',
    isActive: true,
    ...over,
  });

  const aCart = (...items: Array<{ quantity: number; product: ReturnType<typeof aProduct> }>) => ({
    id: 'cart1',
    items,
  });

  beforeEach(async () => {
    tx = {
      cart: { findUnique: jest.fn() },
      cartItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        create: jest.fn().mockResolvedValue({ id: 'order1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'order1', status: 'CANCELLED' }),
      },
    };

    // NOTE: cart / cartItem / product are deliberately absent from the base client mock.
    // Anything inside a $transaction that reaches for this.prisma instead of tx will
    // throw a TypeError here, which is the regression guard for transaction-scope bugs.
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({ id: 'order1' }),
      },
      orderItem: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create (checkout)', () => {
    it('rejects checkout when the buyer has no cart at all', async () => {
      tx.cart.findUnique.mockResolvedValue(null);

      await expect(service.create('buyer1')).rejects.toThrow(BadRequestException);
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it('rejects checkout when the cart exists but has been emptied', async () => {
      tx.cart.findUnique.mockResolvedValue(aCart());

      await expect(service.create('buyer1')).rejects.toThrow(BadRequestException);
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it('rejects checkout when a product has been deactivated, before touching stock', async () => {
      tx.cart.findUnique.mockResolvedValue(aCart({ quantity: 1, product: aProduct({ isActive: false }) }));

      await expect(service.create('buyer1')).rejects.toThrow(BadRequestException);
      expect(tx.product.updateMany).not.toHaveBeenCalled();
      expect(tx.order.create).not.toHaveBeenCalled();
    });

    it('decrements stock with a gte guard so oversold rows cannot match', async () => {
      tx.cart.findUnique.mockResolvedValue(aCart({ quantity: 2, product: aProduct() }));

      await service.create('buyer1');

      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: 'p1', stock: { gte: 2 } },
        data: { stock: { decrement: 2 } },
      });
    });

    it('aborts with a conflict when the guarded decrement matches no row', async () => {
      tx.cart.findUnique.mockResolvedValue(aCart({ quantity: 99, product: aProduct() }));
      tx.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.create('buyer1')).rejects.toThrow(ConflictException);
      expect(tx.order.create).not.toHaveBeenCalled();
      expect(tx.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('computes the total from live product prices, not anything client supplied', async () => {
      tx.cart.findUnique.mockResolvedValue(
        aCart(
          { quantity: 2, product: aProduct({ id: 'p1', price: 1000 }) },
          { quantity: 3, product: aProduct({ id: 'p2', price: 250 }) },
        ),
      );

      await service.create('buyer1');

      expect(tx.order.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ total: 2750 }) }),
      );
    });

    it('snapshots name, unit price and vendor onto each order item', async () => {
      tx.cart.findUnique.mockResolvedValue(
        aCart({ quantity: 2, product: aProduct({ name: 'Layer Feed', price: 1000, vendorId: 'v1' }) }),
      );

      await service.create('buyer1');

      const { data } = tx.order.create.mock.calls[0][0];
      expect(data.items.create).toEqual([
        { productId: 'p1', vendorId: 'v1', productName: 'Layer Feed', quantity: 2, unitPrice: 1000 },
      ]);
    });

    it('clears the cart only after the order row exists', async () => {
      tx.cart.findUnique.mockResolvedValue(aCart({ quantity: 1, product: aProduct() }));

      await service.create('buyer1');

      expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({ where: { cartId: 'cart1' } });
      expect(tx.order.create.mock.invocationCallOrder[0]).toBeLessThan(
        tx.cartItem.deleteMany.mock.invocationCallOrder[0],
      );
    });

    it('runs every write through the transaction client', async () => {
      tx.cart.findUnique.mockResolvedValue(aCart({ quantity: 1, product: aProduct() }));

      await service.create('buyer1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    const pendingOrder = (items: Array<{ productId: string; quantity: number }>) => ({
      id: 'order1',
      status: 'PENDING',
      items,
    });

    it('404s when the order does not exist', async () => {
      tx.order.findUnique.mockResolvedValue(null);

      await expect(service.cancel('missing')).rejects.toThrow(NotFoundException);
      expect(tx.product.update).not.toHaveBeenCalled();
    });

    it('refuses to cancel an order that has moved past PENDING, and does not restock', async () => {
      tx.order.findUnique.mockResolvedValue({ id: 'order1', status: 'PAID', items: [] });

      await expect(service.cancel('order1')).rejects.toThrow(ConflictException);
      expect(tx.product.update).not.toHaveBeenCalled();
      expect(tx.order.update).not.toHaveBeenCalled();
    });

    it('restocks every line item by its ordered quantity', async () => {
      tx.order.findUnique.mockResolvedValue(
        pendingOrder([
          { productId: 'p1', quantity: 2 },
          { productId: 'p2', quantity: 5 },
        ]),
      );

      await service.cancel('order1');

      expect(tx.product.update).toHaveBeenCalledTimes(2);
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { stock: { increment: 2 } },
      });
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { stock: { increment: 5 } },
      });
    });

    it('marks the order CANCELLED', async () => {
      tx.order.findUnique.mockResolvedValue(pendingOrder([{ productId: 'p1', quantity: 1 }]));

      await service.cancel('order1');

      expect(tx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'order1' }, data: { status: 'CANCELLED' } }),
      );
    });
  });

  describe('updateStatus', () => {
    it('refuses CANCELLED so cancellation cannot skip the restock path', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order1', items: [] });

      await expect(service.updateStatus('order1', { status: OrderStatus.CANCELLED })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('applies any other status', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'order1', items: [] });

      await service.updateStatus('order1', { status: OrderStatus.SHIPPED });

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order1' },
        data: { status: 'SHIPPED' },
      });
    });

    it('404s before updating when the order is missing', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.updateStatus('missing', { status: OrderStatus.SHIPPED })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('read paths', () => {
    it('findOne 404s when the order is missing', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('findAllForBuyer scopes the query to that buyer', async () => {
      await service.findAllForBuyer('buyer1');

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { buyerId: 'buyer1' } }),
      );
    });

    it('findAllForVendor scopes order items to that vendor', async () => {
      await service.findAllForVendor('v1');

      expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vendorId: 'v1' } }),
      );
    });
  });
});
