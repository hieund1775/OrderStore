/**
 * Profile tab — Staff session info and logout
 * Đồng bộ phong cách thiết kế với Web Admin
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  ChefHat,
  ClipboardList,
  ShoppingCart,
  Package,
  Tag,
  Users,
  Phone,
  Mail,
  Store,
  ShieldCheck,
  ChevronRight,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { AdminHeader } from '../../src/components/AdminHeader';

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();
  const role = user?.role || 'unknown';

  const roleLabels: Record<string, string> = {
    super: 'Quản trị tối cao (Super Admin)',
    manager: 'Quản lý cửa hàng (Manager)',
    cashier: 'Thu ngân quầy (Cashier)',
    kitchen: 'Nhân viên bếp (Kitchen)',
    packing: 'Nhân viên đóng gói (Packing)',
  };

  const handleLogout = () => {
    Alert.alert('Đăng xuất tài khoản', 'Bạn có chắc chắn muốn đăng xuất khỏi ca làm việc?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <AdminHeader
        title="Tài khoản nhân viên"
        subtitle="Thông tin ca làm việc và điều hướng phân hệ vận hành"
        branchName={user?.branch_name || 'Toàn hệ thống'}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.fullname || 'S').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.nameText}>{user?.fullname || 'Nhân viên'}</Text>
          <View style={styles.roleBadge}>
            <ShieldCheck size={13} color="#ea580c" />
            <Text style={styles.roleText}>{roleLabels[role] || role}</Text>
          </View>
        </View>

        {/* Account Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>
          <View style={styles.infoCardWrapper}>
            <View style={styles.infoCard}>
              <View style={styles.infoLeft}>
                <Phone size={15} color="#ea580c" />
                <Text style={styles.infoLabel}>Số điện thoại</Text>
              </View>
              <Text style={styles.infoValue}>{user?.phone || '—'}</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoLeft}>
                <Mail size={15} color="#ea580c" />
                <Text style={styles.infoLabel}>Email</Text>
              </View>
              <Text style={styles.infoValue}>{user?.email || 'Chưa cập nhật'}</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoLeft}>
                <Store size={15} color="#ea580c" />
                <Text style={styles.infoLabel}>Chi nhánh làm việc</Text>
              </View>
              <Text style={styles.infoValue}>{user?.branch_name || 'Toàn hệ thống'}</Text>
            </View>
          </View>
        </View>

        {/* Quick Nav Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phân hệ vận hành được phân công</Text>
          <View style={styles.navGroup}>
            {['super', 'manager', 'kitchen'].includes(role) && (
              <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(tabs)')}>
                <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
                  <ChefHat size={18} color="#ea580c" />
                </View>
                <View style={styles.navInfo}>
                  <Text style={styles.navTitle}>Màn hình Bếp KDS</Text>
                  <Text style={styles.navSub}>Pha chế và hoàn thành món thời gian thực</Text>
                </View>
                <ChevronRight size={16} color="#ea580c" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.navRow}
              onPress={() => router.push('/(tabs)/orders')}
            >
              <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
                <ClipboardList size={18} color="#ea580c" />
              </View>
              <View style={styles.navInfo}>
                <Text style={styles.navTitle}>Quản lý Đơn hàng</Text>
                <Text style={styles.navSub}>Điều phối shipper, xác nhận thu tiền</Text>
              </View>
              <ChevronRight size={16} color="#ea580c" />
            </TouchableOpacity>

            {['super', 'manager', 'cashier'].includes(role) && (
              <TouchableOpacity style={styles.navRow} onPress={() => router.push('/(tabs)/pos')}>
                <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
                  <ShoppingCart size={18} color="#ea580c" />
                </View>
                <View style={styles.navInfo}>
                  <Text style={styles.navTitle}>POS Thu ngân gọi món</Text>
                  <Text style={styles.navSub}>Tạo đơn nhanh tại quầy và quét mã VietQR</Text>
                </View>
                <ChevronRight size={16} color="#ea580c" />
              </TouchableOpacity>
            )}

            {['super', 'manager', 'packing'].includes(role) && (
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => router.push('/(tabs)/packing')}
              >
                <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
                  <Package size={18} color="#ea580c" />
                </View>
                <View style={styles.navInfo}>
                  <Text style={styles.navTitle}>Khu vực Đóng gói</Text>
                  <Text style={styles.navSub}>Kiểm hàng xuất kho bàn giao tài xế</Text>
                </View>
                <ChevronRight size={16} color="#ea580c" />
              </TouchableOpacity>
            )}

            {['super', 'manager', 'cashier'].includes(role) && (
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => router.push('/(tabs)/stock')}
              >
                <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
                  <Tag size={18} color="#ea580c" />
                </View>
                <View style={styles.navInfo}>
                  <Text style={styles.navTitle}>Hàng bán & Tồn kho</Text>
                  <Text style={styles.navSub}>Bật/Tắt hết hàng tức thì cho quán</Text>
                </View>
                <ChevronRight size={16} color="#ea580c" />
              </TouchableOpacity>
            )}

            {(role === 'super' || role === 'manager') && (
              <TouchableOpacity
                style={styles.navRow}
                onPress={() => router.push('/(tabs)/accounts')}
              >
                <View style={[styles.navIconBox, { backgroundColor: '#fff7ed' }]}>
                  <Users size={18} color="#ea580c" />
                </View>
                <View style={styles.navInfo}>
                  <Text style={styles.navTitle}>Quản lý tài khoản nhân sự</Text>
                  <Text style={styles.navSub}>Thêm nhân viên, phân quyền chi nhánh (Super/Manager)</Text>
                </View>
                <ChevronRight size={16} color="#ea580c" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.85}
          >
            <LogOut size={18} color="#dc2626" />
            <Text style={styles.logoutButtonText}>Đăng xuất khỏi ca làm việc</Text>
          </TouchableOpacity>
          <Text style={styles.version}>TeaPlus Operations v2.0 · Đồng bộ Web Admin</Text>
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ea580c',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  infoCardWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '700',
  },
  navGroup: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  navIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navInfo: {
    flex: 1,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  navSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  logoutSection: {
    marginTop: 10,
    gap: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 11,
  },
});