import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, ChevronRight, Clock, ShoppingBag } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../src/lib/api';
import { OrderSummary } from '../../src/types';
import { vnd, formatDateTime, getOrderStatusLabel } from '../../src/lib/formatters';
import { useAuthStore } from '../../src/store/authStore';

export default function OrdersScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [searchCode, setSearchCode] = useState('');

  // Fetch customer orders if logged in
  const { data: userOrders = [], isLoading } = useQuery<OrderSummary[]>({
    queryKey: ['user-orders', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/${user?.id}/orders`);
      return Array.isArray(data) ? data : data.orders || [];
    },
  });

  const handleLookup = () => {
    if (!searchCode.trim()) return;
    router.push(`/tracking/${searchCode.trim().toUpperCase()}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Đơn Hàng Của Bạn</Text>
      </View>

      {/* Order Lookup Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tra cứu mã đơn (VD: TP-123456)..."
            placeholderTextColor="#9ca3af"
            value={searchCode}
            onChangeText={setSearchCode}
            autoCapitalize="characters"
            onSubmitEditing={handleLookup}
          />
        </View>
        <TouchableOpacity style={styles.lookupBtn} activeOpacity={0.8} onPress={handleLookup}>
          <Text style={styles.lookupBtnText}>Tra cứu</Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Đơn hàng gần đây</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#ea580c" style={{ marginTop: 40 }} />
        ) : userOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingBag size={56} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
            <Text style={styles.emptyDesc}>
              Nhập mã đơn hàng ở trên để tra cứu hoặc đặt một ly trà trái cây thơm ngon ngay!
            </Text>
            <TouchableOpacity
              style={styles.orderNowBtn}
              onPress={() => router.push('/(tabs)/menu')}
            >
              <Text style={styles.orderNowBtnText}>Đặt món ngay</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={userOrders}
            keyExtractor={(item) => String(item.id || item.order_code)}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const statusStyle = getOrderStatusLabel(item.status);
              return (
                <TouchableOpacity
                  style={styles.orderCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/tracking/${item.order_code}`)}
                >
                  <View style={styles.orderCardHeader}>
                    <View>
                      <Text style={styles.orderCode}>#{item.order_code}</Text>
                      <Text style={styles.orderTime}>{formatDateTime(item.created_at)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                        {statusStyle.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.orderCardBody}>
                    <Text style={styles.storeText}>📍 {item.store_name || 'Chi nhánh TeaPlus'}</Text>
                    <Text style={styles.itemsSummary} numberOfLines={2}>
                      {(item.items || []).map((it) => `${it.qty}x ${it.product_name}`).join(', ') || 'Đơn hàng trà trái cây'}
                    </Text>
                  </View>

                  <View style={styles.orderCardFooter}>
                    <Text style={styles.totalLabel}>Tổng tiền:</Text>
                    <Text style={styles.totalAmount}>{vnd(item.total)}</Text>
                    <ChevronRight size={18} color="#9ca3af" style={{ marginLeft: 'auto' }} />
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
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
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '600',
  },
  lookupBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lookupBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 12,
  },
  listContainer: {
    paddingBottom: 24,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 10,
  },
  orderCode: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  orderTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderCardBody: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  storeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 4,
  },
  itemsSummary: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 6,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ea580c',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#374151',
    marginTop: 16,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  orderNowBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  orderNowBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
