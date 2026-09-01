import { describe, it, expect } from 'vitest';
import { normalizePendingPayment, parsePendingPaymentFromSession } from '../pending-payment';

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
