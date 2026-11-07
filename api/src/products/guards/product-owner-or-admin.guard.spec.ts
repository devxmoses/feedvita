import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProductOwnerOrAdminGuard } from './product-owner-or-admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe('ProductOwnerOrAdminGuard', () => {
  let guard: ProductOwnerOrAdminGuard;
  let prisma: { product: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductOwnerOrAdminGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = module.get(ProductOwnerOrAdminGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('denies an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor({ params: { id: 'p1' } }))).resolves.toBe(false);
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  it('lets an admin through without a product lookup', async () => {
    const ctx = contextFor({ user: { id: 'u1', isAdmin: true }, params: { id: 'p1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.product.findUnique).not.toHaveBeenCalled();
  });

  // Ownership here is transitive: the product's owner is whoever owns its vendor,
  // so the query must select through the vendor relation.
  it('resolves ownership through the product vendor relation', async () => {
    prisma.product.findUnique.mockResolvedValue({ vendor: { ownerId: 'u1' } });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'p1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
      select: { vendor: { select: { ownerId: true } } },
    });
  });

  it("forbids editing a product belonging to somebody else's vendor", async () => {
    prisma.product.findUnique.mockResolvedValue({ vendor: { ownerId: 'someone-else' } });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'p1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // Regression: a missing await here once made `product` a pending promise, so the
  // null check never fired and `product.vendor.ownerId` threw a bare 500 instead.
  it('404s when the product does not exist, rather than throwing on undefined', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'gone' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
