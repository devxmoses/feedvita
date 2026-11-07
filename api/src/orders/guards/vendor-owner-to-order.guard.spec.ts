import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VendorOwnerToOrderGuard } from './vendor-owner-to-order.guard';
import { PrismaService } from '../../prisma/prisma.service';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe('VendorOwnerToOrderGuard', () => {
  let guard: VendorOwnerToOrderGuard;
  let prisma: { vendor: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { vendor: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorOwnerToOrderGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = module.get(VendorOwnerToOrderGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('denies an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor({ params: { vendorId: 'v1' } }))).resolves.toBe(false);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('lets an admin through without a vendor lookup', async () => {
    const ctx = contextFor({ user: { id: 'u1', isAdmin: true }, params: { vendorId: 'v1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('lets the vendor owner through (regression: non-admins must not be rejected outright)', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'u1' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { vendorId: 'v1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('looks the vendor up by params.vendorId, not params.id', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'u1' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { vendorId: 'v1' } });

    await guard.canActivate(ctx);

    expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: { ownerId: true },
    });
  });

  it('forbids a signed-in user who does not own the vendor', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'someone-else' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { vendorId: 'v1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('404s when the vendor does not exist', async () => {
    prisma.vendor.findUnique.mockResolvedValue(null);
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { vendorId: 'gone' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
