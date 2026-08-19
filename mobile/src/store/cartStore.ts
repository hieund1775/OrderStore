import { create } from 'zustand';
import { CartItem, Store, TableInfo, Voucher } from '../types';

interface CartState {
  items: CartItem[];
  selectedStore: Store | null;
  selectedTable: TableInfo | null;
  orderType: 'DineIn' | 'Takeaway' | 'Delivery';
  appliedVoucher: Voucher | null;
  discountAmount: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  note: string;

  // Actions
  addItem: (item: Omit<CartItem, 'id' | 'item_total'>) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  setStore: (store: Store | null) => void;
  setTable: (table: TableInfo | null) => void;
  setOrderType: (type: 'DineIn' | 'Takeaway' | 'Delivery') => void;
  setAppliedVoucher: (voucher: Voucher | null, discount?: number) => void;
  setCustomerInfo: (info: { name?: string; phone?: string; address?: string; note?: string }) => void;

  // Selectors
  itemCount: () => number;
  subtotal: () => number;
  total: () => number;
}

function generateItemHash(item: Omit<CartItem, 'id' | 'item_total'>): string {
  const toppingStr = (item.toppings || []).map((t) => t.name).sort().join(',');
  return `${item.product_id}-${item.size_label}-${item.sugar_level}-${item.ice_level}-${item.base_tea || ''}-${toppingStr}-${item.note || ''}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  selectedStore: null,
  selectedTable: null,
  orderType: 'Takeaway',
  appliedVoucher: null,
  discountAmount: 0,
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  note: '',

  addItem: (itemData) => {
    const hash = generateItemHash(itemData);
    const itemTotal = (itemData.unit_price + itemData.size_price + (itemData.toppings || []).reduce((s, t) => s + t.price, 0)) * itemData.quantity;

    set((state) => {
      const existingIndex = state.items.findIndex((it) => it.id === hash);
      if (existingIndex > -1) {
        const updated = [...state.items];
        const exist = updated[existingIndex];
        const newQty = exist.quantity + itemData.quantity;
        const singlePrice = exist.item_total / exist.quantity;
        updated[existingIndex] = {
          ...exist,
          quantity: newQty,
          item_total: singlePrice * newQty,
        };
        return { items: updated };
      }

      return {
        items: [...state.items, { ...itemData, id: hash, item_total: itemTotal }],
      };
    });
  },

  removeItem: (itemId) => {
    set((state) => ({
      items: state.items.filter((it) => it.id !== itemId),
    }));
  },

  updateQuantity: (itemId, delta) => {
    set((state) => {
      const updated = state.items
        .map((it) => {
          if (it.id === itemId) {
            const singlePrice = it.item_total / it.quantity;
            const newQty = it.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...it,
              quantity: newQty,
              item_total: singlePrice * newQty,
            };
          }
          return it;
        })
        .filter(Boolean) as CartItem[];

      return { items: updated };
    });
  },

  clearCart: () => {
    set({
      items: [],
      appliedVoucher: null,
      discountAmount: 0,
    });
  },

  setStore: (store) => set({ selectedStore: store }),
  setTable: (table) => {
    if (table) {
      set({ selectedTable: table, orderType: 'DineIn' });
    } else {
      set({ selectedTable: null });
    }
  },
  setOrderType: (type) => set({ orderType: type }),
  setAppliedVoucher: (voucher, discount = 0) => set({ appliedVoucher: voucher, discountAmount: discount }),
  setCustomerInfo: (info) =>
    set((state) => ({
      customerName: info.name !== undefined ? info.name : state.customerName,
      customerPhone: info.phone !== undefined ? info.phone : state.customerPhone,
      deliveryAddress: info.address !== undefined ? info.address : state.deliveryAddress,
      note: info.note !== undefined ? info.note : state.note,
    })),

  itemCount: () => get().items.reduce((count, it) => count + it.quantity, 0),
  subtotal: () => get().items.reduce((sum, it) => sum + it.item_total, 0),
  total: () => Math.max(0, get().subtotal() - get().discountAmount),
}));
