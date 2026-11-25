import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController (gRPC handlers)', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  it('CreateUser then GetUser returns the same record', () => {
    const created = controller.createUser({ name: 'Ana', email: 'ana@example.com' });

    assert.deepEqual(controller.getUser({ id: created.id }), created);
  });

  it('GetUser on an unknown id throws a gRPC NOT_FOUND (not a generic error)', () => {
    assert.throws(
      () => controller.getUser({ id: 'missing' }),
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        assert.deepEqual(err.getError(), {
          code: GrpcStatus.NOT_FOUND,
          message: 'User missing not found',
        });
        return true;
      },
    );
  });

  it('ListUsers wraps the result in { users } to match the proto message', () => {
    controller.createUser({ name: 'Ana', email: 'ana@example.com' });

    const result = controller.listUsers();

    assert.deepEqual(Object.keys(result), ['users']);
    assert.equal(result.users.length, 1);
  });
});
