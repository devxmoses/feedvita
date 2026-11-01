import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
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

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
