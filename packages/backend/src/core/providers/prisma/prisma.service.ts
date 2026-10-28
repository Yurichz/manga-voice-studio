import { db, Prisma } from '@mvs/database';
import type { OnApplicationShutdown } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

type TxOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};
@Injectable()
export class PrismaService implements OnApplicationShutdown {
  readonly root = db;

  private readonly context = new AsyncLocalStorage<Prisma.TransactionClient>();

  get client(): Prisma.TransactionClient {
    return this.context.getStore() ?? this.root;
  }

  get currentTransaction() {
    return this.context.getStore();
  }

  async $tx<T>(fn: (client: Prisma.TransactionClient) => Promise<T>, options?: TxOptions): Promise<T> {
    if (this.currentTransaction) {
      throw new Error('Nested $tx is not supported; use $txe');
    }

    return this.root.$transaction((client) => this.context.run(client, () => fn(client)), options);
  }

  $txe<T>(fn: (client: Prisma.TransactionClient) => Promise<T>, client?: Prisma.TransactionClient, options?: TxOptions): Promise<T> {
    const active = client ?? this.currentTransaction;

    return active ? this.context.run(active, () => fn(active)) : this.$tx(fn, options);
  }

  async onApplicationShutdown() {
    await this.root.$disconnect();
  }
}
export abstract class TxScopeRepository {
  constructor(
    protected readonly prisma: PrismaService,
    private readonly explicitClient?: Prisma.TransactionClient,
  ) {}

  protected get $(): Prisma.TransactionClient {
    return this.explicitClient ?? this.prisma.client;
  }

  tx(client?: Prisma.TransactionClient): this {
    const cache = new Map<PropertyKey, unknown>();
    const proxy: this = new Proxy(this, {
      get: (object, key, receiver) => {
        if (key === '$') {
          return client ?? this.explicitClient ?? this.prisma.client;
        }

        if (key === 'explicitClient') {
          return client ?? this.explicitClient;
        }

        const value = Reflect.get(object, key, receiver);

        if (typeof value !== 'function') {
          return value;
        }

        if (!cache.has(key)) {
          cache.set(key, value.bind(proxy));
        }

        return cache.get(key);
      },
    });

    return proxy;
  }
}
