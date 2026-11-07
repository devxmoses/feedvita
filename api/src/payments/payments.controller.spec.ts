import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

const asRequest = (id: string) => ({ user: { id } }) as any;

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: { createIntent: jest.Mock; handleWebhookEvent: jest.Mock };

  beforeEach(async () => {
    service = { createIntent: jest.fn(), handleWebhookEvent: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: service }],
    }).compile();
    controller = module.get(PaymentsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('opens a payment intent for the authenticated user and the requested order', async () => {
    await controller.createIntent(asRequest('user-1'), { orderId: 'order-1' });

    expect(service.createIntent).toHaveBeenCalledWith('user-1', 'order-1');
  });

  // Stripe signs the exact bytes it sent, so the handler must forward req.rawBody.
  // Passing req.body (the parsed JSON) would break signature verification entirely.
  it('forwards the raw body and signature header, not the parsed body', async () => {
    const rawBody = Buffer.from('{"id":"evt_1"}');
    const req = { rawBody, body: { id: 'evt_1' } } as any;

    await controller.handleWebhook(req, 'sig_header');

    expect(service.handleWebhookEvent).toHaveBeenCalledWith('sig_header', rawBody);
  });
});
