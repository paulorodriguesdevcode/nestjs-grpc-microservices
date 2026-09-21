import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logger';
import { httpMetricsMiddleware } from './common/metrics';
import { GrpcExceptionFilter } from './filters/grpc-exception.filter';

async function bootstrap() {
  const logger = new JsonLogger('api-gateway');
  const app = await NestFactory.create(AppModule, { logger });

  app.use(httpMetricsMiddleware);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new GrpcExceptionFilter());

  const httpPort = process.env.HTTP_PORT ?? '3000';
  await app.listen(httpPort);

  logger.log(`REST API listening on :${httpPort}`, 'Bootstrap');
}

bootstrap();
