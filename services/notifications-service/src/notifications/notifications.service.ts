import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface NotificationResult {
  id: string;
  status: 'sent' | 'failed';
}

/**
 * Simulates a delivery provider (email/SMS gateway). No real message is
 * sent — this demo's point is the gRPC contract and observability around
 * it, not integrating a real provider. A ~10% failure rate is injected on
 * purpose so the metrics/dashboards have something real to show.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  send(userId: string, channel: string, message: string): NotificationResult {
    const id = randomUUID();
    const delivered = Math.random() > 0.1;

    this.logger.log(
      `notification ${id} to user=${userId} via ${channel}: "${message}" -> ${
        delivered ? 'sent' : 'failed'
      }`,
    );

    return { id, status: delivered ? 'sent' : 'failed' };
  }
}
