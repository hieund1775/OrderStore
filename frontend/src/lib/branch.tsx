import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiGet } from './api';

export const STORE_STORAGE_KEY = 'teaplus_store_id';
export const TABLE_STORAGE_KEY = 'teaplus_table_id';

export type PublicStore = {
  id: number;
  name: string;
  address?: string;
  district?: string;
  city?: string;
  is_active?: boolean;
};

export type BranchStatus = 'loading' | 'ready' | 'error' | 'empty';

type BranchContextValue = {
  stores: PublicStore[];
  selectedStoreId: number | null;
  selectedStore: PublicStore | null;
  activeTableId: string | null;
  status: BranchStatus;
  selectStore: (storeId: number | string) => boolean;
  bindTable: (tableId: number | string, storeId: number | string) => boolean;
  clearTable: () => void;
};

const BranchContext = createContext<BranchContextValue | null>(null);

export function filterActiveStores(rows: PublicStore[]): PublicStore[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(
    (store) => Number.isInteger(Number(store.id)) && Number(store.id) > 0 && store.is_active !== false,
  );
}

export function resolveSelectedStoreId(stores: PublicStore[], savedId: string | null): number | null {
  if (stores.length === 0) return null;
  const parsed = Number(savedId);
  return stores.some((store) => store.id === parsed) ? parsed : stores[0].id;
}

export function BranchProvider({ children }: { children: ReactNode }) {
  const [stores, setStores] = useState<PublicStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [status, setStatus] = useState<BranchStatus>('loading');

  useEffect(() => {
    try {
      const savedStoreId = Number(sessionStorage.getItem(STORE_STORAGE_KEY));
      if (Number.isInteger(savedStoreId) && savedStoreId > 0) setSelectedStoreId(savedStoreId);
      setActiveTableId(sessionStorage.getItem(TABLE_STORAGE_KEY));
    } catch {
      // Browser storage may be unavailable; API data still remains usable in memory.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    apiGet<PublicStore[]>('/api/stores')
      .then((rows) => {
        if (cancelled) return;
        const activeStores = filterActiveStores(rows);
        setStores(activeStores);

        if (activeStores.length === 0) {
          setSelectedStoreId(null);
          setStatus('empty');
          return;
        }

        let savedId: string | null = null;
        try {
          savedId = sessionStorage.getItem(STORE_STORAGE_KEY);
        } catch {
          // Use the first active store if storage cannot be read.
        }
        const resolvedId = resolveSelectedStoreId(activeStores, savedId);
        setSelectedStoreId(resolvedId);
        if (resolvedId != null) {
          try {
            sessionStorage.setItem(STORE_STORAGE_KEY, String(resolvedId));
          } catch {
            // In-memory selection remains valid when persistence is unavailable.
          }
        }
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const clearTable = useCallback(() => {
    setActiveTableId(null);
    try {
      sessionStorage.removeItem(TABLE_STORAGE_KEY);
    } catch {
      // Keep the in-memory state authoritative for this session.
    }
  }, []);

  const selectStore = useCallback(
    (storeId: number | string) => {
      const parsed = Number(storeId);
      if (status !== 'ready' || !stores.some((store) => store.id === parsed)) return false;
      setSelectedStoreId(parsed);
      clearTable();
      try {
        sessionStorage.setItem(STORE_STORAGE_KEY, String(parsed));
      } catch {
        // Keep the in-memory selection even if storage is unavailable.
      }
      return true;
    },
    [clearTable, status, stores],
  );

  const bindTable = useCallback(
    (tableId: number | string, storeId: number | string) => {
      const normalizedTableId = String(tableId);
      const parsedStoreId = Number(storeId);
      if (!normalizedTableId || !Number.isInteger(parsedStoreId) || parsedStoreId <= 0) return false;
      if (status === 'ready' && !stores.some((store) => store.id === parsedStoreId)) return false;

      setActiveTableId(normalizedTableId);
      setSelectedStoreId(parsedStoreId);
      try {
        sessionStorage.setItem(TABLE_STORAGE_KEY, normalizedTableId);
        sessionStorage.setItem(STORE_STORAGE_KEY, String(parsedStoreId));
      } catch {
        // The resolved table remains active in memory.
      }
      return true;
    },
    [status, stores],
  );

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [selectedStoreId, stores],
  );

  const value = useMemo<BranchContextValue>(
    () => ({
      stores,
      selectedStoreId,
      selectedStore,
      activeTableId,
      status,
      selectStore,
      bindTable,
      clearTable,
    }),
    [activeTableId, bindTable, clearTable, selectStore, selectedStore, selectedStoreId, status, stores],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) throw new Error('useBranch must be used inside BranchProvider');
  return context;
}
