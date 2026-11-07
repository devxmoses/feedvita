import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService webhook', () => {
  let service: PaymentsService;
  let prisma: any;
  let tx: any;
  let constructEvent: jest.Mock;

  const RAW = Buffer.from('{"id":"evt_1"}');

  beforeEach(async () => {
    tx = {
      payment: { findUnique: jest.fn(), update: jest.fn() },
      order: { update: jest.fn() },
    };
    prisma = {
      payment: { updateMany: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_x') } },
      ],
    }).compile();

    service = module.get(PaymentsService);
    // the real Stripe signature check needs a real secret and real signed bytes,
    // so the one thing we stub is the verification itself
    constructEvent = jest.fn();
    (service as any).stripe = { webhooks: { constructEvent } };
  });

  const fire = (type: string, intentId = 'pi_1') => {
    constructEvent.mockReturnValue({ type, data: { object: { id: intentId } } });
    return service.handleWebhookEvent('sig', RAW);
  };

  it('rejects a body whose signature does not verify', async () => {
    constructEvent.mockImplementation(() => { throw new Error('no match'); });

    await expect(service.handleWebhookEvent('bad', RAW)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('acknowledges a succeeded intent it has no payment row for', async () => {
    tx.payment.findUnique.mockResolvedValue(null);

    await expect(fire('payment_intent.succeeded')).resolves.toEqual({ received: true });

    expect(tx.payment.update).not.toHaveBeenCalled();
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('marks the payment succeeded and the pending order paid', async () => {
    tx.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderId: 'order-1', order: { id: 'order-1', status: 'PENDING' },
    });

    await fire('payment_intent.succeeded');

    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' }, data: { status: 'SUCCEEDED' },
    });
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' }, data: { status: 'PAID' },
    });
  });

  it('records the payment but will not revive an order the buyer cancelled', async () => {
    tx.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderId: 'order-1', order: { id: 'order-1', status: 'CANCELLED' },
    });

    await fire('payment_intent.succeeded');

    expect(tx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' }, data: { status: 'SUCCEEDED' },
    });
    // cancel() already restocked the items - PAID here would oversell
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('does not re-pay an order that is already further along', async () => {
    tx.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderId: 'order-1', order: { id: 'order-1', status: 'SHIPPED' },
    });

    await fire('payment_intent.succeeded');

    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('marks a failed intent failed without throwing on an unknown one', async () => {
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });

    await expect(fire('payment_intent.payment_failed', 'pi_ghost')).resolves.toEqual({
      received: true,
    });

    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_ghost' },
      data: { status: 'FAILED' },
    });
  });

  it('ignores event types it does not handle', async () => {
    await expect(fire('charge.refunded')).resolves.toEqual({ received: true });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
  });
});

describe('PaymentsService createIntent', () => {
  let service: PaymentsService;
  let prisma: any;
  let create: jest.Mock;

  const ORDER = { id: 'order-1', buyerId: 'user-1', status: 'PENDING', total: 9998 };

  beforeEach(async () => {
    prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(ORDER) },
      payment: { upsert: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('sk_test_x') } },
      ],
    }).compile();

    service = module.get(PaymentsService);
    create = jest.fn().mockResolvedValue({ id: 'pi_1', client_secret: 'pi_1_secret' });
    (service as any).stripe = { paymentIntents: { create } };
  });

  it('opens an intent for the order total and hands back the client secret', async () => {
    await expect(service.createIntent('user-1', 'order-1')).resolves.toEqual({
      clientSecret: 'pi_1_secret',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 9998, currency: 'usd', metadata: { orderId: 'order-1' } }),
      expect.anything(),
    );
  });

  it('keys the intent to the order so a reload cannot open a second one', async () => {
    await service.createIntent('user-1', 'order-1');

    const [, options] = create.mock.calls[0];
    expect(options).toEqual({ idempotencyKey: 'order-intent-order-1' });
  });

  it('upserts on the intent id, so a replayed intent does not collide', async () => {
    await service.createIntent('user-1', 'order-1');

    expect(prisma.payment.upsert).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_1' },
      update: {},
      create: {
        orderId: 'order-1',
        stripePaymentIntentId: 'pi_1',
        amount: 9998,
        currency: 'usd',
      },
    });
  });

  it('writes exactly one row when the buyer asks twice', async () => {
    await service.createIntent('user-1', 'order-1');
    await service.createIntent('user-1', 'order-1');

    // Stripe replays pi_1 for the repeated key, so both upserts target the same row
    expect(prisma.payment.upsert).toHaveBeenCalledTimes(2);
    const ids = prisma.payment.upsert.mock.calls.map(
      (c: any[]) => c[0].where.stripePaymentIntentId,
    );
    expect(new Set(ids).size).toBe(1);
  });

  it('refuses an order that does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(service.createIntent('user-1', 'nope')).rejects.toThrow(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses to open an intent on somebody else's order", async () => {
    await expect(service.createIntent('stranger', 'order-1')).rejects.toThrow(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
  });

  it('refuses an order that is no longer pending', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...ORDER, status: 'PAID' });

    await expect(service.createIntent('user-1', 'order-1')).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });
});
