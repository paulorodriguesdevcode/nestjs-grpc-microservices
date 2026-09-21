import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const grpcRequestsTotal = new Counter({
  name: 'grpc_requests_total',
  help: 'Total gRPC requests handled, by method and outcome',
  labelNames: ['method', 'status'] as const,
  registers: [registry],
});

export const grpcRequestDuration = new Histogram({
  name: 'grpc_request_duration_seconds',
  help: 'gRPC request duration in seconds, by method',
  labelNames: ['method'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

/** Wraps every gRPC handler in a service to record count + latency + error rate. */
@Injectable()
export class GrpcMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const method = context.getHandler().name;
    const stop = grpcRequestDuration.startTimer({ method });

    return next.handle().pipe(
      tap({
        next: () => {
          stop();
          grpcRequestsTotal.inc({ method, status: 'ok' });
        },
        error: () => {
          stop();
          grpcRequestsTotal.inc({ method, status: 'error' });
        },
      }),
    );
  }
}
