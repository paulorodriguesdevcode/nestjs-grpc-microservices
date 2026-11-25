import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import { OrdersService } from './orders.service';

/** Builds a ClientGrpc whose getService() returns the given fake client. */
const fakeGrpc = (client: object) => ({ getService: () => client }) as unknown as ClientGrpc;

const USER = { id: 'u-1', name: 'Ana', email: 'ana@example.com', createdAt: '' };
const ITEMS = [
  { productName: 'Widget', quantity: 2, unitPrice: 9.99 },
  { productName: 'Gadget', quantity: 1, unitPrice: 5 },
];

describe('OrdersService', () => {
  let getUser: ReturnType<typeof mock.fn>;
  let sendNotification: ReturnType<typeof mock.fn>;
  let service: OrdersService;

  beforeEach(() => {
    mock.restoreAll();
    mock.method(Logger.prototype, 'log', () => undefined);
    mock.method(Logger.prototype, 'warn', () => undefined);

    getUser = mock.fn(() => of(USER));
    sendNotification = mock.fn(() => of({ id: 'n-1', status: 'sent' }));

    service = new OrdersService(fakeGrpc({ getUser }), fakeGrpc({ sendNotification }));
    service.onModuleInit();
  });

  it('validates the user over gRPC, computes the total and stores the order', async () => {
    const order = await service.create('u-1', ITEMS);

    assert.deepEqual(getUser.mock.calls[0].arguments, [{ id: 'u-1' }]);
    assert.equal(order.total, 2 * 9.99 + 5);
    assert.equal(order.status, 'created');
    assert.deepEqual(service.findById(order.id), order);
  });

  it('sends a confirmation notification for the created order', async () => {
    const order = await service.create('u-1', ITEMS);

    const [payload] = sendNotification.mock.calls[0].arguments as [any];
    assert.equal(payload.userId, 'u-1');
    assert.equal(payload.channel, 'email');
    assert.ok(payload.message.includes(order.id));
  });

  it('maps a downstream NOT_FOUND to NOT_FOUND and does not persist anything', async () => {
    getUser.mock.mockImplementation(() =>
      throwError(() => ({ code: GrpcStatus.NOT_FOUND, details: 'nope' })),
    );

    await assert.rejects(service.create('ghost', ITEMS), (err: unknown) => {
      assert.ok(err instanceof RpcException);
      assert.equal((err.getError() as any).code, GrpcStatus.NOT_FOUND);
      return true;
    });
    assert.equal(service.findAll().length, 0);
    assert.equal(sendNotification.mock.callCount(), 0);
  });

  it('maps any other users-service failure to UNAVAILABLE', async () => {
    getUser.mock.mockImplementation(() =>
      throwError(() => ({ code: GrpcStatus.DEADLINE_EXCEEDED, message: 'timeout' })),
    );

    await assert.rejects(service.create('u-1', ITEMS), (err: unknown) => {
      assert.ok(err instanceof RpcException);
      assert.equal((err.getError() as any).code, GrpcStatus.UNAVAILABLE);
      return true;
    });
  });

  it('keeps the order when the notification call fails (best-effort, not one transaction)', async () => {
    sendNotification.mock.mockImplementation(() =>
      throwError(() => ({ code: GrpcStatus.UNAVAILABLE, message: 'down' })),
    );

    const order = await service.create('u-1', ITEMS);

    assert.deepEqual(service.findById(order.id), order);
  });

  it('filters orders by user when a userId is given', async () => {
    await service.create('u-1', ITEMS);
    await service.create('u-2', ITEMS);

    assert.equal(service.findAll().length, 2);
    assert.deepEqual(
      service.findAll('u-2').map((o) => o.userId),
      ['u-2'],
    );
  });
});
