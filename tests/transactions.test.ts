import { it, expect } from 'vitest';
import { PrismaService, TxScopeRepository } from '@mvs/backend/prisma';
import type { Prisma } from '@mvs/database';

class ProbeRepository extends TxScopeRepository {
  who() {
    return (this.$ as unknown as { name: string }).name;
  }
}
function fixture() {
  const prisma = new PrismaService();
  const options: unknown[] = [];
  let sequence = 0;
  Object.defineProperty(prisma, 'root', {
    value: {
      name: 'root',
      $transaction: async (fn: (client: unknown) => Promise<unknown>, option: unknown) => {
        options.push(option);
        return fn({ name: `transaction-${++sequence}` });
      },
    },
  });
  return { prisma, options, repository: new ProbeRepository(prisma) };
}
it('reuses the active transaction, rejects nesting and keeps explicit views isolated', async () => {
  const { prisma, repository, options } = fixture();
  const explicit = { name: 'explicit' } as unknown as Prisma.TransactionClient;
  const view = repository.tx(explicit);
  expect(repository.who()).toBe('root');
  await prisma.$tx(
    async () => {
      expect(repository.who()).toBe('transaction-1');
      expect(view.who()).toBe('explicit');
      await prisma.$txe(async () => expect(repository.who()).toBe('transaction-1'));
      await prisma.$txe(async () => expect(repository.who()).toBe('explicit'), explicit);
      expect(repository.who()).toBe('transaction-1');
      await expect(prisma.$tx(async () => undefined)).rejects.toThrow('Nested $tx');
    },
    { isolationLevel: 'RepeatableRead' },
  );
  expect(options).toEqual([{ isolationLevel: 'RepeatableRead' }]);
  expect(repository.who()).toBe('root');
  expect(view.who()).toBe('explicit');
});
it('isolates simultaneous contexts and restores the root after failure', async () => {
  const { prisma, repository } = fixture();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = prisma.$tx(async () => {
    await gate;
    expect(repository.who()).toBe('transaction-1');
    throw new Error('rollback');
  });
  await prisma.$tx(async () => {
    expect(repository.who()).toBe('transaction-2');
    release();
    await expect(first).rejects.toThrow('rollback');
    expect(repository.who()).toBe('transaction-2');
  });
  expect(repository.who()).toBe('root');
});
