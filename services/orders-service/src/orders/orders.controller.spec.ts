import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const codeOf = (err: unknown) => (err as RpcException).getError() as { code: number };

describe('OrdersController (gRPC handlers)', () => {
  let service: { create: any; findById: any; findAll: any };
  let controller: OrdersController;

  beforeEach(() => {
    service = {
      create: mock.fn(async () => ({ id: 'o-1' })),
      findById: mock.fn(() => undefined),
      findAll: mock.fn(() => []),
    };
    controller = new OrdersController(service as unknown as OrdersService);
  });

  it('rejects an order with no items as INVALID_ARGUMENT before touching the service', async () => {
    await assert.rejects(controller.createOrder({ userId: 'u-1', items: [] }), (err) => {
      assert.equal(codeOf(err).code, GrpcStatus.INVALID_ARGUMENT);
      return true;
    });
    assert.equal(service.create.mock.callCount(), 0);
  });

  it('GetOrder on an unknown id throws NOT_FOUND', () => {
    assert.throws(
      () => controller.getOrder({ id: 'missing' }),
      (err) => codeOf(err).code === GrpcStatus.NOT_FOUND,
    );
  });

  it('ListOrders treats an empty-string userId (proto3 default) as "no filter"', () => {
    controller.listOrders({ userId: '' });

    assert.deepEqual(service.findAll.mock.calls[0].arguments, [undefined]);
  });
});
