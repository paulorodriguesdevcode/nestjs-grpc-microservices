import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { GrpcMetricsInterceptor } from '../common/metrics';
import { OrdersService, OrderItem } from './orders.service';

@Controller()
@UseInterceptors(GrpcMetricsInterceptor)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @GrpcMethod('OrdersService', 'CreateOrder')
  async createOrder(data: { userId: string; items: OrderItem[] }) {
    if (!data.items?.length) {
      throw new RpcException({
        code: GrpcStatus.INVALID_ARGUMENT,
        message: 'An order needs at least one item',
      });
    }
    return this.ordersService.create(data.userId, data.items);
  }

  @GrpcMethod('OrdersService', 'GetOrder')
  getOrder(data: { id: string }) {
    const order = this.ordersService.findById(data.id);
    if (!order) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: `Order ${data.id} not found`,
      });
    }
    return order;
  }

  @GrpcMethod('OrdersService', 'ListOrders')
  listOrders(data: { userId?: string }) {
    return { orders: this.ordersService.findAll(data.userId || undefined) };
  }
}
