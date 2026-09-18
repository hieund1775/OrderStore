import { createContext, useContext, useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getCustomerSession, openCustomerLoginModal } from './customer-session';

export type AppliedModifier = {
  attribute_code: string;
  attribute_name: string;
  value_code: string;
  value_label: string;
  price_adjustment: number;
};

export type CartItem = {
  key: string;
  storeId?: number | string;
  storeName?: string;
  storeDistrict?: string;
  productId: string;
  productSlug?: string;
  name: string;
  image: string;
  variantId?: number | null;
  sku?: string;
  variantName?: string | null;
  stockMode?: 'tracked' | 'made_to_order';
  fulfillmentLane?: 'kitchen' | 'packing';
  rootCategoryId?: number | string;
  rootCategoryName?: string;
  rootCategorySlug?: string;
  size?: string;
  base?: string;
  sugar?: string;
  ice?: string;
  toppings?: string[];
  appliedModifiers?: AppliedModifier[];
  note?: string;
  unitPrice: number;
  qty: number;
  addedAt?: string;
  selected?: boolean;
};

export type StoreCartGroup = {
  storeId: string;
  storeName: string;
  storeDistrict?: string;
  items: CartItem[];
  subtotal: number;
  count: number;
  allSelected: boolean;
};

export function buildCartItemKey(item: Partial<CartItem>): string {
  const storePart = item.storeId ? String(item.storeId) : 'default';
  const prodPart = String(item.productId || '');
  const variantPart = item.sku || (item.variantId ? `var-${item.variantId}` : 'default');

  let modPart = '';
  if (item.appliedModifiers && item.appliedModifiers.length > 0) {
    modPart = item.appliedModifiers
      .slice()
      .sort((a, b) => a.attribute_code.localeCompare(b.attribute_code) || a.value_code.localeCompare(b.value_code))
      .map((m) => `${m.attribute_code}:${m.value_code}`)
      .join('|');
  } else {
    modPart = [
      item.size || '',
      item.base || '',
      item.sugar || '',
      item.ice || '',
      (item.toppings || []).slice().sort().join(','),
    ].join('|');
  }

  const notePart = item.note ? item.note.trim() : '';
  return `${storePart}__${prodPart}__${variantPart}__${modPart}__${notePart}`;
}

type CartContextValue = {
  items: CartItem[];
  groups: StoreCartGroup[];
  addItem: (item: Omit<CartItem, 'key'>) => boolean;
  updateItem: (oldKey: string, newItem: Omit<CartItem, 'key'>) => boolean;
  removeItem: (key: string) => void;
  removeItems: (keys: string[]) => void;
  setQty: (key: string, qty: number) => void;
  toggleSelect: (key: string, selected?: boolean) => void;
  toggleSelectStore: (storeId: string, selected: boolean) => void;
  toggleSelectAll: (selected: boolean) => void;
  clear: (storeId?: string) => void;
  count: number;
  subtotal: number;
  selectedItems: CartItem[];
  selectedCount: number;
  selectedSubtotal: number;
  allSelected: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export const V3_STORAGE_KEY_PREFIX = 'teaplus_smart_cart_v3:user:';
export const V3_PREORDER_STORAGE_KEY_PREFIX = 'teaplus_preorder_cart_v3:user:';
export const LEGACY_V2_STORAGE_KEY = 'teaplus_smart_cart_v2';

export function getCartStorageKey(userId: number): string {
  return `${V3_STORAGE_KEY_PREFIX}${userId}`;
}

export function getPreorderCartStorageKey(userId: number): string {
  return `${V3_PREORDER_STORAGE_KEY_PREFIX}${userId}`;
}

export function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CartItem => {
        return Boolean(
          item &&
          typeof item === 'object' &&
          typeof item.productId === 'string' &&
          typeof item.name === 'string' &&
          typeof item.unitPrice === 'number' &&
          Number.isFinite(item.unitPrice) &&
          typeof item.qty === 'number' &&
          item.qty > 0
        );
      })
      .map((item) => ({
        ...item,
        key: item.key || buildCartItemKey(item),
        selected: item.selected !== false,
        addedAt: item.addedAt || new Date().toISOString(),
        appliedModifiers: Array.isArray(item.appliedModifiers) ? item.appliedModifiers : [],
      }));
  } catch {
    return [];
  }
}

let cartBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    cartBroadcastChannel = new BroadcastChannel('teaplus_cart_sync_channel');
  }
} catch {
  cartBroadcastChannel = null;
}

export function broadcastCartSync(userId: number, cartType: 'normal' | 'preorder') {
  try {
    cartBroadcastChannel?.postMessage({ type: 'CART_SYNC', userId, cartType, timestamp: Date.now() });
  } catch {}
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Always initialize empty for SSR hydration safety and guest default
  const [items, setItems] = useState<CartItem[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const hydratedUserRef = useRef<number | null>(null);

  // Synchronize cart with current customer session and other tabs
  useEffect(() => {
    // Safely remove legacy V2 storage key; never migrate or render it
    try {
      localStorage.removeItem(LEGACY_V2_STORAGE_KEY);
    } catch {}

    const reloadFromStorage = (userId: number) => {
      let loaded: CartItem[] = [];
      try {
        const raw = localStorage.getItem(getCartStorageKey(userId));
        loaded = parseStoredCart(raw);
      } catch {
        loaded = [];
      }
      setItems((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(loaded)) {
          return prev;
        }
        return loaded;
      });
    };

    const syncWithSession = () => {
      const currentSession = getCustomerSession();
      const currentId = currentSession?.userId ?? null;

      if (currentId === null) {
        // Guest: immediately clear visible items; do not persist
        hydratedUserRef.current = null;
        setActiveUserId(null);
        setItems([]);
        return;
      }

      if (hydratedUserRef.current !== currentId) {
        // Logged in as new/different user:
        // 1. Reset visible state synchronously before loading to avoid leaking prior user's items
        setItems([]);
        hydratedUserRef.current = currentId;
        setActiveUserId(currentId);
        reloadFromStorage(currentId);
      } else {
        // Same user: ensure in-memory items match storage (e.g. cross-tab update)
        reloadFromStorage(currentId);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      const currentSession = getCustomerSession();
      const currentId = currentSession?.userId ?? null;
      if (currentId === null) return;
      if (!e.key || e.key === getCartStorageKey(currentId)) {
        reloadFromStorage(currentId);
      }
    };

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'CART_SYNC' && e.data?.cartType === 'normal') {
        const currentSession = getCustomerSession();
        const currentId = currentSession?.userId ?? null;
        if (currentId !== null && (!e.data.userId || e.data.userId === currentId)) {
          reloadFromStorage(currentId);
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const currentSession = getCustomerSession();
      const currentId = currentSession?.userId ?? null;
      if (currentId !== null) {
        reloadFromStorage(currentId);
      }
    };

    syncWithSession();

    window.addEventListener('teaplus:customer-auth-changed', syncWithSession);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    cartBroadcastChannel?.addEventListener('message', handleBroadcast);

    return () => {
      window.removeEventListener('teaplus:customer-auth-changed', syncWithSession);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      cartBroadcastChannel?.removeEventListener('message', handleBroadcast);
    };
  }, []);

  // Persist only after active user has been hydrated!
  useEffect(() => {
    const currentSession = getCustomerSession();
    if (!currentSession || activeUserId !== currentSession.userId || hydratedUserRef.current !== currentSession.userId) {
      return;
    }

    try {
      const key = getCartStorageKey(currentSession.userId);
      const serialized = JSON.stringify(items);
      const existing = localStorage.getItem(key);
      if (existing !== serialized) {
        localStorage.setItem(key, serialized);
        broadcastCartSync(currentSession.userId, 'normal');
      }
    } catch {
      // Storage quota or disabled: maintain private in-memory cart safely without shared fallback
    }
  }, [items, activeUserId]);

  const value = useMemo<CartContextValue>(() => {
    const session = getCustomerSession();
    const isGuest = !session || activeUserId === null || activeUserId !== session.userId;

    // For guests, always expose empty counts/totals/items
    if (isGuest) {
      return {
        items: [],
        groups: [],
        count: 0,
        subtotal: 0,
        selectedItems: [],
        selectedCount: 0,
        selectedSubtotal: 0,
        allSelected: false,
        addItem: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ hàng');
          openCustomerLoginModal();
          return false;
        },
        updateItem: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
          return false;
        },
        removeItem: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
        removeItems: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
        setQty: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
        toggleSelect: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
        toggleSelectStore: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
        toggleSelectAll: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
        clear: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
        },
      };
    }

    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

    const selectedItems = items.filter((i) => i.selected !== false);
    const selectedCount = selectedItems.reduce((s, i) => s + i.qty, 0);
    const selectedSubtotal = selectedItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const allSelected = items.length > 0 && selectedItems.length === items.length;

    // Partition into Store Groups
    const groupMap = new Map<string, StoreCartGroup>();
    for (const item of items) {
      const sId = item.storeId ? String(item.storeId) : '1';
      const sName = item.storeName || (sId === '1' ? 'Trà Trái Cây Tô — Chi Nhánh Trung Tâm' : `Chi Nhánh #${sId}`);
      if (!groupMap.has(sId)) {
        groupMap.set(sId, {
          storeId: sId,
          storeName: sName,
          storeDistrict: item.storeDistrict,
          items: [],
          subtotal: 0,
          count: 0,
          allSelected: true,
        });
      }
      const group = groupMap.get(sId)!;
      group.items.push(item);
      group.subtotal += item.qty * item.unitPrice;
      group.count += item.qty;
      if (item.selected === false) {
        group.allSelected = false;
      }
    }

    const groups = Array.from(groupMap.values());

    return {
      items,
      groups,
      count,
      subtotal,
      selectedItems,
      selectedCount,
      selectedSubtotal,
      allSelected,
      addItem: (item) => {
        const currentSession = getCustomerSession();
        if (!currentSession) {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ hàng');
          openCustomerLoginModal();
          return false;
        }
        setItems((prev) => {
          const key = buildCartItemKey(item);
          const now = new Date().toISOString();
          const found = prev.find((p) => p.key === key);
          if (found) {
            return prev.map((p) =>
              p.key === key ? { ...p, qty: p.qty + item.qty, selected: true } : p,
            );
          }
          return [
            ...prev,
            {
              ...item,
              key,
              selected: true,
              addedAt: item.addedAt || now,
              appliedModifiers: item.appliedModifiers || [],
            },
          ];
        });
        return true;
      },
      updateItem: (oldKey, newItem) => {
        const currentSession = getCustomerSession();
        if (!currentSession) {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ hàng');
          openCustomerLoginModal();
          return false;
        }
        setItems((prev) => {
          const newKey = buildCartItemKey(newItem);
          const oldIndex = prev.findIndex((p) => p.key === oldKey);
          if (oldIndex === -1) return prev;

          const oldItem = prev[oldIndex];
          const conflictIndex = prev.findIndex((p) => p.key === newKey && p.key !== oldKey);
          if (conflictIndex !== -1) {
            return prev
              .filter((_, idx) => idx !== oldIndex)
              .map((p, idx) =>
                idx === (conflictIndex > oldIndex ? conflictIndex - 1 : conflictIndex)
                  ? { ...p, qty: p.qty + newItem.qty }
                  : p,
              );
          }

          return prev.map((p) =>
            p.key === oldKey
              ? {
                  ...p,
                  ...newItem,
                  key: newKey,
                  addedAt: oldItem.addedAt || new Date().toISOString(),
                }
              : p,
          );
        });
        return true;
      },
      removeItem: (key) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) => prev.filter((p) => p.key !== key));
      },
      removeItems: (keys) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        const keySet = new Set(keys);
        setItems((prev) => prev.filter((item) => !keySet.has(item.key)));
      },
      setQty: (key, qty) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) =>
          qty <= 0
            ? prev.filter((p) => p.key !== key)
            : prev.map((p) => (p.key === key ? { ...p, qty } : p)),
        );
      },
      toggleSelect: (key, selected) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) =>
          prev.map((p) =>
            p.key === key ? { ...p, selected: selected !== undefined ? selected : !p.selected } : p,
          ),
        );
      },
      toggleSelectStore: (storeId, selected) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) =>
          prev.map((p) => {
            const itemStoreId = p.storeId ? String(p.storeId) : '1';
            return itemStoreId === storeId ? { ...p, selected } : p;
          }),
        );
      },
      toggleSelectAll: (selected) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) => prev.map((p) => ({ ...p, selected })));
      },
      clear: (storeId?: string) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        if (!storeId) {
          setItems([]);
        } else {
          setItems((prev) => {
            return prev.filter((p) => {
              const itemStoreId = p.storeId ? String(p.storeId) : '1';
              return itemStoreId !== storeId;
            });
          });
        }
      },
    };
  }, [items, activeUserId]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}

