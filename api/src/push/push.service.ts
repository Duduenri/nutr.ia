import { Injectable, Logger } from '@nestjs/common';
import webpush, { WebPushError } from 'web-push';
import { requireEnv } from '../common/env';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly publicKey = requireEnv('VAPID_PUBLIC_KEY');

  constructor(private readonly prisma: PrismaService) {
    webpush.setVapidDetails(
      requireEnv('VAPID_SUBJECT'),
      this.publicKey,
      requireEnv('VAPID_PRIVATE_KEY'),
    );
  }

  async send(userId: string, payload: PushPayload): Promise<number> {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    let delivered = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 30 },
        );
        delivered++;
      } catch (error) {
        if (
          error instanceof WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          await this.prisma.pushSubscription.delete({ where: { id: s.id } });
        } else {
          this.logger.warn(`Push falhou: ${String(error)}`);
        }
      }
    }
    return delivered;
  }
}
