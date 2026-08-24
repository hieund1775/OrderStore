import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { getCustomerToken } from './api';

export type CartItem = {
  key: string;
  productId: string;
  name: string;
  image: string;
  size: string;
  base: string;
  sugar: string;
  ice: string;
  toppings: string[];
  note?: string;
  unitPrice: number;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'key'>) => boolean;
  removeItem: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
    return {
      items,
      count,
      subtotal,
      addItem: (item) => {
        const token = getCustomerToken();
        if (!token) {
          toast.error('Vui lòng đăng nhập hoặc đăng ký tài khoản để thêm món vào giỏ hàng');
          return false;
        }
        setItems((prev) => {
          const key = [
            item.productId,
            item.size,
            item.base,
            item.sugar,
            item.ice,
            item.toppings.join('|'),
          ].join('__');
          const found = prev.find((p) => p.key === key);
          if (found) {
            return prev.map((p) => (p.key === key ? { ...p, qty: p.qty + item.qty } : p));
          }
          return [...prev, { ...item, key }];
        });
        return true;
      },
      removeItem: (key) => setItems((prev) => prev.filter((p) => p.key !== key)),
      setQty: (key, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((p) => p.key !== key)
            : prev.map((p) => (p.key === key ? { ...p, qty } : p)),
        ),
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
