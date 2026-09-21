import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '../common/metrics';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'users-service' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async metrics() {
    return registry.metrics();
  }
}
