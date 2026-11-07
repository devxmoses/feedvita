import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

// bcrypt is mocked so these tests do not pay ~85ms per compare, and so the
// "did we compare at all?" assertions below are observable.
jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
import * as bcrypt from 'bcrypt';
const compare = bcrypt.compare as unknown as jest.Mock;

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  let users: { findByEmailWithPassword: jest.Mock; findOne: jest.Mock };
  let prisma: { refreshToken: Record<string, jest.Mock> };
  let jwt: { sign: jest.Mock; verify: jest.Mock };

  const STORED_USER = {
    id: 'u1',
    email: 'customer@test.com',
    name: 'Customer',
    passwordHash: '$2b$10$realhashforcustomeraccountxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    isAdmin: false,
    isVendor: false,
  };

  beforeEach(async () => {
    users = { findByEmailWithPassword: jest.fn(), findOne: jest.fn() };
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwt = {
      // distinguish the two tokens by which secret was asked for
      sign: jest.fn((_payload, opts) =>
        opts.secret === 'access-secret' ? 'ACCESS.TOKEN' : 'REFRESH.TOKEN',
      ),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) =>
              k === 'JWT_SECRET' ? 'access-secret' : 'refresh-secret',
            ),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateUser', () => {
    it('returns the user without the password hash on a correct password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(STORED_USER);
      compare.mockResolvedValue(true);

      const result = await service.validateUser('customer@test.com', 'correct');

      expect(result).toEqual({
        id: 'u1', email: 'customer@test.com', name: 'Customer', isAdmin: false, isVendor: false,
      });
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null on a wrong password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(STORED_USER);
      compare.mockResolvedValue(false);

      await expect(service.validateUser('customer@test.com', 'wrong')).resolves.toBeNull();
    });

    it('returns null for an email with no account', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      compare.mockResolvedValue(false);

      await expect(service.validateUser('nobody@test.com', 'any')).resolves.toBeNull();
    });

    // Returning early for an unknown email skips bcrypt entirely, and the ~85ms
    // difference tells an attacker which addresses are registered.
    it('still spends a bcrypt compare on an unknown email', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      compare.mockResolvedValue(false);

      await service.validateUser('nobody@test.com', 'any');

      expect(compare).toHaveBeenCalledTimes(1);
      expect(compare).toHaveBeenCalledWith('any', expect.stringMatching(/^\$2[aby]\$10\$/));
    });

    it('does not compare against the real hash when there is no user', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      compare.mockResolvedValue(false);

      await service.validateUser('nobody@test.com', 'any');

      expect(compare).not.toHaveBeenCalledWith('any', STORED_USER.passwordHash);
    });
  });

  describe('login', () => {
    const USER = { id: 'u1', email: 'customer@test.com', isAdmin: false, isVendor: true };

    it('returns both tokens', async () => {
      await expect(service.login(USER)).resolves.toEqual({
        access_token: 'ACCESS.TOKEN',
        refresh_token: 'REFRESH.TOKEN',
      });
    });

    it('puts the role flags in the access token so guards can read them', async () => {
      await service.login(USER);

      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'u1', email: 'customer@test.com', isAdmin: false, isVendor: true },
        { secret: 'access-secret', expiresIn: '15m' },
      );
    });

    // A refresh token carrying role flags would let a demoted admin keep minting
    // admin access tokens for 7 days. It must carry nothing but the subject.
    it('puts nothing but the subject in the refresh token', async () => {
      await service.login(USER);

      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: 'u1' },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );
    });

    it('stores a sha256 hash of the refresh token, never the token itself', async () => {
      await service.login(USER);

      const { data } = prisma.refreshToken.create.mock.calls[0][0];
      expect(data.tokenHash).toBe(sha256('REFRESH.TOKEN'));
      expect(data.tokenHash).not.toBe('REFRESH.TOKEN');
      expect(data.userId).toBe('u1');
      expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('refresh', () => {
    const ROW = { id: 'rt1', userId: 'u1', expiresAt: new Date(Date.now() + 60_000) };

    beforeEach(() => {
      jwt.verify.mockReturnValue({ sub: 'u1' });
      users.findOne.mockResolvedValue({
        id: 'u1', email: 'customer@test.com', isAdmin: false, isVendor: false,
      });
    });

    it('rejects a missing token', async () => {
      await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a token that does not verify', async () => {
      jwt.verify.mockImplementation(() => { throw new Error('bad signature'); });

      await expect(service.refresh('forged')).rejects.toThrow(/Invalid refresh token/);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('looks the token up by its hash, not its plaintext', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(ROW);

      await service.refresh('REFRESH.TOKEN');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('REFRESH.TOKEN') },
      });
    });

    it('rotates the token and returns a fresh pair', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(ROW);

      await expect(service.refresh('REFRESH.TOKEN')).resolves.toEqual({
        access_token: 'ACCESS.TOKEN',
        refresh_token: 'REFRESH.TOKEN',
      });

      // the presented token is consumed...
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'rt1' } });
      // ...and a replacement row is written
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    // A verified JWT with no matching row can only mean it was already redeemed.
    it('treats a verified token with no row as reuse and drops every session', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('REFRESH.TOKEN')).rejects.toThrow(/reuse detected/);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    // Ageing out is not an attack - signing the user out on every device for it
    // is the bug this test pins.
    it('retires only the one row when the token has merely expired', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...ROW, expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.refresh('REFRESH.TOKEN')).rejects.toThrow(/expired/);

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { id: 'rt1' } });
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
    });

    // Two requests racing with the same token: the DELETE matches for one of them
    // and matches nothing for the other. The loser must get 401, not a 404 from P2025.
    it('treats losing the consume race as reuse', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(ROW);
      prisma.refreshToken.deleteMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.refresh('REFRESH.TOKEN')).rejects.toThrow(/reuse detected/);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('never calls the throwing delete(), which would surface as a 404', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(ROW);

      await service.refresh('REFRESH.TOKEN');

      expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('rejects a missing token', async () => {
      await expect(service.logout('')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes by hash and reports success', async () => {
      await expect(service.logout('REFRESH.TOKEN')).resolves.toEqual({ success: true });

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('REFRESH.TOKEN') },
      });
    });

    // deleteMany matches nothing without throwing, so logging out twice is safe.
    it('is safe to call with a token that is already gone', async () => {
      prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('REFRESH.TOKEN')).resolves.toEqual({ success: true });
    });
  });
});
