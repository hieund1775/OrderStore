import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getCustomerToken } from './api';

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

const CART_STORAGE_KEY = 'teaplus_smart_cart_v2';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((i) => ({
            ...i,
            selected: i.selected !== false,
            addedAt: i.addedAt || new Date().toISOString(),
          }));
        }
      }
    } catch {}
    return [];
  });

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
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
        const token = getCustomerToken();
        if (!token) {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ hàng');
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
        setItems((prev) => {
          const newKey = buildCartItemKey(newItem);
          const oldIndex = prev.findIndex((p) => p.key === oldKey);
          if (oldIndex === -1) return prev;

          const oldItem = prev[oldIndex];
          // If key changed and matching item exists elsewhere, merge them
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

          // Otherwise update in place
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
      removeItem: (key) => setItems((prev) => prev.filter((p) => p.key !== key)),
      removeItems: (keys) => {
        const keySet = new Set(keys);
        setItems((prev) => prev.filter((item) => !keySet.has(item.key)));
      },
      setQty: (key, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((p) => p.key !== key)
            : prev.map((p) => (p.key === key ? { ...p, qty } : p)),
        ),
      toggleSelect: (key, selected) => {
        setItems((prev) =>
          prev.map((p) =>
            p.key === key ? { ...p, selected: selected !== undefined ? selected : !p.selected } : p,
          ),
        );
      },
      toggleSelectStore: (storeId, selected) => {
        setItems((prev) =>
          prev.map((p) => {
            const itemStoreId = p.storeId ? String(p.storeId) : '1';
            return itemStoreId === storeId ? { ...p, selected } : p;
          }),
        );
      },
      toggleSelectAll: (selected) => {
        setItems((prev) => prev.map((p) => ({ ...p, selected })));
      },
      clear: (storeId?: string) => {
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
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
