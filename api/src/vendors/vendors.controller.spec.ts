import { Test, TestingModule } from '@nestjs/testing';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../prisma/prisma.service';

const asRequest = (id: string) => ({ user: { id } }) as any;

describe('VendorsController', () => {
  let controller: VendorsController;
  let service: { create: jest.Mock };

  beforeEach(async () => {
    service = { create: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VendorsController],
      providers: [
        { provide: VendorsService, useValue: service },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(VendorsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('makes the authenticated user the owner of a new vendor', async () => {
    const dto = { name: 'Green Valley Nutrition' } as any;

    await controller.create(asRequest('user-1'), dto);

    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });
});
