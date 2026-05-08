import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFirestoreCollection } from './useFirestoreCollection';

vi.mock('firebase/firestore', () => {
  const listeners = new Map<string, (snap: unknown) => void>();
  return {
    collection: (_db: unknown, name: string) => ({ name }),
    onSnapshot: (
      ref: { name: string },
      onNext: (snap: unknown) => void,
    ) => {
      listeners.set(ref.name, onNext);
      return () => listeners.delete(ref.name);
    },
    __emit: (name: string, docs: Record<string, unknown>[]) =>
      listeners.get(name)?.({
        docs: docs.map((d, i) => ({ id: String(i), data: () => d })),
      }),
  };
});

vi.mock('../firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'list' },
}));

describe('useFirestoreCollection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns [] and loading=true before snapshot fires', () => {
    const { result } = renderHook(() =>
      useFirestoreCollection<{ id?: string; x: number }>('foo'),
    );
    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('updates data when snapshot fires', async () => {
    const { result } = renderHook(() =>
      useFirestoreCollection<{ id?: string; x: number }>('foo'),
    );
    const fs = (await import('firebase/firestore')) as unknown as {
      __emit: (name: string, docs: Record<string, unknown>[]) => void;
    };
    act(() => fs.__emit('foo', [{ x: 1 }, { x: 2 }]));
    expect(result.current.data).toEqual([
      { id: '0', x: 1 },
      { id: '1', x: 2 },
    ]);
    expect(result.current.loading).toBe(false);
  });
});
