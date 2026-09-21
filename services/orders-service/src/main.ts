import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport, GrpcOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logger';
import { protoPath } from './common/proto-path';

async function bootstrap() {
  const logger = new JsonLogger('orders-service');
  const app = await NestFactory.create(AppModule, { logger });

  const grpcPort = process.env.GRPC_PORT ?? '50053';
  app.connectMicroservice<GrpcOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'orders',
      protoPath: protoPath('orders.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();

  const httpPort = process.env.HTTP_PORT ?? '3003';
  await app.listen(httpPort);

  logger.log(`gRPC listening on :${grpcPort}, HTTP (health/metrics) on :${httpPort}`, 'Bootstrap');
}

bootstrap();
