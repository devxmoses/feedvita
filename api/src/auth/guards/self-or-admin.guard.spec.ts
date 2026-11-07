import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SelfOrAdminGuard } from './self-or-admin.guard';

const ctx = (request: unknown) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;

describe('SelfOrAdminGuard', () => {
  let guard: SelfOrAdminGuard;

  beforeEach(() => {
    guard = new SelfOrAdminGuard();
  });

  it('lets a user act on their own account', () => {
    expect(guard.canActivate(ctx({ user: { id: 'u1' }, params: { id: 'u1' } }))).toBe(true);
  });

  it('lets an admin act on anybody', () => {
    expect(
      guard.canActivate(ctx({ user: { id: 'admin', isAdmin: true }, params: { id: 'u1' } })),
    ).toBe(true);
  });

  it("refuses a user acting on somebody else's account", () => {
    expect(() =>
      guard.canActivate(ctx({ user: { id: 'u2', isAdmin: false }, params: { id: 'u1' } })),
    ).toThrow(ForbiddenException);
  });

  // isAdmin must be read as a positive grant, not the absence of a denial - an
  // inverted check here would hand every non-admin somebody else's account.
  it('does not treat a falsy isAdmin as permission', () => {
    expect(() =>
      guard.canActivate(ctx({ user: { id: 'u2', isAdmin: undefined }, params: { id: 'u1' } })),
    ).toThrow(ForbiddenException);
  });

  it('refuses when no user is attached to the request', () => {
    expect(guard.canActivate(ctx({ params: { id: 'u1' } }))).toBe(false);
  });

  it("reads the id from params.id, matching @Param('id')", () => {
    // a guard reading the wrong param name silently permits everything
    expect(() =>
      guard.canActivate(ctx({ user: { id: 'u1' }, params: { userId: 'u1' } })),
    ).toThrow(ForbiddenException);
  });
});
