/**
 * Create Staff Account Screen — Thiết kế chuẩn Web Admin UI
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChefHat,
  ShoppingCart,
  Package,
  Briefcase,
  Store,
  UserPlus,
  Check,
  ShieldAlert,
} from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/authStore';
import { createStaffAccount, fetchBranches } from '../../../src/lib/api';
import { AdminHeader } from '../../../src/components/AdminHeader';

const ROLE_CARDS = [
  { value: 'manager', label: 'Store Manager', icon: Briefcase, desc: 'Quản lý cửa hàng (Chỉ Super Admin)' },
  { value: 'cashier', label: 'Cashier Staff', icon: ShoppingCart, desc: 'Thu ngân quầy' },
  { value: 'kitchen', label: 'Kitchen Staff', icon: ChefHat, desc: 'Pha chế & Bếp' },
  { value: 'packing', label: 'Packing Staff', icon: Package, desc: 'Đóng gói xuất kho' },
];

const DEFAULT_BRANCHES = [
  { id: 1, name: 'TeaPlus Quận 1 - Nguyễn Huệ', address: '123 Nguyễn Huệ, Quận 1' },
  { id: 2, name: 'TeaPlus Bình Thạnh - D2', address: '45 Nguyễn Gia Trí, Bình Thạnh' },
];

export default function CreateAccountScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isSuper = user?.role === 'super';
  const isManager = user?.role === 'manager';
  const canManageAccounts = isSuper || isManager;

  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('cashier');
  const [branches, setBranches] = useState<any[]>(DEFAULT_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState<string>('1');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Manager is only allowed to create operational roles (cashier, kitchen, packing)
  const availableRoleCards = isSuper
    ? ROLE_CARDS
    : ROLE_CARDS.filter((r) => r.value !== 'manager');

  useEffect(() => {
    if (isSuper) {
      fetchBranches()
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setBranches(data);
            setSelectedBranch(String(data[0].id));
          }
        })
        .catch(() => {
          setBranches(DEFAULT_BRANCHES);
        });
    }
  }, [isSuper]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/accounts');
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!fullname.trim()) {
      setError('Vui lòng nhập họ và tên nhân viên');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ');
      return;
    }

    setSubmitting(true);
    try {
      const targetBranchId = isSuper
        ? (selectedBranch ? Number(selectedBranch) : null)
        : (user?.branch_id || 1);

      const result = await createStaffAccount({
        fullname: fullname.trim(),
        email: email.trim(),
        role: selectedRole,
        branch_id: targetBranchId,
      });

      Alert.alert(
        'Tạo tài khoản thành công',
        result.message || 'Nhân viên đã được tạo và kích hoạt trong hệ thống.',
        [
          {
            text: 'Hoàn tất',
            onPress: handleBack,
          },
        ],
      );
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo tài khoản nhân viên');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManageAccounts) {
    return (
      <View style={styles.forbiddenContainer}>
        <View style={styles.forbiddenIconBox}>
          <ShieldAlert size={52} color="#ef4444" strokeWidth={2} />
        </View>
        <Text style={styles.forbiddenTitle}>Không có quyền truy cập</Text>
        <Text style={styles.forbiddenDesc}>
          Chức năng tạo nhân viên mới chỉ dành riêng cho Super Admin và Quản lý chi nhánh (Manager).
        </Text>
        <TouchableOpacity style={styles.forbiddenBtn} onPress={handleBack}>
          <Text style={styles.forbiddenBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AdminHeader
        title="Tạo tài khoản nhân viên"
        subtitle="Nhân viên sẽ nhận email mời thiết lập mật khẩu lần đầu"
        showBack={true}
        onBack={handleBack}
        branchName={user?.branch_name || undefined}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Form Card matching Web shadcn Card */}
        <View style={styles.formCard}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Họ và tên *</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Nguyễn Văn A"
              placeholderTextColor="#94a3b8"
              value={fullname}
              onChangeText={(text) => {
                setFullname(text);
                setError('');
              }}
              editable={!submitting}
            />
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email làm việc *</Text>
            <TextInput
              style={styles.input}
              placeholder="nhanvien@teaplus.vn"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              editable={!submitting}
            />
          </View>

          {/* Role Selection Grid */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vai trò trong hệ thống</Text>
            <View style={styles.roleGrid}>
              {availableRoleCards.map((opt) => {
                const isSelected = selectedRole === opt.value;
                const IconComponent = opt.icon;

                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.roleCard, isSelected && styles.roleCardSelected]}
                    onPress={() => setSelectedRole(opt.value)}
                    disabled={submitting}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.roleIconCircle, isSelected && styles.roleIconCircleSelected]}>
                      <IconComponent size={18} color={isSelected ? '#f97316' : '#64748b'} />
                    </View>
                    <View style={styles.roleInfo}>
                      <Text style={[styles.roleTitle, isSelected && styles.roleTitleSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.roleDesc}>{opt.desc}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Check size={12} color="#ffffff" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Branch Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Chi nhánh làm việc</Text>
            {isSuper ? (
              <View style={styles.branchList}>
                {branches.map((b) => {
                  const isSelected = selectedBranch === String(b.id);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.branchCard, isSelected && styles.branchCardSelected]}
                      onPress={() => setSelectedBranch(String(b.id))}
                      disabled={submitting}
                      activeOpacity={0.8}
                    >
                      <View style={styles.branchLeft}>
                        <View style={[styles.branchIconBox, isSelected && styles.branchIconBoxSelected]}>
                          <Store size={16} color={isSelected ? '#f97316' : '#64748b'} />
                        </View>
                        <View>
                          <Text style={[styles.branchName, isSelected && styles.branchNameSelected]}>
                            {b.name}
                          </Text>
                          {b.address && <Text style={styles.branchAddress}>{b.address}</Text>}
                        </View>
                      </View>
                      {isSelected && (
                        <View style={styles.checkBadge}>
                          <Check size={12} color="#ffffff" strokeWidth={3} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.fixedBranchBox}>
                <View style={styles.fixedBranchIcon}>
                  <Store size={18} color="#f97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fixedBranchTitle}>
                    {user?.branch_name || 'TeaPlus Quận 1 - Nguyễn Huệ'}
                  </Text>
                  <Text style={styles.fixedBranchSub}>
                    Quản lý chi nhánh chỉ phân quyền nhân sự tại cửa hàng sở tại
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.submitBtnContent}>
                <UserPlus size={18} color="#ffffff" strokeWidth={2.4} />
                <Text style={styles.submitBtnText}>Tạo tài khoản</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0f172a',
  },
  roleGrid: {
    gap: 10,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  roleCardSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  roleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleIconCircleSelected: {
    backgroundColor: '#ffedd5',
  },
  roleInfo: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  roleTitleSelected: {
    color: '#ea580c',
  },
  roleDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  branchList: {
    gap: 10,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
  },
  branchCardSelected: {
    borderColor: '#f97316',
    backgroundColor: '#fff7ed',
  },
  branchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  branchIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  branchIconBoxSelected: {
    backgroundColor: '#ffedd5',
  },
  branchName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  branchNameSelected: {
    color: '#ea580c',
  },
  branchAddress: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  checkBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  submitBtn: {
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  fixedBranchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  fixedBranchIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixedBranchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#c2410c',
  },
  fixedBranchSub: {
    fontSize: 11,
    color: '#ea580c',
    marginTop: 2,
  },
  forbiddenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  forbiddenIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  forbiddenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  forbiddenDesc: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  forbiddenBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  forbiddenBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});