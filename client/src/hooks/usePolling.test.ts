import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePolling } from './usePolling';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usePolling', () => {
  it('returns loading true and data null initially while fetcher runs', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');

    const { result } = renderHook(() => usePolling(fetcher, 1000));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // Flush pending state updates to suppress act() warning
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  });

  it('returns data after fetcher resolves', async () => {
    const fetcher = vi.fn().mockResolvedValue('hello');

    const { result } = renderHook(() => usePolling(fetcher, 1000));

    // Flush microtasks (resolve the promise) then flush React state updates
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('returns error when fetcher rejects', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePolling(fetcher, 1000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('polls fetcher at the given interval', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');

    renderHook(() => usePolling(fetcher, 1000));

    // Flush microtasks for the initial fetch call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Advance by exactly one interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Advance by another interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('clears interval on unmount', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');

    const { unmount } = renderHook(() => usePolling(fetcher, 1000));

    // Flush microtasks to complete initial fetch
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);

    unmount();

    // Advance time - should not call fetcher since interval was cleared
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not update state after unmount during fetch', async () => {
    // Create a promise that doesn't resolve immediately
    let resolvePromise!: (value: string) => void;
    const fetcher = vi.fn().mockImplementation(() => {
      return new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });
    });

    const { result, unmount } = renderHook(() => usePolling(fetcher, 1000));

    expect(result.current.loading).toBe(true);

    unmount();

    // Resolve the promise after unmount
    resolvePromise('data');

    // Flush microtasks - the mounted check should prevent state update
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // After unmount, state should still be loading (never updated)
    // The test passes if no React warning about state update on unmounted component appears
    // and no error is thrown
  });

  it('handles fetcher returning object data types', async () => {
    const items = [{ id: '1', name: 'Wallet' }];
    const fetcher = vi.fn().mockResolvedValue(items);

    const { result } = renderHook(() => usePolling(fetcher, 5000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(items);
  });
});
