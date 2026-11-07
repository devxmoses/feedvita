import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { VendorOwnerToProductGuard } from './vendor-owner.-to-product.guard';
import { PrismaService } from '../../prisma/prisma.service';

const contextFor = (request: Record<string, unknown>) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;

describe('VendorOwnerToProductGuard', () => {
  let guard: VendorOwnerToProductGuard;
  let prisma: { vendor: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { vendor: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [VendorOwnerToProductGuard, { provide: PrismaService, useValue: prisma }],
    }).compile();
    guard = module.get(VendorOwnerToProductGuard);
  });

  afterEach(() => jest.clearAllMocks());

  it('denies an unauthenticated request', async () => {
    await expect(guard.canActivate(contextFor({ body: { vendorId: 'v1' } }))).resolves.toBe(false);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('lets an admin through without a vendor lookup', async () => {
    const ctx = contextFor({ user: { id: 'u1', isAdmin: true }, body: { vendorId: 'v1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a body with no vendorId rather than querying for undefined', async () => {
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, body: {} });

    await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException);
    expect(prisma.vendor.findUnique).not.toHaveBeenCalled();
  });

  // Regression: this guard reads the vendor id off the BODY, not the route params,
  // because at create time the product does not exist yet.
  it('resolves ownership from body.vendorId and lets the owner through', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'u1' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, body: { vendorId: 'v1' } });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.vendor.findUnique).toHaveBeenCalledWith({
      where: { id: 'v1' },
      select: { ownerId: true },
    });
  });

  it('forbids listing a product under a vendor you do not own', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ ownerId: 'someone-else' });
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, body: { vendorId: 'v1' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('404s when the vendor in the body does not exist', async () => {
    prisma.vendor.findUnique.mockResolvedValue(null);
    const ctx = contextFor({ user: { id: 'u1', isAdmin: false }, body: { vendorId: 'gone' } });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });
});
