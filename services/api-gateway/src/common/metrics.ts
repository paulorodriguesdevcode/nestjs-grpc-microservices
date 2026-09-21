import { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled, by route and status code',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds, by route',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

/** Express middleware — measured via res 'finish' so the real status code is captured. */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const route = req.path;
  const stop = httpRequestDuration.startTimer({ method: req.method, route });

  res.on('finish', () => {
    stop();
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status: String(res.statusCode),
    });
  });

  next();
}
