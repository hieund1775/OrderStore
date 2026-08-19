import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User,
  Crown,
  Gift,
  Heart,
  Bell,
  MapPin,
  HelpCircle,
  LogOut,
  ChevronRight,
  QrCode,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';
import { getTierBadge } from '../../src/lib/formatters';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const tier = user?.tier || 'member';
  const tierInfo = getTierBadge(tier);
  const points = user?.points || 120; // demo points or live points

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hội Viên & Tài Khoản</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Digital Membership Card */}
        <View style={styles.cardContainer}>
          <View style={styles.memberCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.brandName}>TEAPLUS LOYALTY</Text>
                <Text style={styles.cardUserName}>{user?.fullname || 'Khách hàng thân thiết'}</Text>
              </View>
              <View style={[styles.tierTag, { backgroundColor: tierInfo.bg }]}>
                <Crown size={14} color={tierInfo.color} />
                <Text style={[styles.tierTagText, { color: tierInfo.color }]}>{tierInfo.label}</Text>
              </View>
            </View>

            <View style={styles.pointsWrap}>
              <Text style={styles.pointsLabel}>Điểm tích lũy hiện tại</Text>
              <Text style={styles.pointsValue}>{points} <Text style={styles.ptsUnit}>điểm</Text></Text>
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.qrPrompt}>
                <QrCode size={18} color="#ffffff" />
                <Text style={styles.qrPromptText}>Đưa mã cho thu ngân để tích điểm</Text>
              </View>
              <Text style={styles.cardNumber}>•••• {user?.phone?.slice(-4) || '8888'}</Text>
            </View>
          </View>
        </View>

        {/* Quick Balance & Vouchers */}
        <View style={styles.loyaltyActions}>
          <TouchableOpacity style={styles.loyaltyActionCard} activeOpacity={0.8}>
            <Gift size={24} color="#ea580c" />
            <Text style={styles.loyaltyActionTitle}>Đổi Voucher</Text>
            <Text style={styles.loyaltyActionSub}>5 voucher khả dụng</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.loyaltyActionCard} activeOpacity={0.8}>
            <Crown size={24} color="#d97706" />
            <Text style={styles.loyaltyActionTitle}>Quyền lợi Hạng</Text>
            <Text style={styles.loyaltyActionSub}>Xem ưu đãi bậc {tierInfo.label}</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionHeading}>Cá nhân</Text>

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#fee2e2' }]}>
              <Heart size={18} color="#ef4444" />
            </View>
            <Text style={styles.menuTitle}>Món yêu thích (Wishlist)</Text>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#e0e7ff' }]}>
              <Bell size={18} color="#4f46e5" />
            </View>
            <Text style={styles.menuTitle}>Thông báo khuyến mãi</Text>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#ffedd5' }]}>
              <MapPin size={18} color="#ea580c" />
            </View>
            <Text style={styles.menuTitle}>Địa chỉ giao hàng đã lưu</Text>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionHeading}>Hỗ trợ & Ứng dụng</Text>

          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7}>
            <View style={[styles.menuIconWrap, { backgroundColor: '#f3f4f6' }]}>
              <HelpCircle size={18} color="#4b5563" />
            </View>
            <Text style={styles.menuTitle}>Trung tâm hỗ trợ & Hotline</Text>
            <ChevronRight size={18} color="#9ca3af" />
          </TouchableOpacity>

          {user ? (
            <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={logout}>
              <View style={[styles.menuIconWrap, { backgroundColor: '#fee2e2' }]}>
                <LogOut size={18} color="#dc2626" />
              </View>
              <Text style={[styles.menuTitle, { color: '#dc2626' }]}>Đăng xuất</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.versionText}>TeaPlus App v1.0.0 (Native Edition)</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2937',
  },
  content: {
    flex: 1,
  },
  cardContainer: {
    padding: 18,
  },
  memberCard: {
    backgroundColor: '#ea580c',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brandName: {
    color: '#fed7aa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  cardUserName: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 4,
  },
  tierTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 4,
  },
  tierTagText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pointsWrap: {
    marginVertical: 20,
  },
  pointsLabel: {
    color: '#ffedd5',
    fontSize: 12,
    fontWeight: '500',
  },
  pointsValue: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    marginTop: 2,
  },
  ptsUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fed7aa',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 14,
  },
  qrPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qrPromptText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardNumber: {
    color: '#fed7aa',
    fontSize: 13,
    fontWeight: '700',
  },
  loyaltyActions: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 16,
  },
  loyaltyActionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  loyaltyActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f2937',
    marginTop: 8,
  },
  loyaltyActionSub: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  menuSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9ca3af',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 6,
    letterSpacing: 0.5,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 10,
  },
});
