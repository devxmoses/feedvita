import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: {
            user: { count: jest.fn() },
            vendor: { count: jest.fn() },
            product: { count: jest.fn() },
            order: { count: jest.fn(), groupBy: jest.fn(), aggregate: jest.fn() },
            review: { count: jest.fn() },
            orderItem: { groupBy: jest.fn() },
            $transaction: jest.fn((cb) => cb({})),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
