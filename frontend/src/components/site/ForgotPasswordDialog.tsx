import React, { useState } from 'react';
import { Mail, KeyRound, ArrowLeft, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
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
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      toast.error('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; demo_otp?: string }>(
        '/api/auth/forgot-password/send-otp',
        { email: email.trim() },
      );
      toast.success(res.message);
      if (res.demo_otp) {
        toast.info(`[Demo / Staging] Mã OTP của bạn là: ${res.demo_otp}`);
      }
      setStep('otp');
      startCountdown();
    } catch (err: any) {
      toast.error(err?.message || 'Không tìm thấy tài khoản hoặc gửi mã thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      const res = await apiPost<{ success: boolean; message: string; demo_otp?: string }>(
        '/api/auth/forgot-password/send-otp',
        { email: email.trim() },
      );
      toast.success('Đã gửi lại mã OTP');
      if (res.demo_otp) {
        toast.info(`[Demo / Staging] Mã OTP của bạn là: ${res.demo_otp}`);
      }
      startCountdown();
    } catch (err: any) {
      toast.error(err?.message || 'Không thể gửi lại mã OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
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
        },
      );
      toast.success(res.message);
      setStep('success');
    } catch (err: any) {
      toast.error(err?.message || 'Mã OTP không đúng hoặc đặt lại mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close
    setTimeout(() => {
      setStep('email');
      setEmail('');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {step === 'email' && 'Quên Mật Khẩu'}
            {step === 'otp' && 'Xác Thực OTP & Đổi Mật Khẩu'}
            {step === 'success' && 'Thành Công'}
          </DialogTitle>
          <DialogDescription>
            {step === 'email' &&
              'Nhập địa chỉ email liên kết với tài khoản của bạn để nhận mã xác thực OTP khôi phục mật khẩu.'}
            {step === 'otp' &&
              `Nhập mã OTP 6 số vừa được gửi tới email ${email} và thiết lập mật khẩu mới.`}
            {step === 'success' &&
              'Mật khẩu của bạn đã được đặt lại thành công. Hãy đăng nhập với mật khẩu mới.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Địa chỉ Email</Label>
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
                  handleClose();
                  onBackToLogin();
                }}
              >
                <ArrowLeft className="mr-2 size-4" /> Quay lại
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
                onClick={() => setStep('email')}
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
              Mật khẩu mới đã được cập nhật thành công cho tài khoản <b>{email}</b>.
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
