import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

// `@Request() req` is untyped, so req.user.id / req.user.sub / req.user.userId all
// type-check identically and only one of them is what JwtStrategy.validate returns.
// These tests pin that wiring, which is the one thing tsc cannot see here.
const asRequest = (id: string) => ({ user: { id } }) as any;

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: { create: jest.Mock; findAllForBuyer: jest.Mock };

  beforeEach(async () => {
    service = { create: jest.fn(), findAllForBuyer: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: service },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(OrdersController);
  });

  afterEach(() => jest.clearAllMocks());

  it('checks out as the authenticated user', async () => {
    await controller.create(asRequest('user-1'));

    expect(service.create).toHaveBeenCalledWith('user-1');
  });

  it('lists only the authenticated user own orders', async () => {
    await controller.findAllForBuyer(asRequest('user-1'));

    expect(service.findAllForBuyer).toHaveBeenCalledWith('user-1');
  });
});
