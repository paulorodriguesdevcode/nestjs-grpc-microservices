import { Controller, UseInterceptors } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcMetricsInterceptor } from '../common/metrics';
import { NotificationsService } from './notifications.service';

@Controller()
@UseInterceptors(GrpcMetricsInterceptor)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @GrpcMethod('NotificationsService', 'SendNotification')
  sendNotification(data: { userId: string; channel: string; message: string }) {
    return this.notificationsService.send(data.userId, data.channel, data.message);
  }
}
