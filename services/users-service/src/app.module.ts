import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [UsersModule],
  controllers: [HealthController],
})
export class AppModule {}
