/**
 * End-to-end system test.
 *
 * Starts the four real, built services as separate processes on free ports,
 * talking real gRPC over the real .proto contracts, and drives them only
 * through the gateway's public REST API — the same way a client would.
 *
 * Unit tests mock the gRPC boundary; this is the test that proves the
 * boundary itself works (proto field names, packages, error codes crossing
 * two hops). Run `npm run build` in every service first.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const procs = [];
const logs = new Map();

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

function start(name, env) {
  const child = spawn(process.execPath, [join(root, 'services', name, 'dist', 'main.js')], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  logs.set(name, '');
  const capture = (chunk) => logs.set(name, logs.get(name) + chunk);
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  procs.push(child);
  return child;
}

async function waitForHealth(name, port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${name} did not become healthy on :${port}\n${logs.get(name)}`);
}

let api;

before(async () => {
  const [usersGrpc, usersHttp, notifGrpc, notifHttp, ordersGrpc, ordersHttp, gatewayHttp] =
    await Promise.all(Array.from({ length: 7 }, freePort));

  start('users-service', { GRPC_PORT: usersGrpc, HTTP_PORT: usersHttp });
  start('notifications-service', { GRPC_PORT: notifGrpc, HTTP_PORT: notifHttp });
  start('orders-service', {
    GRPC_PORT: ordersGrpc,
    HTTP_PORT: ordersHttp,
    USERS_SERVICE_URL: `127.0.0.1:${usersGrpc}`,
    NOTIFICATIONS_SERVICE_URL: `127.0.0.1:${notifGrpc}`,
  });
  start('api-gateway', {
    HTTP_PORT: gatewayHttp,
    USERS_SERVICE_URL: `127.0.0.1:${usersGrpc}`,
    ORDERS_SERVICE_URL: `127.0.0.1:${ordersGrpc}`,
  });

  await Promise.all([
    waitForHealth('users-service', usersHttp),
    waitForHealth('notifications-service', notifHttp),
    waitForHealth('orders-service', ordersHttp),
    waitForHealth('api-gateway', gatewayHttp),
  ]);

  api = async (method, path, body) => {
    const res = await fetch(`http://127.0.0.1:${gatewayHttp}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  api.metrics = (port) => fetch(`http://127.0.0.1:${port}/metrics`).then((r) => r.text());
  api.ports = { usersHttp, ordersHttp, gatewayHttp };
});

after(() => {
  for (const p of procs) p.kill('SIGTERM');
});

test('creates a user and reads it back through two hops (REST -> gRPC)', async () => {
  const created = await api('POST', '/users', { name: 'Ana', email: 'ana@example.com' });
  assert.equal(created.status, 201);
  assert.match(created.body.id, /^[0-9a-f-]{36}$/);

  const fetched = await api('GET', `/users/${created.body.id}`);
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body, created.body);
});

test('creates an order: orders-service validates the user over gRPC and totals the items', async () => {
  const user = await api('POST', '/users', { name: 'Bia', email: 'bia@example.com' });

  const order = await api('POST', '/orders', {
    userId: user.body.id,
    items: [
      { productName: 'Widget', quantity: 2, unitPrice: 9.99 },
      { productName: 'Gadget', quantity: 1, unitPrice: 5 },
    ],
  });

  assert.equal(order.status, 201);
  assert.equal(order.body.userId, user.body.id);
  assert.ok(Math.abs(order.body.total - 24.98) < 1e-9);

  const list = await api('GET', `/orders?userId=${user.body.id}`);
  assert.deepEqual(
    list.body.map((o) => o.id),
    [order.body.id],
  );
});

test('an order for a non-existent user is a 404 — NOT_FOUND crosses users -> orders -> gateway', async () => {
  const res = await api('POST', '/orders', {
    userId: '00000000-0000-4000-8000-000000000000',
    items: [{ productName: 'Widget', quantity: 1, unitPrice: 1 }],
  });

  assert.equal(res.status, 404);
  assert.match(res.body.message, /not found/i);
});

test('order creation is unaffected by notification outcomes (~10% are failed on purpose)', async () => {
  const user = await api('POST', '/users', { name: 'Caio', email: 'caio@example.com' });

  const results = await Promise.all(
    Array.from({ length: 30 }, () =>
      api('POST', '/orders', {
        userId: user.body.id,
        items: [{ productName: 'Widget', quantity: 1, unitPrice: 1 }],
      }),
    ),
  );

  assert.deepEqual(new Set(results.map((r) => r.status)), new Set([201]));
});

test('invalid input is rejected at the edge with 400', async () => {
  const res = await api('POST', '/users', { name: 'Ana', email: 'not-an-email' });
  assert.equal(res.status, 400);
});

test('every service exposes Prometheus metrics for the calls it handled', async () => {
  const users = await api.metrics(api.ports.usersHttp);
  const gateway = await api.metrics(api.ports.gatewayHttp);

  assert.match(users, /grpc_requests_total\{method="getUser",status="ok"\} \d+/);
  assert.match(gateway, /http_requests_total\{method="POST",route="\/orders",status="201"\} \d+/);
});
