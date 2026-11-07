import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderOwnerOrAdminGuard } from './order-owner-or-admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe('OrderOwnerOrAdminGuard', () => {
  let guard: OrderOwnerOrAdminGuard;
  let prisma: { order: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { order: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderOwnerOrAdminGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = module.get(OrderOwnerOrAdminGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('denies an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor({ params: { id: 'o1' } }))).resolves.toBe(false);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('lets an admin through without an order lookup', async () => {
    const ctx = contextFor({ user: { id: 'u1', isAdmin: true }, params: { id: 'o1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('lets the buyer through for their own order', async () => {
    prisma.order.findUnique.mockResolvedValue({ buyerId: 'u1' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'o1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 'o1' },
      select: { buyerId: true },
    });
  });

  it("forbids a user reaching for somebody else's order", async () => {
    prisma.order.findUnique.mockResolvedValue({ buyerId: 'someone-else' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'o1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('404s when the order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'gone' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
