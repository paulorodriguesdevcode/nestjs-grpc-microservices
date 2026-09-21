import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
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
      {
        name: 'NOTIFICATIONS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'notifications',
          protoPath: protoPath('notifications.proto'),
          url: process.env.NOTIFICATIONS_SERVICE_URL ?? 'localhost:50052',
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
