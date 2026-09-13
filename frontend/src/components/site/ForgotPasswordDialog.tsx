import React, { useState, useRef, useEffect } from 'react';
import { Phone, Mail, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiPost } from '@/lib/api';
import { toast } from 'sonner';

type ForgotPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBackToLogin: () => void;
};

export function ForgotPasswordDialog({
  open,
  onOpenChange,
  onBackToLogin,
}: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<'phone' | 'email' | 'otp' | 'success'>('phone');
  const [phone, setPhone] = useState('');
  const [recoveryToken, setRecoveryToken] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Clean up interval timer on unmount
  useEffect(() => {
    return () => {
      clearCountdown();
    };
  }, []);

  // Clean up timer when dialog is closed
  useEffect(() => {
    if (!open) {
      clearCountdown();
    }
  }, [open]);

  const startCountdown = (initialSeconds = 60) => {
    clearCountdown();
    setCountdown(initialSeconds);
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearCountdown();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetAllState = () => {
    clearCountdown();
    setStep('phone');
    setPhone('');
    setRecoveryToken('');
    setEmail('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setCountdown(0);
    setLoading(false);
  };

  const handleClose = () => {
    clearCountdown();
    onOpenChange(false);
    setTimeout(() => {
      resetAllState();
    }, 200);
  };

  // Step 1: Verify registered phone
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      toast.error('Vui lòng nhập số điện thoại');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost<{
        verified: boolean;
        recovery_token: string;
        expires_in_seconds: number;
      }>('/api/auth/forgot-password/verify-phone', { phone: cleanPhone });

      if (res?.verified && res?.recovery_token) {
        setRecoveryToken(res.recovery_token);
        setStep('email');
      } else {
        toast.error('Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại số điện thoại.');
      }
    } catch (err: any) {
      if (err?.cooldown_seconds) {
        startCountdown(err.cooldown_seconds);
      }
      toast.error(err?.message || 'Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại số điện thoại.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify email against phone proof and send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryToken) {
      toast.error('Vui lòng xác minh số điện thoại trước.');
      setStep('phone');
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; cooldown_seconds?: number }>(
        '/api/auth/forgot-password/send-otp',
        { email: cleanEmail, recovery_token: recoveryToken },
      );
      toast.success(res.message);
      setStep('otp');
      startCountdown(res.cooldown_seconds || 60);
    } catch (err: any) {
      if (err?.cooldown_seconds) {
        startCountdown(err.cooldown_seconds);
      }
      toast.error(err?.message || 'Thông tin xác thực không hợp lệ. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP in Step 3
  const handleResendOtp = async () => {
    if (countdown > 0 || !recoveryToken) return;
    setLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; cooldown_seconds?: number }>(
        '/api/auth/forgot-password/send-otp',
        { email: email.trim(), recovery_token: recoveryToken },
      );
      toast.success(res.message || 'Đã gửi lại mã xác thực');
      startCountdown(res.cooldown_seconds || 60);
    } catch (err: any) {
      if (err?.cooldown_seconds) {
        startCountdown(err.cooldown_seconds);
      }
      toast.error(err?.message || 'Không thể gửi lại mã xác thực');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password with OTP and recovery proof
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryToken) {
      toast.error('Vui lòng xác minh số điện thoại trước.');
      setStep('phone');
      return;
    }
    if (!code.trim() || code.trim().length !== 6) {
      toast.error('Vui lòng nhập mã OTP 6 số');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string }>(
        '/api/auth/forgot-password/reset',
        {
          email: email.trim(),
          code: code.trim(),
          newPassword,
          recovery_token: recoveryToken,
        },
      );
      toast.success(res.message);
      setRecoveryToken('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {step === 'phone' && 'Quên Mật Khẩu'}
            {step === 'email' && 'Xác Minh Email'}
            {step === 'otp' && 'Xác Thực OTP & Đổi Mật Khẩu'}
            {step === 'success' && 'Thành Công'}
          </DialogTitle>
          <DialogDescription>
            {step === 'phone' &&
              'Nhập số điện thoại đăng ký tài khoản để bắt đầu quy trình khôi phục mật khẩu.'}
            {step === 'email' &&
              'Nhập địa chỉ email liên kết với tài khoản của bạn để nhận mã xác thực OTP.'}
            {step === 'otp' &&
              'Nhập mã OTP 6 số đã được gửi tới email của bạn và thiết lập mật khẩu mới.'}
            {step === 'success' &&
              'Mật khẩu của bạn đã được đặt lại thành công. Hãy đăng nhập với mật khẩu mới.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' && (
          <form onSubmit={handleVerifyPhone} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="forgot-phone">Số điện thoại đăng ký</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="0901234567"
                  className="pl-9"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  handleClose();
                  onBackToLogin();
                }}
              >
                <ArrowLeft className="mr-2 size-4" /> Quay lại
              </Button>
              <Button type="submit" variant="hero" className="flex-1 font-bold" disabled={loading}>
                {loading ? 'Đang kiểm tra…' : 'Tiếp tục'}
              </Button>
            </div>
          </form>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Địa chỉ Email tài khoản</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="example@email.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  resetAllState();
                }}
              >
                <ArrowLeft className="mr-2 size-4" /> Đổi số điện thoại
              </Button>
              <Button type="submit" variant="hero" className="flex-1 font-bold" disabled={loading}>
                {loading ? 'Đang gửi…' : 'Gửi mã xác thực'}
              </Button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleResetPassword} className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="forgot-otp">Mã OTP (6 số)</Label>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={countdown > 0 || loading}
                  className="text-xs text-primary hover:underline disabled:text-muted-foreground"
                >
                  {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại mã'}
                </button>
              </div>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-otp"
                  placeholder="123456"
                  maxLength={6}
                  className="pl-9 font-mono tracking-widest text-center text-lg font-bold"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-new-pwd">Mật khẩu mới (tối thiểu 8 ký tự)</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-new-pwd"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forgot-confirm-pwd">Xác nhận mật khẩu mới</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="forgot-confirm-pwd"
                  type="password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setStep('email');
                }}
              >
                <ArrowLeft className="mr-2 size-4" /> Đổi Email
              </Button>
              <Button type="submit" variant="hero" className="flex-1 font-bold" disabled={loading}>
                {loading ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
              </Button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="size-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              Mật khẩu mới đã được cập nhật thành công.
            </p>
            <Button
              className="w-full font-bold"
              variant="hero"
              onClick={() => {
                handleClose();
                onBackToLogin();
              }}
            >
              Đăng nhập ngay
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
