import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTransientDatabaseLock, withNativeDatabaseAccess } from './nativeDatabaseAccess';

afterEach(() => vi.useRealTimers());

describe('native database access across lifecycle work', () => {
  it('recognizes only busy/locked failures, including extended SQLite result codes', () => {
    for (const error of [
      new Error('database is locked'),
      new Error('database table is locked'),
      { code: 'SQLITE_BUSY_SNAPSHOT' },
      { code: 517 },
      { code: 6 },
    ]) {
      expect(isTransientDatabaseLock(error)).toBe(true);
    }
    for (const error of [
      new Error('file is not a database'),
      new Error('hash mismatch'),
      { code: 11 },
      new Error('Secure storage unavailable'),
    ]) {
      expect(isTransientDatabaseLock(error)).toBe(false);
    }
  });

  it('holds the recreated reader until the prior writer finishes and closes its connection', async () => {
    let release!: () => void;
    let generation = 4;
    const calls: string[] = [];
    const writer = withNativeDatabaseAccess('same-vault', async () => {
      calls.push('write');
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      generation = 5;
      calls.push('close');
    });
    const reader = withNativeDatabaseAccess('same-vault', async () => {
      calls.push('read');
      return generation;
    });
    await Promise.resolve();
    expect(calls).toEqual(['write']);
    release();
    await writer;
    expect(await reader).toBe(5);
    expect(calls).toEqual(['write', 'close', 'read']);
  });

  it('retries a temporary lock and returns the verified current value', async () => {
    vi.useFakeTimers();
    const read = vi
      .fn()
      .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
      .mockResolvedValue('current-generation');
    const pending = withNativeDatabaseAccess('retry-vault', read);
    await vi.runAllTimersAsync();
    expect(await pending).toBe('current-generation');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('preserves exhausted lock failures and real corruption without fabricating a value', async () => {
    vi.useFakeTimers();
    const busy = new Error('database is locked');
    const read = vi.fn().mockRejectedValue(busy);
    const pending = withNativeDatabaseAccess('busy-vault', read);
    const rejection = expect(pending).rejects.toBe(busy);
    await vi.runAllTimersAsync();
    await rejection;
    expect(read).toHaveBeenCalledTimes(6);
    const corrupt = new Error('file is not a database');
    const corruptRead = vi.fn().mockRejectedValue(corrupt);
    await expect(withNativeDatabaseAccess('busy-vault', corruptRead)).rejects.toBe(corrupt);
    expect(corruptRead).toHaveBeenCalledOnce();
  });
});
