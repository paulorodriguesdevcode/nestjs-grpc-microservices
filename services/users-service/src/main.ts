import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport, GrpcOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { JsonLogger } from './common/logger';
import { protoPath } from './common/proto-path';

async function bootstrap() {
  const logger = new JsonLogger('users-service');
  const app = await NestFactory.create(AppModule, { logger });

  const grpcPort = process.env.GRPC_PORT ?? '50051';
  app.connectMicroservice<GrpcOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'users',
      protoPath: protoPath('users.proto'),
      url: `0.0.0.0:${grpcPort}`,
    },
  });

  await app.startAllMicroservices();

  const httpPort = process.env.HTTP_PORT ?? '3001';
  await app.listen(httpPort);

  logger.log(`gRPC listening on :${grpcPort}, HTTP (health/metrics) on :${httpPort}`, 'Bootstrap');
}

bootstrap();
