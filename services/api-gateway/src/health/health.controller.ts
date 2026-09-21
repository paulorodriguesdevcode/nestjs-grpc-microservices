import { Controller, Get, Header } from '@nestjs/common';
import { registry } from '../common/metrics';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', service: 'api-gateway' };
  }

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  async metrics() {
    return registry.metrics();
  }
}
