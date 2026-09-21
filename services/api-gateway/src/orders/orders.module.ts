import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { OrdersController } from './orders.controller';
import { protoPath } from '../common/proto-path';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDERS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'orders',
          protoPath: protoPath('orders.proto'),
          url: process.env.ORDERS_SERVICE_URL ?? 'localhost:50053',
        },
      },
    ]),
  ],
  controllers: [OrdersController],
})
export class OrdersModule {}
