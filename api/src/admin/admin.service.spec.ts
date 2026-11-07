import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../../generated/prisma/enums';

type TxMock = {
  user: { count: jest.Mock };
  vendor: { count: jest.Mock };
  product: { count: jest.Mock };
  review: { count: jest.Mock };
  order: { count: jest.Mock; groupBy: jest.Mock; aggregate: jest.Mock };
  orderItem: { groupBy: jest.Mock };
};

describe('AdminService', () => {
  let service: AdminService;
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tx = {
      user: { count: jest.fn().mockResolvedValue(7) },
      vendor: { count: jest.fn().mockResolvedValue(3) },
      product: { count: jest.fn().mockResolvedValue(11) },
      review: { count: jest.fn().mockResolvedValue(5) },
      order: {
        count: jest.fn().mockResolvedValue(9),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: null } }),
      },
      orderItem: { groupBy: jest.fn().mockResolvedValue([]) },
    };

    // NOTE: only $transaction exists on the base client here. Every model lives on tx
    // alone, so any count/groupBy/aggregate that reaches for this.prisma instead of tx
    // throws a TypeError. That is the standing guard against transaction-scope slips.
    prisma = { $transaction: jest.fn((cb: (t: TxMock) => unknown) => cb(tx)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  it('runs every query inside a single transaction', async () => {
    await service.getStats();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  // Regression: two of these counts were once unawaited calls on the base client,
  // so totals.orders serialised to {} in the JSON response with no error anywhere.
  it('returns resolved numbers for every total, not pending promises', async () => {
    const stats = await service.getStats();

    expect(stats.totals).toEqual({ users: 7, vendors: 3, products: 11, orders: 9, reviews: 5 });
    for (const [key, value] of Object.entries(stats.totals)) {
      expect(typeof value).toBe('number');
      expect(value).not.toBeInstanceOf(Promise);
      expect(key).toBeTruthy();
    }
  });

  it('reshapes the status groupBy rows into a keyed object', async () => {
    tx.order.groupBy.mockResolvedValue([
      { status: 'DELIVERED', _count: { _all: 3 } },
      { status: 'PENDING', _count: { _all: 5 } },
    ]);

    const stats = await service.getStats();

    expect(stats.ordersByStatus).toEqual({ DELIVERED: 3, PENDING: 5 });
  });

  it('counts only collected statuses toward revenue', async () => {
    await service.getStats();

    expect(tx.order.aggregate).toHaveBeenCalledWith({
      where: { status: { in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED] } },
      _sum: { total: true },
    });
  });

  it('reports revenue in minor units when orders exist', async () => {
    tx.order.aggregate.mockResolvedValue({ _sum: { total: 125000 } });

    const stats = await service.getStats();

    expect(stats.revenue.collected).toBe(125000);
    expect(stats.revenue.currency).toBe('usd');
  });

  it('reports zero revenue rather than null on an empty database', async () => {
    tx.order.aggregate.mockResolvedValue({ _sum: { total: null } });

    const stats = await service.getStats();

    expect(stats.revenue.collected).toBe(0);
  });

  it('ranks the top five vendors by units sold, descending', async () => {
    await service.getStats();

    expect(tx.orderItem.groupBy).toHaveBeenCalledWith({
      by: ['vendorId'],
      _sum: { quantity: true },
      _count: { _all: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    });
  });

  it('flattens the vendor groupBy rows into units sold and line item counts', async () => {
    tx.orderItem.groupBy.mockResolvedValue([
      { vendorId: 'v1', _sum: { quantity: 40 }, _count: { _all: 6 } },
      { vendorId: 'v2', _sum: { quantity: null }, _count: { _all: 1 } },
    ]);

    const stats = await service.getStats();

    expect(stats.topVendors).toEqual([
      { vendorId: 'v1', unitsSold: 40, lineItems: 6 },
      { vendorId: 'v2', unitsSold: 0, lineItems: 1 },
    ]);
  });
});
