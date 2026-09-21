import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientGrpc, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'crypto';
import {
  NotificationsServiceClient,
  UsersServiceClient,
} from '../clients/clients.interfaces';

export interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: string;
  createdAt: string;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);
  private readonly orders = new Map<string, Order>();

  private usersClient!: UsersServiceClient;
  private notificationsClient!: NotificationsServiceClient;

  constructor(
    @Inject('USERS_PACKAGE') private readonly usersGrpc: ClientGrpc,
    @Inject('NOTIFICATIONS_PACKAGE') private readonly notificationsGrpc: ClientGrpc,
  ) {}

  onModuleInit() {
    this.usersClient = this.usersGrpc.getService<UsersServiceClient>('UsersService');
    this.notificationsClient =
      this.notificationsGrpc.getService<NotificationsServiceClient>('NotificationsService');
  }

  async create(userId: string, items: OrderItem[]): Promise<Order> {
    // 1. Validate the user exists — a cross-service gRPC call, not a local join.
    try {
      await firstValueFrom(this.usersClient.getUser({ id: userId }));
    } catch (err: any) {
      if (err?.code === GrpcStatus.NOT_FOUND) {
        throw new RpcException({
          code: GrpcStatus.NOT_FOUND,
          message: `User ${userId} not found`,
        });
      }
      throw new RpcException({
        code: GrpcStatus.UNAVAILABLE,
        message: `users-service unavailable: ${err?.message ?? err}`,
      });
    }

    // 2. Persist the order.
    const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const order: Order = {
      id: randomUUID(),
      userId,
      items,
      total,
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    this.orders.set(order.id, order);

    // 3. Fire a notification. Deliberately best-effort: a failed notification
    // does not roll back the order — the two are not part of one transaction.
    try {
      const result = await firstValueFrom(
        this.notificationsClient.sendNotification({
          userId,
          channel: 'email',
          message: `Your order ${order.id} was created — total $${total.toFixed(2)}`,
        }),
      );
      this.logger.log(`notification ${result.id} for order ${order.id}: ${result.status}`);
    } catch (err: any) {
      this.logger.warn(`notification failed for order ${order.id}: ${err?.message ?? err}`);
    }

    return order;
  }

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  findAll(userId?: string): Order[] {
    const all = Array.from(this.orders.values());
    return userId ? all.filter((o) => o.userId === userId) : all;
  }
}
