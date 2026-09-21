import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}
