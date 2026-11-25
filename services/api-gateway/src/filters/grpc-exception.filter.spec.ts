import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { GrpcExceptionFilter } from './grpc-exception.filter';

/** Minimal ArgumentsHost that records what the filter writes to the response. */
function captureHost() {
  const sent: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: unknown) {
      sent.body = body;
      return this;
    },
  };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  return { host, sent };
}

describe('GrpcExceptionFilter', () => {
  const filter = new GrpcExceptionFilter();

  const cases: Array<[string, number, number]> = [
    ['INVALID_ARGUMENT', GrpcStatus.INVALID_ARGUMENT, 400],
    ['UNAUTHENTICATED', GrpcStatus.UNAUTHENTICATED, 401],
    ['PERMISSION_DENIED', GrpcStatus.PERMISSION_DENIED, 403],
    ['NOT_FOUND', GrpcStatus.NOT_FOUND, 404],
    ['ALREADY_EXISTS', GrpcStatus.ALREADY_EXISTS, 409],
    ['RESOURCE_EXHAUSTED', GrpcStatus.RESOURCE_EXHAUSTED, 429],
    ['UNAVAILABLE', GrpcStatus.UNAVAILABLE, 503],
    ['DEADLINE_EXCEEDED', GrpcStatus.DEADLINE_EXCEEDED, 504],
  ];

  for (const [name, grpcCode, httpStatus] of cases) {
    it(`maps gRPC ${name} to HTTP ${httpStatus}`, () => {
      const { host, sent } = captureHost();

      filter.catch({ code: grpcCode, details: 'downstream said no' }, host);

      assert.equal(sent.status, httpStatus);
      assert.deepEqual(sent.body, { statusCode: httpStatus, message: 'downstream said no' });
    });
  }

  it('falls back to 500 for an unmapped gRPC code or a plain error', () => {
    for (const exception of [{ code: GrpcStatus.INTERNAL }, new Error('boom')]) {
      const { host, sent } = captureHost();
      filter.catch(exception, host);
      assert.equal(sent.status, 500);
    }
  });

  it('passes Nest HttpExceptions (e.g. validation errors) through unchanged', () => {
    const { host, sent } = captureHost();
    const exception = new BadRequestException(['email must be an email']);

    filter.catch(exception, host);

    assert.equal(sent.status, 400);
    assert.deepEqual(sent.body, exception.getResponse());
  });
});
