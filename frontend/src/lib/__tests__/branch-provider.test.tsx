import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({ apiGet: vi.fn() }));

import { apiGet } from '../api';
import {
  BranchProvider,
  STORE_STORAGE_KEY,
  TABLE_STORAGE_KEY,
  useBranch,
} from '../branch';

type BranchSnapshot = ReturnType<typeof useBranch>;

describe('BranchProvider', () => {
  let container: HTMLDivElement;
  let root: Root;
  let snapshot: BranchSnapshot | null;

  function Probe() {
    const value = useBranch();
    useEffect(() => {
      snapshot = value;
    }, [value]);
    return null;
  }

  async function renderProvider() {
    await act(async () => {
      root.render(
        <BranchProvider>
          <Probe />
        </BranchProvider>,
      );
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    snapshot = null;
    sessionStorage.clear();
    vi.mocked(apiGet).mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('loads stores once, restores selection and clears table context when store changes', async () => {
    sessionStorage.setItem(STORE_STORAGE_KEY, '1');
    sessionStorage.setItem(TABLE_STORAGE_KEY, '44');
    vi.mocked(apiGet).mockResolvedValue([
      { id: 1, name: 'Nguyễn Huệ', is_active: true },
      { id: 2, name: 'Lê Lợi', is_active: true },
    ]);

    await renderProvider();

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(snapshot?.status).toBe('ready');
    expect(snapshot?.selectedStoreId).toBe(1);
    expect(snapshot?.activeTableId).toBe('44');

    await act(async () => {
      expect(snapshot?.selectStore(2)).toBe(true);
    });

    expect(snapshot?.selectedStoreId).toBe(2);
    expect(snapshot?.activeTableId).toBeNull();
    expect(sessionStorage.getItem(STORE_STORAGE_KEY)).toBe('2');
    expect(sessionStorage.getItem(TABLE_STORAGE_KEY)).toBeNull();
  });

  it('keeps persisted storage intact when the stores request fails', async () => {
    sessionStorage.setItem(STORE_STORAGE_KEY, '2');
    vi.mocked(apiGet).mockRejectedValue(new Error('offline'));

    await renderProvider();

    expect(snapshot?.status).toBe('error');
    expect(sessionStorage.getItem(STORE_STORAGE_KEY)).toBe('2');
  });
});
