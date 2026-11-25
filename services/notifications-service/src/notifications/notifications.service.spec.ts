import { describe, it, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  const service = new NotificationsService();

  // Keep test output clean — the service logs every send.
  mock.method(Logger.prototype, 'log', () => undefined);

  afterEach(() => {
    mock.restoreAll();
    mock.method(Logger.prototype, 'log', () => undefined);
  });

  it('reports "sent" when the simulated provider succeeds', () => {
    mock.method(Math, 'random', () => 0.5);

    const result = service.send('user-1', 'email', 'hello');

    assert.equal(result.status, 'sent');
    assert.match(result.id, /^[0-9a-f-]{36}$/);
  });

  it('reports "failed" for the injected ~10% failure band', () => {
    mock.method(Math, 'random', () => 0.05);

    assert.equal(service.send('user-1', 'email', 'hello').status, 'failed');
  });

  it('treats exactly 0.1 as a failure (boundary of the failure band)', () => {
    mock.method(Math, 'random', () => 0.1);

    assert.equal(service.send('user-1', 'email', 'hello').status, 'failed');
  });

  it('returns a fresh id per notification', () => {
    mock.method(Math, 'random', () => 0.5);

    const a = service.send('user-1', 'email', 'a');
    const b = service.send('user-1', 'email', 'b');

    assert.notEqual(a.id, b.id);
  });
});
