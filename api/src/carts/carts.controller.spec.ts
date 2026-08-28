import { Test, TestingModule } from '@nestjs/testing';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CartsController', () => {
  let controller: CartsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [
              CartsService,
              {
                provide:PrismaService,
                useValue:{
                  cart:{
                    upsert: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                  },
                  cartItem:{
                    upsert: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                    deleteMany: jest.fn(),
                  }
                }
              }
            ],
    }).compile();

    controller = module.get<CartsController>(CartsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
