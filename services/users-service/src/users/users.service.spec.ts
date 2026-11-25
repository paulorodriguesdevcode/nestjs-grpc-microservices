import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(() => {
    service = new UsersService();
  });

  it('creates a user with a generated id and an ISO timestamp', () => {
    const user = service.create('Ana', 'ana@example.com');

    assert.equal(user.name, 'Ana');
    assert.equal(user.email, 'ana@example.com');
    assert.match(user.id, /^[0-9a-f-]{36}$/);
    assert.equal(new Date(user.createdAt).toISOString(), user.createdAt);
  });

  it('gives every user a distinct id', () => {
    const a = service.create('Ana', 'ana@example.com');
    const b = service.create('Bia', 'bia@example.com');

    assert.notEqual(a.id, b.id);
  });

  it('finds a created user by id', () => {
    const user = service.create('Ana', 'ana@example.com');

    assert.deepEqual(service.findById(user.id), user);
  });

  it('returns undefined for an unknown id', () => {
    assert.equal(service.findById('does-not-exist'), undefined);
  });

  it('lists all users', () => {
    service.create('Ana', 'ana@example.com');
    service.create('Bia', 'bia@example.com');

    assert.deepEqual(service.findAll().map((u) => u.name), ['Ana', 'Bia']);
  });
});
