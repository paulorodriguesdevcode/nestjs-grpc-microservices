import {
  Body,
  Controller,
  Get,
  Inject,
  OnModuleInit,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { OrdersServiceClient } from '../clients/clients.interfaces';
import { CreateOrderDto } from './create-order.dto';

@Controller('orders')
export class OrdersController implements OnModuleInit {
  private ordersClient!: OrdersServiceClient;

  constructor(@Inject('ORDERS_PACKAGE') private readonly ordersGrpc: ClientGrpc) {}

  onModuleInit() {
    this.ordersClient = this.ordersGrpc.getService<OrdersServiceClient>('OrdersService');
  }

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return firstValueFrom(this.ordersClient.createOrder(dto));
  }

  @Get(':id')
  getOrder(@Param('id') id: string) {
    return firstValueFrom(this.ordersClient.getOrder({ id }));
  }

  @Get()
  async listOrders(@Query('userId') userId?: string) {
    const { orders } = await firstValueFrom(this.ordersClient.listOrders({ userId }));
    return orders;
  }
}