const PreorderCartContext = createContext<CartContextValue | null>(null);

export function PreorderCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const hydratedUserRef = useRef<number | null>(null);

  useEffect(() => {
    const reloadFromStorage = (userId: number) => {
      let loaded: CartItem[] = [];
      try {
        const raw = localStorage.getItem(getPreorderCartStorageKey(userId));
        loaded = parseStoredCart(raw);
      } catch {
        loaded = [];
      }
      setItems((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(loaded)) {
          return prev;
        }
        return loaded;
      });
    };

    const syncWithSession = () => {
      const currentSession = getCustomerSession();
      const currentId = currentSession?.userId ?? null;

      if (currentId === null) {
        hydratedUserRef.current = null;
        setActiveUserId(null);
        setItems([]);
        return;
      }

      if (hydratedUserRef.current !== currentId) {
        setItems([]);
        hydratedUserRef.current = currentId;
        setActiveUserId(currentId);
        reloadFromStorage(currentId);
      } else {
        reloadFromStorage(currentId);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      const currentSession = getCustomerSession();
      const currentId = currentSession?.userId ?? null;
      if (currentId === null) return;
      if (!e.key || e.key === getPreorderCartStorageKey(currentId)) {
        reloadFromStorage(currentId);
      }
    };

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data?.type === 'CART_SYNC' && e.data?.cartType === 'preorder') {
        const currentSession = getCustomerSession();
        const currentId = currentSession?.userId ?? null;
        if (currentId !== null && (!e.data.userId || e.data.userId === currentId)) {
          reloadFromStorage(currentId);
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const currentSession = getCustomerSession();
      const currentId = currentSession?.userId ?? null;
      if (currentId !== null) {
        reloadFromStorage(currentId);
      }
    };

    syncWithSession();

    window.addEventListener('teaplus:customer-auth-changed', syncWithSession);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    cartBroadcastChannel?.addEventListener('message', handleBroadcast);

    return () => {
      window.removeEventListener('teaplus:customer-auth-changed', syncWithSession);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      cartBroadcastChannel?.removeEventListener('message', handleBroadcast);
    };
  }, []);

  useEffect(() => {
    const currentSession = getCustomerSession();
    if (!currentSession || activeUserId !== currentSession.userId || hydratedUserRef.current !== currentSession.userId) {
      return;
    }

    try {
      const key = getPreorderCartStorageKey(currentSession.userId);
      const serialized = JSON.stringify(items);
      const existing = localStorage.getItem(key);
      if (existing !== serialized) {
        localStorage.setItem(key, serialized);
        broadcastCartSync(currentSession.userId, 'preorder');
      }
    } catch {}
  }, [items, activeUserId]);

  const value = useMemo<CartContextValue>(() => {
    const session = getCustomerSession();
    const isGuest = !session || activeUserId === null || activeUserId !== session.userId;

    if (isGuest) {
      return {
        items: [],
        groups: [],
        count: 0,
        subtotal: 0,
        selectedItems: [],
        selectedCount: 0,
        selectedSubtotal: 0,
        allSelected: false,
        addItem: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ đặt trước');
          openCustomerLoginModal();
          return false;
        },
        updateItem: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
          return false;
        },
        removeItem: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
        removeItems: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
        setQty: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
        toggleSelect: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
        toggleSelectStore: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
        toggleSelectAll: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
        clear: () => {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
        },
      };
    }

    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);

    const selectedItems = items.filter((i) => i.selected !== false);
    const selectedCount = selectedItems.reduce((s, i) => s + i.qty, 0);
    const selectedSubtotal = selectedItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    const allSelected = items.length > 0 && selectedItems.length === items.length;

    const groupMap = new Map<string, StoreCartGroup>();
    for (const item of items) {
      const sId = item.storeId ? String(item.storeId) : '1';
      const sName = item.storeName || (sId === '1' ? 'Trà Trái Cây Tô — Chi Nhánh Trung Tâm' : `Chi Nhánh #${sId}`);
      if (!groupMap.has(sId)) {
        groupMap.set(sId, {
          storeId: sId,
          storeName: sName,
          storeDistrict: item.storeDistrict,
          items: [],
          subtotal: 0,
          count: 0,
          allSelected: true,
        });
      }
      const group = groupMap.get(sId)!;
      group.items.push(item);
      group.subtotal += item.qty * item.unitPrice;
      group.count += item.qty;
      if (item.selected === false) {
        group.allSelected = false;
      }
    }

    const groups = Array.from(groupMap.values());

    return {
      items,
      groups,
      count,
      subtotal,
      selectedItems,
      selectedCount,
      selectedSubtotal,
      allSelected,
      addItem: (item) => {
        const currentSession = getCustomerSession();
        if (!currentSession) {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ đặt trước');
          openCustomerLoginModal();
          return false;
        }
        setItems((prev) => {
          const key = buildCartItemKey(item);
          const now = new Date().toISOString();
          const found = prev.find((p) => p.key === key);
          if (found) {
            return prev.map((p) =>
              p.key === key ? { ...p, qty: p.qty + item.qty, selected: true } : p,
            );
          }
          return [
            ...prev,
            {
              ...item,
              key,
              selected: true,
              addedAt: item.addedAt || now,
              appliedModifiers: item.appliedModifiers || [],
            },
          ];
        });
        return true;
      },
      updateItem: (oldKey, newItem) => {
        const currentSession = getCustomerSession();
        if (!currentSession) {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để sử dụng giỏ đặt trước');
          openCustomerLoginModal();
          return false;
        }
        setItems((prev) => {
          const newKey = buildCartItemKey(newItem);
          const oldIndex = prev.findIndex((p) => p.key === oldKey);
          if (oldIndex === -1) return prev;

          const oldItem = prev[oldIndex];
          const conflictIndex = prev.findIndex((p) => p.key === newKey && p.key !== oldKey);
          if (conflictIndex !== -1) {
            return prev
              .filter((_, idx) => idx !== oldIndex)
              .map((p, idx) =>
                idx === (conflictIndex > oldIndex ? conflictIndex - 1 : conflictIndex)
                  ? { ...p, qty: p.qty + newItem.qty }
                  : p,
              );
          }

          return prev.map((p) =>
            p.key === oldKey
              ? {
                  ...p,
                  ...newItem,
                  key: newKey,
                  addedAt: oldItem.addedAt || new Date().toISOString(),
                }
              : p,
          );
        });
        return true;
      },
      removeItem: (key) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) => prev.filter((p) => p.key !== key));
      },
      removeItems: (keys) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        const keySet = new Set(keys);
        setItems((prev) => prev.filter((item) => !keySet.has(item.key)));
      },
      setQty: (key, qty) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) =>
          qty <= 0
            ? prev.filter((p) => p.key !== key)
            : prev.map((p) => (p.key === key ? { ...p, qty } : p)),
        );
      },
      toggleSelect: (key, selected) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) =>
          prev.map((p) =>
            p.key === key ? { ...p, selected: selected !== undefined ? selected : !p.selected } : p,
          ),
        );
      },
      toggleSelectStore: (storeId, selected) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) =>
          prev.map((p) => {
            const itemStoreId = p.storeId ? String(p.storeId) : '1';
            return itemStoreId === storeId ? { ...p, selected } : p;
          }),
        );
      },
      toggleSelectAll: (selected) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        setItems((prev) => prev.map((p) => ({ ...p, selected })));
      },
      clear: (storeId?: string) => {
        if (!getCustomerSession()) {
          openCustomerLoginModal();
          return;
        }
        if (!storeId) {
          setItems([]);
        } else {
          setItems((prev) => {
            return prev.filter((p) => {
              const itemStoreId = p.storeId ? String(p.storeId) : '1';
              return itemStoreId !== storeId;
            });
          });
        }
      },
    };
  }, [items, activeUserId]);

  return <PreorderCartContext.Provider value={value}>{children}</PreorderCartContext.Provider>;
}

export function usePreorderCart() {
  const ctx = useContext(PreorderCartContext);
  if (!ctx) throw new Error('usePreorderCart must be used inside PreorderCartProvider');
  return ctx;
}
