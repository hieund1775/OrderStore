import { describe, it, expect } from 'vitest';
import {
  normalizePendingPayment,
  parsePendingPaymentFromSession,
  canCancelPendingPayment,
} from '../pending-payment';

describe('Pending Payment Normalization & Recovery (G1)', () => {
  it('normalizes single order response with order_code and total', () => {
    const response = {
      order_code: 'TP2609011234',
      order_id: 101,
      total: 65000,
      checkout_url: 'https://payos.vn/gate/1',
      qr_code: 'qr_data_single',
      payment_expires_at: '2026-09-01T12:00:00Z',
    };

    const normalized = normalizePendingPayment(response);
    expect(normalized).not.toBeNull();
    expect(normalized?.payment_code).toBe('TP2609011234');
    expect(normalized?.order_code).toBe('TP2609011234');
    expect(normalized?.order_id).toBe(101);
    expect(normalized?.total).toBe(65000);
    expect(normalized?.is_grouped).toBe(false);
    expect(normalized?.checkout_url).toBe('https://payos.vn/gate/1');
    expect(normalized?.qr_code).toBe('qr_data_single');
  });

  it('normalizes grouped order response with group_code and total_amount', () => {
    const response = {
      is_grouped: true,
      group_code: 'GRP2609019999',
      total_amount: 150000,
      checkout_url: 'https://payos.vn/gate/group',
      qr_code: 'qr_data_group',
      payment_expires_at: '2026-09-01T12:15:00Z',
    };

    const normalized = normalizePendingPayment(response);
    expect(normalized).not.toBeNull();
    expect(normalized?.payment_code).toBe('GRP2609019999');
    expect(normalized?.order_code).toBe('GRP2609019999');
    expect(normalized?.order_id).toBeNull();
    expect(normalized?.total).toBe(150000);
    expect(normalized?.is_grouped).toBe(true);
    expect(normalized?.checkout_url).toBe('https://payos.vn/gate/group');
    expect(normalized?.qr_code).toBe('qr_data_group');
  });

  it('recovers legacy session format containing only order_code', () => {
    const legacySessionRaw = JSON.stringify({
      order_code: 'TP_LEGACY_001',
      order_id: 55,
      total: 45000,
      qr_code: 'legacy_qr',
    });

    const parsed = parsePendingPaymentFromSession(legacySessionRaw);
    expect(parsed).not.toBeNull();
    expect(parsed?.payment_code).toBe('TP_LEGACY_001');
    expect(parsed?.total).toBe(45000);
    expect(parsed?.is_grouped).toBe(false);
  });

  it('recovers grouped session format containing payment_code and group_code', () => {
    const groupSessionRaw = JSON.stringify({
      payment_code: 'GRP2609010001',
      is_grouped: true,
      total: 120000,
      qr_code: 'grp_qr',
      payment_expires_at: '2026-09-01T13:00:00Z',
    });

    const parsed = parsePendingPaymentFromSession(groupSessionRaw);
    expect(parsed).not.toBeNull();
    expect(parsed?.payment_code).toBe('GRP2609010001');
    expect(parsed?.total).toBe(120000);
    expect(parsed?.is_grouped).toBe(true);
  });

  it('returns null on invalid or empty session payload', () => {
    expect(parsePendingPaymentFromSession(null)).toBeNull();
    expect(parsePendingPaymentFromSession('')).toBeNull();
    expect(parsePendingPaymentFromSession('{ invalid json')).toBeNull();
    expect(parsePendingPaymentFromSession('{}')).toBeNull();
  });
});

describe('Pending Payment Cancellation Policy (H1)', () => {
  it('permits cancellation for single orders', () => {
    const singlePayment = {
      payment_code: 'TP2609010001',
      order_code: 'TP2609010001',
      order_id: 10,
      total: 50000,
      is_grouped: false,
    };
    expect(canCancelPendingPayment(singlePayment)).toBe(true);
  });

  it('strictly prohibits cancellation for grouped orders (must cancel child orders individually)', () => {
    const groupPayment1 = {
      payment_code: 'GRP2609019999',
      order_code: 'GRP2609019999',
      order_id: null,
      total: 100000,
      is_grouped: true,
    };
    expect(canCancelPendingPayment(groupPayment1)).toBe(false);

    const groupPayment2 = {
      payment_code: 'GRP2609018888',
      total: 100000,
      is_grouped: false, // defensive check on code prefix
    };
    expect(canCancelPendingPayment(groupPayment2)).toBe(false);
  });

  it('returns false for null or undefined payment', () => {
    expect(canCancelPendingPayment(null)).toBe(false);
    expect(canCancelPendingPayment(undefined)).toBe(false);
  });
});

