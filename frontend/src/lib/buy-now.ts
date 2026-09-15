import { type CartItem, buildCartItemKey } from './cart';
import { getCustomerSession } from './customer-session';

const BUY_NOW_STORAGE_PREFIX = 'teaplus_buy_now_intent_v1:user:';

export interface BuyNowIntent {
  userId: number;
  createdAt: string;
  item: CartItem;
}

function getBuyNowStorageKey(userId: number): string {
  return `${BUY_NOW_STORAGE_PREFIX}${userId}`;
}

export function isValidBuyNowItem(item: unknown): item is CartItem {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.productId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.unitPrice === 'number' &&
    Number.isFinite(candidate.unitPrice) &&
    typeof candidate.qty === 'number' &&
    candidate.qty > 0
  );
}

/**
 * Retrieve the current active tab's Buy Now checkout intent for the given user.
 * Survives page reloads within the same browser tab.
 * Discards data if user ID does not match or if item shape is invalid.
 */
export function getBuyNowIntent(userId?: number | null): CartItem | null {
  if (!userId || typeof window === 'undefined') return null;
  const session = getCustomerSession();
  if (!session || session.userId !== userId) {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(getBuyNowStorageKey(userId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as BuyNowIntent;
    if (!parsed || typeof parsed !== 'object') {
      clearBuyNowIntent(userId);
      return null;
    }

    if (parsed.userId !== userId || !isValidBuyNowItem(parsed.item)) {
      clearBuyNowIntent(userId);
      return null;
    }

    return {
      ...parsed.item,
      key: parsed.item.key || buildCartItemKey(parsed.item),
      selected: true,
      appliedModifiers: Array.isArray(parsed.item.appliedModifiers) ? parsed.item.appliedModifiers : [],
    };
  } catch {
    clearBuyNowIntent(userId);
    return null;
  }
}

/**
 * Persist an isolated single-item Buy Now intent for the active user in sessionStorage.
 * Never modifies normal cart or preorder cart storage keys.
 */
export function setBuyNowIntent(userId: number, item: Omit<CartItem, 'key'> | CartItem): CartItem {
  const completeItem: CartItem = {
    ...item,
    key: (item as CartItem).key || buildCartItemKey(item),
    selected: true,
    addedAt: item.addedAt || new Date().toISOString(),
    appliedModifiers: Array.isArray(item.appliedModifiers) ? item.appliedModifiers : [],
  };

  if (typeof window !== 'undefined') {
    const payload: BuyNowIntent = {
      userId,
      createdAt: new Date().toISOString(),
      item: completeItem,
    };
    try {
      sessionStorage.setItem(getBuyNowStorageKey(userId), JSON.stringify(payload));
    } catch {
      // Session storage quota or private mode: intent kept in memory if needed
    }
  }

  return completeItem;
}

/**
 * Update the existing Buy Now intent (e.g. after item editing in checkout).
 * Recalculates key deterministically.
 */
export function updateBuyNowIntent(userId: number, updatedItem: Omit<CartItem, 'key'> | CartItem): CartItem {
  return setBuyNowIntent(userId, updatedItem);
}

/**
 * Explicitly clear the Buy Now intent.
 * Only called after successful order/attempt creation or explicit cancellation.
 */
export function clearBuyNowIntent(userId?: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      sessionStorage.removeItem(getBuyNowStorageKey(userId));
    } else {
      const session = getCustomerSession();
      if (session?.userId) {
        sessionStorage.removeItem(getBuyNowStorageKey(session.userId));
      }
      // Also clean up any lingering keys matching prefix in this tab
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(BUY_NOW_STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      for (const k of keysToRemove) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {}
}

export function hasValidBuyNowIntent(userId?: number | null): boolean {
  return getBuyNowIntent(userId) !== null;
}
