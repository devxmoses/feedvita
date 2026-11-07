import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({ hash: jest.fn(), compare: jest.fn() }));
import * as bcrypt from 'bcrypt';
const hash = bcrypt.hash as unknown as jest.Mock;

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: Record<string, jest.Mock> };

  const ROW = {
    id: 'u1',
    email: 'farmer@test.com',
    name: 'Farmer',
    passwordHash: 'HASHED',
    isAdmin: false,
    isVendor: false,
  };
  const SAFE = {
    id: 'u1', email: 'farmer@test.com', name: 'Farmer', isAdmin: false, isVendor: false,
  };

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn().mockResolvedValue(ROW),
        findMany: jest.fn().mockResolvedValue([ROW, { ...ROW, id: 'u2' }]),
        findUnique: jest.fn().mockResolvedValue(ROW),
        update: jest.fn().mockResolvedValue(ROW),
        delete: jest.fn().mockResolvedValue(ROW),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsersService);
    hash.mockResolvedValue('HASHED');
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('hashes the password at cost 10 and stores no plaintext', async () => {
      await service.create({ email: 'farmer@test.com', password: 'secret123', name: 'Farmer' });

      expect(hash).toHaveBeenCalledWith('secret123', 10);

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.passwordHash).toBe('HASHED');
      expect(data).not.toHaveProperty('password');
      expect(JSON.stringify(data)).not.toContain('secret123');
    });

    it('returns the user without the password hash', async () => {
      await expect(
        service.create({ email: 'farmer@test.com', password: 'secret123', name: 'Farmer' }),
      ).resolves.toEqual(SAFE);
    });
  });

  describe('findAll', () => {
    it('strips the password hash from every row', async () => {
      const result = await service.findAll();

      expect(result).toHaveLength(2);
      for (const user of result) {
        expect(user).not.toHaveProperty('passwordHash');
      }
    });
  });

  describe('findOne', () => {
    it('returns the user without the password hash', async () => {
      await expect(service.findOne('u1')).resolves.toEqual(SAFE);
    });

    it('throws 404 when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    // without this the update would hit Prisma and raise P2025, which the global
    // filter does map to 404 - but only by accident, and with no message
    it('checks the user exists before updating', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.update('nope', { name: 'X' })).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('strips the password hash from the updated user', async () => {
      await expect(service.update('u1', { name: 'Farmer' })).resolves.toEqual(SAFE);
    });
  });

  describe('remove', () => {
    it('strips the password hash from the deleted user', async () => {
      await expect(service.remove('u1')).resolves.toEqual(SAFE);
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });

  describe('findByEmailWithPassword', () => {
    // the one method that must return the hash - AuthService needs it to compare
    it('returns the row with its hash intact', async () => {
      await expect(service.findByEmailWithPassword('farmer@test.com')).resolves.toEqual(ROW);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'farmer@test.com' },
      });
    });

    it('returns null for an unknown email rather than throwing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findByEmailWithPassword('nobody@test.com')).resolves.toBeNull();
    });
  });
});
