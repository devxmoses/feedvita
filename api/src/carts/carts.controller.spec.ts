import { Test, TestingModule } from '@nestjs/testing';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';

const asRequest = (id: string) => ({ user: { id } }) as any;

describe('CartsController', () => {
  let controller: CartsController;
  let service: {
    getCart: jest.Mock;
    addItem: jest.Mock;
    updateItem: jest.Mock;
    removeItem: jest.Mock;
    clearCart: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getCart: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [{ provide: CartsService, useValue: service }],
    }).compile();
    controller = module.get(CartsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('reads the authenticated user cart', async () => {
    await controller.getCart(asRequest('user-1'));

    expect(service.getCart).toHaveBeenCalledWith('user-1');
  });

  it('adds to the authenticated user cart', async () => {
    const dto = { productId: 'p1', quantity: 2 };

    await controller.addItem(asRequest('user-1'), dto);

    expect(service.addItem).toHaveBeenCalledWith('user-1', dto);
  });

  it('updates a line item in the authenticated user cart', async () => {
    const dto = { quantity: 5 };

    await controller.updateItem(asRequest('user-1'), 'p1', dto);

    expect(service.updateItem).toHaveBeenCalledWith('user-1', 'p1', dto);
  });

  it('removes a line item from the authenticated user cart', async () => {
    await controller.removeItem(asRequest('user-1'), 'p1');

    expect(service.removeItem).toHaveBeenCalledWith('user-1', 'p1');
  });

  it('clears the authenticated user cart', async () => {
    await controller.clearCart(asRequest('user-1'));

    expect(service.clearCart).toHaveBeenCalledWith('user-1');
  });
});
