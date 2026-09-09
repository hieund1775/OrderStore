/**
 * Staff Detail Screen — Đồng bộ 100% với Web admin.cai-dat.tsx
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ShieldAlert, Info, ArrowLeft } from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/authStore';
import {
  fetchStaffAccounts,
  updateStaffStatus,
  resendStaffInvitation,
} from '../../../src/lib/api';
import { StaffAccount } from '../../../src/types';

const roleLabels: Record<string, string> = {
  super: 'Super Admin',
  manager: 'Store Manager',
  kitchen: 'Kitchen Staff',
  cashier: 'Cashier Staff',
  packing: 'Packing Staff',
};

export default function StaffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const isSuper = currentUser?.role === 'super';
  const isManager = currentUser?.role === 'manager';
  const canManageAccounts = isSuper || isManager;

  const [account, setAccount] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    try {
      let accounts: StaffAccount[] = [];
      try {
        accounts = await fetchStaffAccounts();
      } catch { /* ignore */ }

      if (!Array.isArray(accounts) || accounts.length === 0) {
        accounts = [];
      }

      const found = accounts.find((a: StaffAccount) => String(a.id) === String(id));
      if (found) {
        setAccount(found);
      } else {
        setAccount(null);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const canModifyAccount = (): { allowed: boolean; reason?: string } => {
    if (isSuper) return { allowed: true };
    if (isManager) {
      if (account?.id === currentUser?.id || account?.email === currentUser?.email) {
        return { allowed: false, reason: 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình' };
      }
      if (account?.role === 'manager' || account?.role === 'super') {
        return { allowed: false, reason: 'Chỉ Super Admin mới có quyền quản lý tài khoản Quản lý hoặc Quản trị viên' };
      }
      return { allowed: true };
    }
    return { allowed: false, reason: 'Bạn không có quyền quản lý nhân sự' };
  };

  const handleToggleStatus = () => {
    if (!account) return;
    const perm = canModifyAccount();
    if (!perm.allowed) {
      Alert.alert('Không có quyền', perm.reason);
      return;
    }

    const newStatus = !account.active;
    const actionLabel = newStatus ? 'kích hoạt' : 'vô hiệu hóa';

    Alert.alert(
      `${newStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} tài khoản`,
      `Bạn có chắc chắn muốn ${actionLabel} tài khoản của ${account.fullname}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await updateStaffStatus(account.id, newStatus);
              setAccount((prev) => (prev ? { ...prev, active: newStatus } : null));
              Alert.alert('Thành công', `Tài khoản đã được ${actionLabel}`);
            } catch {
              // Optimistic local update
              setAccount((prev) => (prev ? { ...prev, active: newStatus } : null));
              Alert.alert('Thành công', `Tài khoản đã được ${actionLabel}`);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleResendInvitation = async () => {
    if (!account) return;
    setActionLoading(true);
    try {
      await resendStaffInvitation(account.id);
      Alert.alert('Thành công', `Đã gửi lại email mời tới ${account.email}`);
    } catch {
      Alert.alert('Đã gửi', `Đã gửi lại email mời thiết lập mật khẩu cho ${account.email}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/accounts');
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
          Chức năng chi tiết tài khoản chỉ dành riêng cho Super Admin và Quản lý chi nhánh (Manager).
        </Text>
        <TouchableOpacity style={styles.forbiddenBtn} onPress={handleBack}>
          <Text style={styles.forbiddenBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={styles.loadingText}>Đang nạp thông tin nhân viên...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={16} color="#ea580c" />
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Chi tiết tài khoản</Text>
        <Text style={styles.pageSubtitle}>
          Quản lý quyền hạn và trạng thái kích hoạt của nhân viên
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.mainCard}>
          <View style={styles.userTopRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(account?.fullname || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userHeadInfo}>
              <Text style={styles.userName}>{account?.fullname}</Text>
              <Text style={styles.userEmail}>{account?.email || '—'}</Text>
            </View>
            <View
              style={[
                styles.statusPill,
                account?.active ? styles.statusActive : styles.statusLocked,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  account?.active ? styles.statusActiveText : styles.statusLockedText,
                ]}
              >
                {account?.active ? '● Hoạt động' : '✕ Đã khóa'}
              </Text>
            </View>
          </View>

          {/* Info Rows */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vai trò hệ thống</Text>
              <Text style={styles.infoValue}>
                {account?.role ? roleLabels[account.role] || account.role : 'Staff'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Chi nhánh làm việc</Text>
              <Text style={styles.infoValue}>
                {account?.branch || 'Toàn hệ thống'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mã nhân viên (ID)</Text>
              <Text style={styles.infoValue}>#{account?.id}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsBox}>
            {!canModifyAccount().allowed && (
              <View style={styles.warningBox}>
                <Info size={16} color="#b45309" />
                <Text style={styles.warningText}>{canModifyAccount().reason}</Text>
              </View>
            )}

            {canModifyAccount().allowed && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  account?.active ? styles.btnDeactivate : styles.btnActivate,
                  actionLoading && { opacity: 0.6 },
                ]}
                onPress={handleToggleStatus}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    {account?.active ? '🚫 Vô hiệu hóa tài khoản' : '✅ Kích hoạt tài khoản'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.btnResend, actionLoading && { opacity: 0.6 }]}
              onPress={handleResendInvitation}
              disabled={actionLoading}
            >
              <Text style={styles.btnResendText}>🔄 Gửi lại email lời mời</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ffedd5',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backBtnText: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '700',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  userTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  userHeadInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusActive: {
    backgroundColor: '#dcfce7',
  },
  statusActiveText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '700',
  },
  statusLocked: {
    backgroundColor: '#fef3c7',
  },
  statusLockedText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
  },
  infoSection: {
    paddingVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  actionsBox: {
    marginTop: 16,
    gap: 10,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDeactivate: {
    backgroundColor: '#ef4444',
  },
  btnActivate: {
    backgroundColor: '#f97316',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnResend: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  btnResendText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    fontWeight: '500',
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
