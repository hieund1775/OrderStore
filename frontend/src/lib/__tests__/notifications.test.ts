import { beforeEach, describe, expect, it } from 'vitest';
import { customerNotificationsKey, isSafeInternalLink, type NotificationResponse } from '../notifications';
import { handleLocalMock } from '../mock-engine';

describe('notification isolation and navigation safety', () => {
  beforeEach(() => window.localStorage.clear());

  it('uses a different React Query key for every customer', () => {
    expect(customerNotificationsKey(10)).not.toEqual(customerNotificationsKey(11));
  });

  it('accepts only safe internal paths', () => {
    expect(isSafeInternalLink('/theo-doi-don?code=TP1')).toBe(true);
    expect(isSafeInternalLink('//evil.example')).toBe(false);
    expect(isSafeInternalLink('/\\evil.example')).toBe(false);
    expect(isSafeInternalLink('https://evil.example')).toBe(false);
    expect(isSafeInternalLink('javascript:alert(1)')).toBe(false);
  });

  it('keeps standalone notification state isolated by account', async () => {
    await handleLocalMock('/api/users/10/notifications/1/read', { method: 'PATCH', body: '{}' });

    const customer10 = await handleLocalMock<NotificationResponse>('/api/users/10/notifications');
    const customer11 = await handleLocalMock<NotificationResponse>('/api/users/11/notifications');

    expect(customer10.notifications[0].is_read).toBe(true);
    expect(customer11.notifications[0].is_read).toBe(false);
    expect(customer10.notifications[0].user_id).toBe(10);
    expect(customer11.notifications[0].user_id).toBe(11);
  });
});
