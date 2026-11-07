import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma/prisma.service';

const asRequest = (id: string) => ({ user: { id } }) as any;

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: { create: jest.Mock };

  beforeEach(async () => {
    service = { create: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: service },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(ReviewsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('attributes a new review to the authenticated user', async () => {
    const dto = { productId: 'p1', rating: 5 } as any;

    await controller.create(asRequest('user-1'), dto);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });
});
