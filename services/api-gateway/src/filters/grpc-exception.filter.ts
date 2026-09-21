import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { Response } from 'express';

const GRPC_TO_HTTP: Record<number, number> = {
  [GrpcStatus.INVALID_ARGUMENT]: 400,
  [GrpcStatus.UNAUTHENTICATED]: 401,
  [GrpcStatus.PERMISSION_DENIED]: 403,
  [GrpcStatus.NOT_FOUND]: 404,
  [GrpcStatus.ALREADY_EXISTS]: 409,
  [GrpcStatus.FAILED_PRECONDITION]: 409,
  [GrpcStatus.RESOURCE_EXHAUSTED]: 429,
  [GrpcStatus.UNIMPLEMENTED]: 501,
  [GrpcStatus.UNAVAILABLE]: 503,
  [GrpcStatus.DEADLINE_EXCEEDED]: 504,
};

/**
 * Downstream gRPC errors surface here as plain { code, details } objects
 * (grpc-js's own shape), not Nest HttpExceptions — this filter is what
 * turns "NOT_FOUND from orders-service" into an actual 404 for the REST
 * caller, instead of a generic 500.
 */
@Catch()
export class GrpcExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const res = host.switchToHttp().getResponse<Response>();
      res.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const grpcCode: number | undefined = exception?.code;
    const httpStatus = (grpcCode !== undefined && GRPC_TO_HTTP[grpcCode]) || 500;
    const message =
      exception?.details ?? exception?.message ?? 'Unexpected error calling a downstream service';

    const res = host.switchToHttp().getResponse<Response>();
    res.status(httpStatus).json({
      statusCode: httpStatus,
      message,
    });
  }
}
