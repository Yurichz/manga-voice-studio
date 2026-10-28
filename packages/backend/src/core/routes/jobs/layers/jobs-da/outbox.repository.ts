import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class OutboxRepository extends TxScopeRepository {
  constructor(@Inject(PrismaService) prisma: PrismaService) {
    super(prisma);
  }

  dispatchOutboxEventFindMany() {
    return this.$.outboxEvent.findMany({ where: { deliveredAt: null }, take: 100, include: { job: true } });
  }

  dispatchOutboxEventUpdate(value1: string, value2: Date) {
    return this.$.outboxEvent.update({ where: { id: value1 }, data: { deliveredAt: value2 } });
  }
}
