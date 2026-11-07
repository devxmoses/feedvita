import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { VendorOwnerOrAdminGuard } from './vendor-owner-or-admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe('VendorOwnerOrAdminGuard', () => {
  let guard: VendorOwnerOrAdminGuard;
  let prisma: { vendor: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { vendor: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorOwnerOrAdminGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = module.get(VendorOwnerOrAdminGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('denies an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor({ params: { id: 'v1' } }))).resolves.toBe(false);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('lets an admin through without a vendor lookup', async () => {
    const ctx = contextFor({ user: { id: 'u1', isAdmin: true }, params: { id: 'v1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  // Regression: an inverted admin check here once turned "owner or admin" into
  // "admin only", silently locking every vendor out of their own storefront.
  it('lets the owner through even though they are not an admin', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'u1' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'v1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: { ownerId: true },
    });
  });

  it('forbids a signed-in user who does not own the vendor', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'someone-else' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'v1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('404s when the vendor does not exist', async () => {
    prisma.vendor.findUnique.mockResolvedValue(null);
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, params: { id: 'gone' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
