import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersController } from './users.controller';
import { protoPath } from '../common/proto-path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'users',
          protoPath: protoPath('users.proto'),
          url: process.env.USERS_SERVICE_URL ?? 'localhost:50051',
        },
      },
    ]),
  ],
  controllers: [UsersController],
})
export class UsersModule {}
