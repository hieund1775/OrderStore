import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ForgotPasswordDialog } from '../ForgotPasswordDialog';
import * as apiModule from '@/lib/api';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function changeInput(element: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeInputValueSetter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('ForgotPasswordDialog Phone-First Flow', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  it('dialog starts with phone input, not email', async () => {
    await act(async () => {
      root.render(
        <ForgotPasswordDialog
          open={true}
          onOpenChange={vi.fn()}
          onBackToLogin={vi.fn()}
        />,
      );
    });

    const phoneInput = document.querySelector('input#forgot-phone') as HTMLInputElement;
    const emailInput = document.querySelector('input#forgot-email');
    const otpInput = document.querySelector('input#forgot-otp');

    expect(phoneInput).not.toBeNull();
    expect(emailInput).toBeNull();
    expect(otpInput).toBeNull();
    expect(document.body.textContent).toContain('Số điện thoại đăng ký');
  });

  it('invalid phone does not advance to email step and shows error', async () => {
    const apiPostSpy = vi.spyOn(apiModule, 'apiPost').mockRejectedValueOnce(
      new Error('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại số điện thoại.'),
    );

    await act(async () => {
      root.render(
        <ForgotPasswordDialog
          open={true}
          onOpenChange={vi.fn()}
          onBackToLogin={vi.fn()}
        />,
      );
    });

    const phoneInput = document.querySelector('input#forgot-phone') as HTMLInputElement;
    await act(async () => {
      changeInput(phoneInput, '0999999999');
    });

    const form = document.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(apiPostSpy).toHaveBeenCalledWith('/api/auth/forgot-password/verify-phone', {
      phone: '0999999999',
    });
    expect(toast.error).toHaveBeenCalledWith('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại số điện thoại.');

    // Remains on phone step, no email input rendered
    expect(document.querySelector('input#forgot-phone')).not.toBeNull();
    expect(document.querySelector('input#forgot-email')).toBeNull();
  });

  it('successful phone verification advances to email step', async () => {
    vi.spyOn(apiModule, 'apiPost').mockResolvedValueOnce({
      verified: true,
      recovery_token: 'mock-recovery-proof-token',
      expires_in_seconds: 300,
    });

    await act(async () => {
      root.render(
        <ForgotPasswordDialog
          open={true}
          onOpenChange={vi.fn()}
          onBackToLogin={vi.fn()}
        />,
      );
    });

    const phoneInput = document.querySelector('input#forgot-phone') as HTMLInputElement;
    await act(async () => {
      changeInput(phoneInput, '0901234567');
    });

    const form = document.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Now on email step
    expect(document.querySelector('input#forgot-phone')).toBeNull();
    expect(document.querySelector('input#forgot-email')).not.toBeNull();
    expect(document.body.textContent).toContain('Địa chỉ Email tài khoản');
  });

  it('wrong email in step 2 stays out of OTP step and shows error', async () => {
    vi.spyOn(apiModule, 'apiPost')
      .mockResolvedValueOnce({
        verified: true,
        recovery_token: 'mock-recovery-proof-token',
        expires_in_seconds: 300,
      })
      .mockRejectedValueOnce(
        new Error('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại.'),
      );

    await act(async () => {
      root.render(
        <ForgotPasswordDialog
          open={true}
          onOpenChange={vi.fn()}
          onBackToLogin={vi.fn()}
        />,
      );
    });

    // Phone step
    const phoneInput = document.querySelector('input#forgot-phone') as HTMLInputElement;
    await act(async () => {
      changeInput(phoneInput, '0901234567');
    });
    const form1 = document.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form1.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // Email step
    const emailInput = document.querySelector('input#forgot-email') as HTMLInputElement;
    expect(emailInput).not.toBeNull();
    await act(async () => {
      changeInput(emailInput, 'wrong@example.com');
    });
    const form2 = document.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form2.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(toast.error).toHaveBeenCalledWith('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại.');
    // Stays on email step, OTP input is not rendered
    expect(document.querySelector('input#forgot-email')).not.toBeNull();
    expect(document.querySelector('input#forgot-otp')).toBeNull();
  });

  it('matching email advances to OTP step and reset submits recovery proof token', async () => {
    const apiPostSpy = vi.spyOn(apiModule, 'apiPost')
      .mockResolvedValueOnce({
        verified: true,
        recovery_token: 'mock-recovery-proof-token',
        expires_in_seconds: 300,
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Mã xác thực đã được gửi tới email của bạn',
        cooldown_seconds: 60,
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay với mật khẩu mới.',
      });

    await act(async () => {
      root.render(
        <ForgotPasswordDialog
          open={true}
          onOpenChange={vi.fn()}
          onBackToLogin={vi.fn()}
        />,
      );
    });

    // 1. Phone step
    const phoneInput = document.querySelector('input#forgot-phone') as HTMLInputElement;
    await act(async () => {
      changeInput(phoneInput, '0901234567');
    });
    await act(async () => {
      document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // 2. Email step
    const emailInput = document.querySelector('input#forgot-email') as HTMLInputElement;
    await act(async () => {
      changeInput(emailInput, 'correct@example.com');
    });
    await act(async () => {
      document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(apiPostSpy).toHaveBeenCalledWith('/api/auth/forgot-password/send-otp', {
      email: 'correct@example.com',
      recovery_token: 'mock-recovery-proof-token',
    });

    // 3. In OTP step
    const otpInput = document.querySelector('input#forgot-otp') as HTMLInputElement;
    const newPwdInput = document.querySelector('input#forgot-new-pwd') as HTMLInputElement;
    const confirmPwdInput = document.querySelector('input#forgot-confirm-pwd') as HTMLInputElement;

    expect(otpInput).not.toBeNull();
    expect(newPwdInput).not.toBeNull();
    expect(confirmPwdInput).not.toBeNull();

    await act(async () => {
      changeInput(otpInput, '123456');
      changeInput(newPwdInput, 'NewPassword123');
      changeInput(confirmPwdInput, 'NewPassword123');
    });

    await act(async () => {
      document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(apiPostSpy).toHaveBeenCalledWith('/api/auth/forgot-password/reset', {
      email: 'correct@example.com',
      code: '123456',
      newPassword: 'NewPassword123',
      recovery_token: 'mock-recovery-proof-token',
    });

    // 4. Success step
    expect(document.body.textContent).toContain('Mật khẩu của bạn đã được đặt lại thành công.');
  });
});
