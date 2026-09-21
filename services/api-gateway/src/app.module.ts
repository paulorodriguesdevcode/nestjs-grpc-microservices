import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [UsersModule, OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}
