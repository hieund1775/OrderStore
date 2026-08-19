import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Flame,
  Bike,
  Phone,
  Home,
  AlertCircle,
} from 'lucide-react-native';
import apiClient from '../../src/lib/api';
import { OrderSummary } from '../../src/types';
import { vnd, formatDateTime, getOrderStatusLabel } from '../../src/lib/formatters';

const TIMELINE_STEPS = [
  { key: 'received', title: 'Đã nhận đơn', desc: 'Đơn hàng đã được chuyển đến quầy', icon: Clock },
  { key: 'preparing', title: 'Đang pha chế', desc: 'Bếp KDS đang chuẩn bị ly trà của bạn', icon: Flame },
  { key: 'delivering', title: 'Đang giao / Sẵn sàng', desc: 'Món đã sẵn sàng để thưởng thức', icon: Bike },
  { key: 'completed', title: 'Hoàn tất đơn hàng', desc: 'Cảm ơn bạn đã lựa chọn TeaPlus!', icon: CheckCircle2 },
];

function getActiveStepIndex(status: string): number {
  switch (status) {
    case 'received':
      return 0;
    case 'preparing':
      return 1;
    case 'ready':
    case 'delivering':
      return 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
}

export default function TrackingScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();

  const {
    data: order,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery<OrderSummary>({
    queryKey: ['order-tracking', code],
    queryFn: async () => {
      const { data } = await apiClient.get(`/orders/${code}/lookup`);
      return data.order || data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'cancelled') return false;
      return 4000; // Poll every 4 seconds for live update
    },
  });

  const handleCallHotline = () => {
    Linking.openURL('tel:19001234');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
        <Text style={styles.loadingText}>Đang tải thông tin đơn #{code}...</Text>
      </View>
    );
  }

  if (isError || !order) {
    return (
      <View style={styles.errorContainer}>
        <AlertCircle size={56} color="#ef4444" />
        <Text style={styles.errorTitle}>Không tìm thấy đơn hàng</Text>
        <Text style={styles.errorDesc}>
          Vui lòng kiểm tra lại mã đơn hàng hoặc liên hệ quầy thu ngân để được hỗ trợ.
        </Text>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.homeBtnText}>Về trang chủ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStep = getActiveStepIndex(order.status);
  const statusInfo = getOrderStatusLabel(order.status);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {/* Status Header */}
        <View style={styles.statusHeaderCard}>
          <View style={styles.statusTitleRow}>
            <View>
              <Text style={styles.orderCodeLabel}>Mã đơn hàng</Text>
              <Text style={styles.orderCodeVal}>#{order.order_code}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
          </View>
          <Text style={styles.orderTimeText}>Đặt lúc: {formatDateTime(order.created_at)}</Text>
        </View>

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Tiến trình đơn hàng</Text>
          <View style={styles.timelineList}>
            {TIMELINE_STEPS.map((step, idx) => {
              const isDone = idx <= currentStep && order.status !== 'cancelled';
              const isCurrent = idx === currentStep && order.status !== 'cancelled';
              const Icon = step.icon;

              return (
                <View key={step.key} style={styles.timelineItem}>
                  <View style={styles.iconColumn}>
                    <View style={[styles.stepCircle, isDone && styles.stepCircleDone, isCurrent && styles.stepCircleCurrent]}>
                      <Icon size={16} color={isDone ? '#ffffff' : '#9ca3af'} />
                    </View>
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <View style={[styles.stepLine, idx < currentStep && styles.stepLineDone]} />
                    )}
                  </View>

                  <View style={styles.stepContent}>
                    <Text style={[styles.stepTitle, isDone && styles.stepTitleDone]}>
                      {step.title}
                    </Text>
                    <Text style={styles.stepDesc}>{step.desc}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Ordered Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Chi tiết món đã đặt</Text>
          {(order.items || []).map((it) => (
            <View key={it.id || it.product_name} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>
                  {it.qty}x {it.product_name} {it.size_label ? `(${it.size_label})` : ''}
                </Text>
                {it.toppings && it.toppings.length > 0 && (
                  <Text style={styles.itemTopping}>+ {it.toppings.map((t) => t.name).join(', ')}</Text>
                )}
                {it.note ? <Text style={styles.itemNote}>"{it.note}"</Text> : null}
              </View>
              <Text style={styles.itemPrice}>{vnd(it.line_total)}</Text>
            </View>
          ))}

          <View style={styles.billSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính:</Text>
              <Text style={styles.summaryValue}>{vnd(order.subtotal)}</Text>
            </View>
            {order.discount_amount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Giảm giá:</Text>
                <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{vnd(order.discount_amount)}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Tổng cộng:</Text>
              <Text style={styles.totalValue}>{vnd(order.total)}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.hotlineBtn} activeOpacity={0.8} onPress={handleCallHotline}>
            <Phone size={18} color="#ea580c" />
            <Text style={styles.hotlineBtnText}>Gọi hỗ trợ (Hotline 1900 1234)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeActionBtn}
            activeOpacity={0.85}
            onPress={() => router.replace('/(tabs)')}
          >
            <Home size={18} color="#ffffff" />
            <Text style={styles.homeActionBtnText}>Về trang chủ</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginTop: 16,
  },
  errorDesc: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  homeBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  homeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  statusHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  statusTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderCodeLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  orderCodeVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1f2937',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  orderTimeText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  timelineCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 16,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  iconColumn: {
    alignItems: 'center',
    width: 32,
    marginRight: 12,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleDone: {
    backgroundColor: '#ea580c',
  },
  stepCircleCurrent: {
    backgroundColor: '#ea580c',
    borderWidth: 3,
    borderColor: '#fed7aa',
  },
  stepLine: {
    width: 2,
    height: 38,
    backgroundColor: '#e5e7eb',
  },
  stepLineDone: {
    backgroundColor: '#ea580c',
  },
  stepContent: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  stepTitleDone: {
    color: '#1f2937',
    fontWeight: '800',
  },
  stepDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  itemTopping: {
    fontSize: 12,
    color: '#ea580c',
    marginTop: 2,
  },
  itemNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1f2937',
  },
  billSummary: {
    paddingTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ea580c',
  },
  actionButtons: {
    gap: 10,
  },
  hotlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  hotlineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ea580c',
  },
  homeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  homeActionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});
