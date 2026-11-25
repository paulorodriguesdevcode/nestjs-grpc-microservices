/**
 * HTTP-level tests for the gateway: the real AppModule, ValidationPipe and
 * GrpcExceptionFilter, with only the two downstream gRPC clients replaced.
 * This is what proves the gateway's contract with REST callers — status
 * codes, validation and error translation — without running other services.
 */
import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { AppModule } from './app.module';
import { GrpcExceptionFilter } from './filters/grpc-exception.filter';

const USER_ID = '7f1d3c2e-9a4b-4c6d-8e2f-1a2b3c4d5e6f';
const USER = { id: USER_ID, name: 'Ana', email: 'ana@example.com', createdAt: '2026-01-01T00:00:00.000Z' };

const users = {
  createUser: mock.fn((data: { name: string; email: string }) => of({ ...USER, ...data })),
  getUser: mock.fn((_: { id: string }) => of(USER)),
  listUsers: mock.fn(() => of({ users: [USER] })),
};
const orders = {
  createOrder: mock.fn((data: any) => of({ id: 'o-1', status: 'created', total: 19.98, ...data })),
  getOrder: mock.fn((_: { id: string }) => of({ id: 'o-1' })),
  listOrders: mock.fn((_: { userId?: string }) => of({ orders: [] })),
};
const asClient = (svc: object) => ({ getService: () => svc });

describe('api-gateway HTTP contract', () => {
  let app: INestApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider('USERS_PACKAGE')
      .useValue(asClient(users))
      .overrideProvider('ORDERS_PACKAGE')
      .useValue(asClient(orders))
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    // Same global setup as main.ts.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new GrpcExceptionFilter());
    await app.init();
  });

  after(() => app.close());

  beforeEach(() => {
    for (const fn of [...Object.values(users), ...Object.values(orders)]) fn.mock.resetCalls();
  });

  it('GET /health is up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    assert.deepEqual(res.body, { status: 'ok', service: 'api-gateway' });
  });

  it('POST /users forwards a valid body to users-service', async () => {
    const res = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Ana', email: 'ana@example.com' })
      .expect(201);

    assert.equal(res.body.id, USER_ID);
    assert.deepEqual(users.createUser.mock.calls[0].arguments[0], { name: 'Ana', email: 'ana@example.com' });
  });

  it('POST /users rejects an invalid email with 400 and never calls gRPC', async () => {
    await request(app.getHttpServer()).post('/users').send({ name: 'Ana', email: 'nope' }).expect(400);
    assert.equal(users.createUser.mock.callCount(), 0);
  });

  it('POST /users rejects unknown fields (whitelist + forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Ana', email: 'ana@example.com', isAdmin: true })
      .expect(400);
  });

  it('GET /users/:id turns a downstream gRPC NOT_FOUND into HTTP 404', async () => {
    users.getUser.mock.mockImplementationOnce(() =>
      throwError(() => ({ code: GrpcStatus.NOT_FOUND, details: 'User x not found' })),
    );

    const res = await request(app.getHttpServer()).get('/users/x').expect(404);
    assert.deepEqual(res.body, { statusCode: 404, message: 'User x not found' });
  });

  it('GET /users/:id turns UNAVAILABLE into 503 instead of a generic 500', async () => {
    users.getUser.mock.mockImplementationOnce(() =>
      throwError(() => ({ code: GrpcStatus.UNAVAILABLE, details: 'connection refused' })),
    );

    await request(app.getHttpServer()).get('/users/x').expect(503);
  });

  it('GET /users unwraps the { users } proto envelope into a plain array', async () => {
    const res = await request(app.getHttpServer()).get('/users').expect(200);
    assert.ok(Array.isArray(res.body));
  });

  it('POST /orders validates nested items', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ userId: USER_ID, items: [{ productName: 'Widget', quantity: -1, unitPrice: 9.99 }] })
      .expect(400);
    await request(app.getHttpServer()).post('/orders').send({ userId: USER_ID, items: [] }).expect(400);
    await request(app.getHttpServer())
      .post('/orders')
      .send({ userId: 'not-a-uuid', items: [{ productName: 'Widget', quantity: 1, unitPrice: 1 }] })
      .expect(400);

    assert.equal(orders.createOrder.mock.callCount(), 0);
  });

  it('POST /orders forwards a valid order', async () => {
    const body = { userId: USER_ID, items: [{ productName: 'Widget', quantity: 2, unitPrice: 9.99 }] };

    const res = await request(app.getHttpServer()).post('/orders').send(body).expect(201);

    assert.equal(res.body.id, 'o-1');
    assert.deepEqual(orders.createOrder.mock.calls[0].arguments[0], body);
  });

  it('GET /orders?userId= passes the filter through', async () => {
    await request(app.getHttpServer()).get(`/orders?userId=${USER_ID}`).expect(200);
    assert.deepEqual(orders.listOrders.mock.calls[0].arguments[0], { userId: USER_ID });
  });
});
