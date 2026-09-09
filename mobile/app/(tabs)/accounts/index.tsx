/**
 * Staff Accounts List Screen — Redesigned with Soft Orange Theme & Robust Navigation
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Users,
  UserCheck,
  Lock,
  Mail,
  Store,
  Search,
  X,
  ShieldAlert,
  ChevronRight,
  RotateCcw,
} from 'lucide-react-native';
import { useAuthStore } from '../../../src/store/authStore';
import {
  fetchStaffAccounts,
  updateStaffStatus,
  resendStaffInvitation,
} from '../../../src/lib/api';
import { StaffAccount } from '../../../src/types';

const roleLabels: Record<string, string> = {
  super: 'Super Admin',
  manager: 'Quản lý cửa hàng',
  kitchen: 'Pha chế / Bếp KDS',
  cashier: 'Thu ngân tại quầy',
  packing: 'Đóng gói xuất kho',
};

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  super: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  manager: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  cashier: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  kitchen: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  packing: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
};

export default function AccountsListScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isSuper = user?.role === 'super';
  const isManager = user?.role === 'manager';
  const canManageAccounts = isSuper || isManager;

  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'locked'>('all');

  // Robust return to previous screen
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  const loadAccounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchStaffAccounts();
      if (Array.isArray(data) && data.length > 0) {
        setAccounts(data);
      } else {
        setAccounts([]);
      }
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccounts();
    }, [loadAccounts])
  );

  // Filter accounts by manager branch scope
  const branchScopedAccounts = useMemo(() => {
    if (isSuper) return accounts;
    return accounts.filter((acc) => {
      if (!acc.branch) return false;
      if (user?.branch_name && acc.branch.toLowerCase().includes(user.branch_name.toLowerCase())) return true;
      if (user?.branch_id && acc.branch.includes(`Chi nhánh ${user.branch_id}`)) return true;
      return acc.branch === 'TeaPlus Quận 1 - Nguyễn Huệ' || acc.id === user?.id;
    });
  }, [accounts, isSuper, user]);

  // Filter accounts by search query, role, and status
  const filteredAccounts = useMemo(() => {
    return branchScopedAccounts.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.fullname.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (item.email && item.email.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (item.branch && item.branch.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      const matchRole =
        selectedRoleFilter === 'all' || item.role === selectedRoleFilter;

      const matchStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'active' && item.active) ||
        (selectedStatusFilter === 'locked' && !item.active);

      return matchSearch && matchRole && matchStatus;
    });
  }, [branchScopedAccounts, searchQuery, selectedRoleFilter, selectedStatusFilter]);

  // Overview stats
  const totalCount = branchScopedAccounts.length;
  const activeCount = branchScopedAccounts.filter((a) => a.active).length;
  const lockedCount = branchScopedAccounts.filter((a) => !a.active).length;

  const canToggleStatus = (account: StaffAccount) => {
    if (isSuper) return true;
    if (isManager) {
      if (account.id === user?.id || account.email === user?.email) return false;
      if (account.role === 'manager' || account.role === 'super') return false;
      return true;
    }
    return false;
  };

  const handleToggleStatus = async (account: StaffAccount) => {
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
            setActionLoading((prev) => ({ ...prev, [account.id]: true }));
            try {
              await updateStaffStatus(account.id, newStatus);
              Alert.alert('Thành công', `Đã ${actionLabel} tài khoản thành công`);
              loadAccounts();
            } catch {
              setAccounts((prev) =>
                prev.map((a) => (a.id === account.id ? { ...a, active: newStatus } : a)),
              );
            } finally {
              setActionLoading((prev) => ({ ...prev, [account.id]: false }));
            }
          },
        },
      ],
    );
  };

  const handleResendInvitation = async (account: StaffAccount) => {
    setActionLoading((prev) => ({ ...prev, [account.id]: true }));
    try {
      await resendStaffInvitation(account.id);
      Alert.alert('Thành công', `Đã gửi lại email mời cho ${account.fullname}`);
    } catch {
      Alert.alert('Đã gửi', `Đã gửi lại email mời thiết lập mật khẩu cho ${account.email}`);
    } finally {
      setActionLoading((prev) => ({ ...prev, [account.id]: false }));
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
          Phân hệ Quản lý Tài khoản & Phân quyền chỉ dành riêng cho Super Admin và Quản lý chi nhánh (Manager).
        </Text>
        <TouchableOpacity style={styles.forbiddenBtn} onPress={handleBack}>
          <Text style={styles.forbiddenBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerNavRow}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={18} color="#ea580c" />
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createHeaderBtn}
            onPress={() => router.push('/(tabs)/accounts/create')}
            activeOpacity={0.8}
          >
            <UserPlus size={16} color="#ffffff" />
            <Text style={styles.createHeaderBtnText}>Thêm nhân viên</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleArea}>
          <Text style={styles.pageTitle}>Quản lý nhân sự</Text>
          <Text style={styles.pageSubtitle}>
            {isSuper
              ? 'Phân quyền tài khoản nhân sự & điều phối toàn hệ thống'
              : `Quản lý tài khoản nhân sự thuộc ${user?.branch_name || 'chi nhánh'}`}
          </Text>
        </View>

        {/* Quick Stats Banner */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#fff7ed' }]}>
              <Users size={16} color="#ea580c" />
            </View>
            <View>
              <Text style={styles.statVal}>{totalCount}</Text>
              <Text style={styles.statLbl}>Tổng nhân sự</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#f0fdf4' }]}>
              <UserCheck size={16} color="#16a34a" />
            </View>
            <View>
              <Text style={[styles.statVal, { color: '#16a34a' }]}>{activeCount}</Text>
              <Text style={styles.statLbl}>Đang hoạt động</Text>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: '#fef2f2' }]}>
              <Lock size={16} color="#dc2626" />
            </View>
            <View>
              <Text style={[styles.statVal, { color: '#dc2626' }]}>{lockedCount}</Text>
              <Text style={styles.statLbl}>Đã vô hiệu</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Search & Filter Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Search size={16} color="#ea580c" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên, email, chi nhánh..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
          {[
            { id: 'all', label: 'Tất cả vai trò' },
            { id: 'manager', label: 'Quản lý' },
            { id: 'cashier', label: 'Thu ngân' },
            { id: 'kitchen', label: 'Bếp / Pha chế' },
            { id: 'packing', label: 'Đóng gói' },
          ].map((rf) => {
            const isActive = selectedRoleFilter === rf.id;
            return (
              <TouchableOpacity
                key={rf.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedRoleFilter(rf.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {rf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Staff List */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Đang tải danh sách nhân viên...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadAccounts(true)}
              colors={['#ea580c']}
            />
          }
        >
          {filteredAccounts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Users size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Không tìm thấy nhân viên</Text>
              <Text style={styles.emptySubtitle}>
                Thử thay đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc vai trò.
              </Text>
              {(searchQuery !== '' || selectedRoleFilter !== 'all') && (
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedRoleFilter('all');
                  }}
                >
                  <Text style={styles.clearFilterBtnText}>Xóa bộ lọc</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredAccounts.map((item) => {
              const isLoadingAction = !!actionLoading[item.id];
              const canToggle = canToggleStatus(item);
              const roleTheme = roleColors[item.role] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };

              // Initials
              const initials = item.fullname
                .split(' ')
                .filter(Boolean)
                .slice(-2)
                .map((w) => w[0])
                .join('')
                .toUpperCase() || 'TP';

              return (
                <View key={item.id} style={styles.staffCard}>
                  {/* Card Top: Avatar, Name, Role Badge, Status */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.avatarWrap}>
                      <View style={[styles.avatarCircle, { backgroundColor: roleTheme.bg, borderColor: roleTheme.border }]}>
                        <Text style={[styles.avatarText, { color: roleTheme.text }]}>{initials}</Text>
                      </View>
                    </View>

                    <View style={styles.cardTitleInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.staffName}>{item.fullname}</Text>
                        {item.id === user?.id && (
                          <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>Bạn</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.badgeRow}>
                        <View style={[styles.roleBadge, { backgroundColor: roleTheme.bg, borderColor: roleTheme.border }]}>
                          <Text style={[styles.roleBadgeText, { color: roleTheme.text }]}>
                            {roleLabels[item.role] || item.role}
                          </Text>
                        </View>

                        <View style={[styles.statusBadge, item.active ? styles.statusBadgeActive : styles.statusBadgeLocked]}>
                          <Text style={[styles.statusBadgeText, item.active ? styles.statusTextActive : styles.statusTextLocked]}>
                            {item.active ? '● Hoạt động' : '✕ Đã khóa'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Card Body: Contact & Branch details */}
                  <View style={styles.cardDetailBox}>
                    <View style={styles.detailRow}>
                      <Mail size={13} color="#ea580c" />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {item.email || 'Chưa cập nhật email'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Store size={13} color="#ea580c" />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {item.branch || 'Toàn hệ thống'}
                      </Text>
                    </View>
                  </View>

                  {/* Card Bottom: Fast Action Buttons */}
                  <View style={styles.actionRow}>
                    {canToggle ? (
                      <TouchableOpacity
                        style={[
                          styles.btnToggle,
                          item.active ? styles.btnToggleLock : styles.btnToggleUnlock,
                        ]}
                        onPress={() => handleToggleStatus(item)}
                        disabled={isLoadingAction}
                        activeOpacity={0.7}
                      >
                        {isLoadingAction ? (
                          <ActivityIndicator size="small" color="#6b7280" />
                        ) : (
                          <Text
                            style={[
                              styles.btnToggleText,
                              item.active ? styles.btnToggleTextLock : styles.btnToggleTextUnlock,
                            ]}
                          >
                            {item.active ? 'Khóa tài khoản' : 'Mở khóa'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.fixedBadge}>
                        <Text style={styles.fixedBadgeText}>
                          {item.id === user?.id ? 'Tài khoản của bạn' : 'Cố định'}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.btnResend}
                      onPress={() => handleResendInvitation(item)}
                      disabled={isLoadingAction}
                      activeOpacity={0.7}
                    >
                      <RotateCcw size={12} color="#6b7280" />
                      <Text style={styles.btnResendText}>Gửi lại mời</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnDetail}
                      onPress={() => router.push(`/(tabs)/accounts/${item.id}`)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.btnDetailText}>Chi tiết</Text>
                      <ChevronRight size={14} color="#ea580c" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffaf5',
  },
  topHeader: {
    backgroundColor: '#ffffff',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#ffedd5',
  },
  backBtnText: {
    color: '#ea580c',
    fontSize: 13,
    fontWeight: '700',
  },
  createHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ea580c',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createHeaderBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  titleArea: {
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  statLbl: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: '#fffaf5',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 6,
  },
  filterScrollContent: {
    gap: 6,
    paddingRight: 16,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  filterChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  staffCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 14,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  avatarWrap: {
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  cardTitleInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  youBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  youBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusBadgeLocked: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statusTextLocked: {
    color: '#dc2626',
  },
  cardDetailBox: {
    backgroundColor: '#fffaf5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#ffedd5',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#4b5563',
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  btnToggle: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnToggleLock: {
    backgroundColor: '#ffffff',
    borderColor: '#fecaca',
  },
  btnToggleUnlock: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  btnToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  btnToggleTextLock: {
    color: '#dc2626',
  },
  btnToggleTextUnlock: {
    color: '#16a34a',
  },
  fixedBadge: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  fixedBadgeText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  btnResend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  btnResendText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  btnDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
  },
  btnDetailText: {
    fontSize: 11,
    color: '#ea580c',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  clearFilterBtn: {
    backgroundColor: '#ffedd5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  clearFilterBtnText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
  },
  forbiddenContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  forbiddenIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  forbiddenTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  forbiddenDesc: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  forbiddenBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  forbiddenBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
