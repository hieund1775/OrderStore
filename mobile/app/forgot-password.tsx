import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Mail, KeyRound, Eye, EyeOff, CheckCircle2, BellRing } from 'lucide-react-native';
import { sendForgotPasswordOtp, resetPassword } from '../src/lib/api';

type Step = 'email' | 'otp' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ (vd: yourname@gmail.com)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await sendForgotPasswordOtp(cleanEmail);
      setStep('otp');
      startCountdown();
      if (res?.dev_code) {
        setDevCode(res.dev_code);
      }
      const successMsg = res?.message || `Mã xác thực đã được gửi tới email ${cleanEmail}`;
      setNotification(successMsg);
      Alert.alert(
        'Đã gửi mã xác thực!',
        `Hệ thống đã gửi mã OTP xác nhận về địa chỉ email:\n${cleanEmail}\n\nVui lòng kiểm tra hộp thư đến (hoặc hòm thư rác/spam) của bạn để lấy mã xác thực.`
      );
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi mã xác thực, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setLoading(true);
    setError('');

    try {
      const res = await sendForgotPasswordOtp(email.trim().toLowerCase());
      startCountdown();
      if (res?.dev_code) {
        setDevCode(res.dev_code);
      }
      Alert.alert('Đã gửi lại mã', 'Mã xác thực mới đã được gửi tới email của bạn.');
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi lại mã, vui lòng thử lại');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Vui lòng nhập đầy đủ mã OTP gồm 6 chữ số');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await resetPassword(email.trim().toLowerCase(), cleanCode, newPassword);
      setStep('success');
    } catch (err: any) {
      setError(err?.message || 'Mã OTP không đúng hoặc đã hết hạn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back navigation */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={18} color="#ea580c" />
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            {step === 'email' && <Mail size={28} color="#ea580c" />}
            {step === 'otp' && <KeyRound size={28} color="#ea580c" />}
            {step === 'success' && <CheckCircle2 size={32} color="#16a34a" />}
          </View>
          <Text style={styles.title}>
            {step === 'email' && 'Quên mật khẩu'}
            {step === 'otp' && 'Xác thực & Đổi mật khẩu'}
            {step === 'success' && 'Thành công!'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'email' && 'Nhập email tài khoản của bạn để nhận mã OTP xác nhận đặt lại mật khẩu.'}
            {step === 'otp' && `Nhập mã 6 chữ số đã gửi tới ${email} để thiết lập mật khẩu mới.`}
            {step === 'success' && 'Mật khẩu mới đã được cập nhật thành công cho tài khoản của bạn.'}
          </Text>
        </View>

        {/* Step 1: Input Email */}
        {step === 'email' && (
          <View style={styles.formCard}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Địa chỉ Email nhận mã</Text>
              <View style={styles.inputWrap}>
                <Mail size={18} color="#ea580c" style={styles.inputLeadingIcon} />
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="name@example.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={(text) => { setEmail(text); setError(''); }}
                  editable={!loading}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Gửi mã xác thực</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Input OTP & Set New Password */}
        {step === 'otp' && (
          <View style={styles.formCard}>
            {/* Notification of dispatched email */}
            {notification ? (
              <View style={styles.noticeBanner}>
                <Mail size={18} color="#0284c7" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeTitle}>Đã gửi mã tới email</Text>
                  <Text style={styles.noticeText}>{notification}</Text>
                </View>
              </View>
            ) : null}

            {/* In-app quick fill pill for fast verification */}
            {devCode ? (
              <TouchableOpacity
                style={styles.devCodeBanner}
                onPress={() => setCode(devCode)}
                activeOpacity={0.7}
              >
                <BellRing size={16} color="#d97706" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.devCodeTitle}>Mã OTP xác thực:</Text>
                  <Text style={styles.devCodeValue}>{devCode}</Text>
                </View>
                <View style={styles.devCodeAction}>
                  <Text style={styles.devCodeActionText}>Điền nhanh</Text>
                </View>
              </TouchableOpacity>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* OTP Code input */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Mã xác thực OTP (6 số)</Text>
                <TouchableOpacity onPress={handleResendOtp} disabled={countdown > 0 || loading}>
                  <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại mã'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="000000"
                placeholderTextColor="#cbd5e1"
                keyboardType="number-pad"
                maxLength={6}
                value={code}
                onChangeText={(text) => { setCode(text.replace(/\D/g, '')); setError(''); }}
                editable={!loading}
              />
            </View>

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu mới (tối thiểu 8 ký tự)</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.inputWithIcon, { paddingLeft: 14, paddingRight: 42 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                  value={newPassword}
                  onChangeText={(text) => { setNewPassword(text); setError(''); }}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.inputTrailingBtn}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} color="#ea580c" /> : <Eye size={18} color="#9ca3af" />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.inputWithIcon, { paddingLeft: 14, paddingRight: 42 }]}
                  placeholder="••••••••"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmPassword}
                  onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
                  editable={!loading}
                />
                <TouchableOpacity
                  style={styles.inputTrailingBtn}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff size={18} color="#ea580c" /> : <Eye size={18} color="#9ca3af" />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Cập nhật mật khẩu mới</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Success Screen */}
        {step === 'success' && (
          <View style={styles.formCard}>
            <View style={styles.successBadge}>
              <CheckCircle2 size={48} color="#16a34a" />
            </View>
            <Text style={styles.successTitle}>Đổi mật khẩu thành công!</Text>
            <Text style={styles.successText}>
              Tài khoản {email} đã được cập nhật mật khẩu mới. Bạn có thể sử dụng mật khẩu mới này để đăng nhập ngay bây giờ.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#ffedd5',
  },
  backText: {
    color: '#ea580c',
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
    textAlign: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369a1',
    marginBottom: 2,
  },
  noticeText: {
    fontSize: 12,
    color: '#0c4a6e',
    lineHeight: 18,
  },
  devCodeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  devCodeTitle: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '600',
  },
  devCodeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#b45309',
    letterSpacing: 2,
  },
  devCodeAction: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  devCodeActionText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputLeadingIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  inputTrailingBtn: {
    position: 'absolute',
    right: 12,
    padding: 6,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  inputWithIcon: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingLeft: 42,
    paddingRight: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 22,
    letterSpacing: 10,
    fontWeight: '800',
    color: '#ea580c',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resendText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '700',
  },
  resendDisabled: {
    color: '#9ca3af',
  },
  primaryButton: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  successBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#15803d',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    paddingHorizontal: 8,
  },
});