/**
 * TeaPlus Kitchen Display System (Màn hình Bếp KDS)
 * Đồng bộ chính xác với admin.bep.tsx trên Web Frontend:
 * - AdminHeader nhận diện thương hiệu TeaPlus với logo Lá và chi nhánh
 * - Bộ lọc 3 luồng: Đang chuẩn bị (Pha chế), Đang giao (Shipper), Hoàn thành
 * - Thẻ đơn lớn, viền trạng thái rõ ràng, cảnh báo trễ quá 15 phút (Flame)
 * - Chi tiết công thức: Size, Đường, Đá, Topping, Ghi chú đặc biệt
 * - Thao tác 1 chạm: Pha xong giao Shipper / Hoàn thành món
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  Flame,
  CheckCircle2,
  Bike,
  AlertCircle,
  PackageCheck,
  X,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';
import {
  fetchKitchenOrders,
  updateAdminOrderStatus,
  updateFulfillmentTaskStatus,
} from '../../src/lib/api';
import { AdminHeader } from '../../src/components/AdminHeader';

const DEMO_KITCHEN_ORDERS = [
  {
    id: 101,
    order_code: 'TP-8921',
    order_type: 'Takeaway',
    store_name: 'Chi nhánh Quận 1',
    customer_name: 'Anh Nam',
    customer_phone: '0901234567',
    status: 'preparing',
    created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
    items: [
      {
        id: 1,
        product_name: 'Trà Đào Cam Sả',
        qty: 2,
        size_label: 'Size L',
        base_tea: 'Hồng Trà',
        sugar_level: '50% đường',
        ice_level: '70% đá',
        toppings: [{ name: 'Trân châu trắng', price: 6000 }],
        note: 'Ít sả, nhiều đá giúp em',
      },
      {
        id: 2,
        product_name: 'Trà Sữa Ô Long Nướng',
        qty: 1,
        size_label: 'Size M',
        base_tea: 'Ô Long',
        sugar_level: '100% đường',
        ice_level: '100% đá',
        toppings: [{ name: 'Kem Cheese béo ngậy', price: 10000 }],
      },
    ],
  },
  {
    id: 102,
    order_code: 'TP-8925',
    order_type: 'DineIn',
    store_name: 'Chi nhánh Quận 1',
    location_name: 'Bàn 03',
    customer_name: 'Chị Lan',
    customer_phone: '0988776655',
    status: 'preparing',
    created_at: new Date(Date.now() - 17 * 60 * 1000).toISOString(), // > 15m overdue
    items: [
      {
        id: 3,
        product_name: 'Trà Dâu Tằm Pha Lê Tuyết',
        qty: 1,
        size_label: 'Size L',
        base_tea: 'Trà Xanh',
        sugar_level: '70% đường',
        ice_level: '50% đá',
        toppings: [{ name: 'Thạch nha đam', price: 6000 }],
        note: 'Giao kèm ly đá riêng',
      },
    ],
  },
  {
    id: 103,
    order_code: 'TP-8918',
    order_type: 'Delivery',
    store_name: 'Chi nhánh Quận 1',
    customer_name: 'Anh Tuấn',
    customer_phone: '0933112233',
    shipping_driver_name: 'Hoàng Long (AhaMove)',
    shipping_driver_phone: '0909988776',
    status: 'delivering',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    items: [
      {
        id: 4,
        product_name: 'Trà Xoài Nhiệt Đới Macchiato',
        qty: 2,
        size_label: 'Size L',
        base_tea: 'Trà Nhài',
        sugar_level: '50% đường',
        ice_level: '70% đá',
        toppings: [{ name: 'Trân châu hoàng kim', price: 8000 }],
      },
    ],
  },
];

type LaneType = 'prep' | 'delivering' | 'done';

export default function KdsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeLane, setActiveLane] = useState<LaneType>('prep');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Handover Shipper Modal state
  const [handoverOrder, setHandoverOrder] = useState<any | null>(null);
  const [handoverDriverName, setHandoverDriverName] = useState('');
  const [handoverDriverPhone, setHandoverDriverPhone] = useState('');
  const [handoverLoading, setHandoverLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'packing') {
      router.replace('/(tabs)/packing');
    } else if (user?.role === 'cashier') {
      router.replace('/(tabs)/pos');
    }
  }, [user?.role, router]);

  const pollTimerRef = useRef<any>(null);

  const loadOrders = async () => {
    try {
      const data = await fetchKitchenOrders(user?.branch_id || null);
      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch {
      // keep existing orders on network glitch
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrders();
    pollTimerRef.current = setInterval(loadOrders, 12000);
    return () => clearInterval(pollTimerRef.current);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const markKitchenTaskReady = async (o: any) => {
    if (!o?.fulfillment_task_id) return;
    try {
      if (o.fulfillment_task_status === 'pending') {
        await updateFulfillmentTaskStatus(o.fulfillment_task_id, 'preparing');
      }
      await updateFulfillmentTaskStatus(o.fulfillment_task_id, 'ready');
    } catch (e) {
      console.warn('Could not update fulfillment task to ready:', e);
    }
  };

  const completeKitchenTask = async (o: any) => {
    if (!o?.fulfillment_task_id || o.fulfillment_task_status === 'completed') return;
    try {
      await updateFulfillmentTaskStatus(o.fulfillment_task_id, 'completed');
    } catch (e) {
      console.warn('Could not update fulfillment task to completed:', e);
    }
  };

  const handlePreparationComplete = (order: any) => {
    if (order.order_type === 'Delivery') {
      setHandoverOrder(order);
      setHandoverDriverName(order.shipping_driver_name || '');
      setHandoverDriverPhone(order.shipping_driver_phone || '');
    } else {
      handleCompleteNonDelivery(order);
    }
  };

  const submitHandover = async () => {
    if (!handoverOrder) return;
    const trimmedName = handoverDriverName.trim();
    const trimmedPhone = handoverDriverPhone.trim();

    if (trimmedName.length < 2) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên Shipper (tối thiểu 2 ký tự).');
      return;
    }
    if (!/^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(trimmedPhone)) {
      Alert.alert('Số điện thoại không hợp lệ', 'Vui lòng nhập đúng số điện thoại Shipper (10 số).');
      return;
    }

    setHandoverLoading(true);
    setUpdatingId(handoverOrder.id);
    try {
      await markKitchenTaskReady(handoverOrder);
      await updateAdminOrderStatus(handoverOrder.id, 'delivering', {
        note: `Bàn giao Shipper: ${trimmedName}`,
        driver_name: trimmedName,
        driver_phone: trimmedPhone,
      });
      await completeKitchenTask(handoverOrder);
      setHandoverOrder(null);
      await loadOrders();
      Alert.alert('Thành công', `Đơn #${handoverOrder.order_code} đã bàn giao cho Shipper: ${trimmedName}`);
    } catch (err: any) {
      Alert.alert('Không thể bàn giao', err?.message || 'Có lỗi xảy ra khi bàn giao shipper.');
    } finally {
      setHandoverLoading(false);
      setUpdatingId(null);
    }
  };

  const handleCompleteNonDelivery = async (order: any) => {
    setUpdatingId(order.id);
    try {
      await markKitchenTaskReady(order);
      await updateAdminOrderStatus(order.id, 'completed', { note: 'Pha chế hoàn tất' });
      await completeKitchenTask(order);
      await loadOrders();
      Alert.alert('Thành công', `Đơn #${order.order_code} đã hoàn thành!`);
    } catch (err: any) {
      Alert.alert('Không thể hoàn thành', err?.message || 'Có lỗi xảy ra.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeliveryComplete = async (order: any) => {
    setUpdatingId(order.id);
    try {
      await updateAdminOrderStatus(order.id, 'completed', { note: 'Khách đã nhận món' });
      await loadOrders();
      Alert.alert('Thành công', `Đơn #${order.order_code} đã giao thành công!`);
    } catch (err: any) {
      Alert.alert('Không thể cập nhật', err?.message || 'Có lỗi xảy ra.');
    } finally {
      setUpdatingId(null);
    }
  };

  const getElapsedMins = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return Math.max(1, diff);
  };

  const visibleOrders = orders.filter((o) => {
    if (activeLane === 'prep') {
      return o.status === 'preparing' || o.status === 'pending';
    }
    if (activeLane === 'delivering') {
      return o.status === 'delivering';
    }
    return o.status === 'completed';
  });

  const prepCount = orders.filter((o) => o.status === 'preparing' || o.status === 'pending').length;
  const deliveringCount = orders.filter((o) => o.status === 'delivering').length;
  const doneCount = orders.filter((o) => o.status === 'completed').length;

  return (
    <View style={styles.container}>
      <AdminHeader
        title="Màn hình bếp KDS"
        subtitle="Kitchen Display System pha chế thời gian thực"
        branchName={user?.branch_name || 'Toàn hệ thống'}
        onRefresh={onRefresh}
        isRefreshing={refreshing}
      />

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeLane === 'prep' && styles.tabButtonActive]}
          onPress={() => setActiveLane('prep')}
          activeOpacity={0.8}
        >
          <View style={[styles.tabDot, { backgroundColor: '#ef4444' }]} />
          <Text style={[styles.tabText, activeLane === 'prep' && styles.tabTextActive]}>
            Pha chế ({prepCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeLane === 'delivering' && styles.tabButtonActive]}
          onPress={() => setActiveLane('delivering')}
          activeOpacity={0.8}
        >
          <View style={[styles.tabDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={[styles.tabText, activeLane === 'delivering' && styles.tabTextActive]}>
            Giao hàng ({deliveringCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeLane === 'done' && styles.tabButtonActive]}
          onPress={() => setActiveLane('done')}
          activeOpacity={0.8}
        >
          <View style={[styles.tabDot, { backgroundColor: '#f97316' }]} />
          <Text style={[styles.tabText, activeLane === 'done' && styles.tabTextActive]}>
            Hoàn thành ({doneCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingLabel}>Đang đồng bộ đơn hàng với KDS bếp...</Text>
        </View>
      ) : visibleOrders.length === 0 ? (
        <View style={styles.centerBox}>
          <View style={styles.emptyIconCircle}>
            <CheckCircle2 size={36} color="#ea580c" />
          </View>
          <Text style={styles.emptyTitle}>
            {activeLane === 'prep'
              ? 'Bếp đã hoàn tất mọi món!'
              : activeLane === 'delivering'
              ? 'Không có đơn nào đang giao'
              : 'Chưa có đơn hoàn tất gần đây'}
          </Text>
          <Text style={styles.emptySubtitle}>
            Đơn mới sẽ tự động xuất hiện tức thì khi khách gửi yêu cầu gọi món.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f97316']} />
          }
        >
          {visibleOrders.map((order) => {
            const elapsed = getElapsedMins(order.created_at);
            const isLate = elapsed > 15;
            const isDelivery = order.order_type === 'Delivery';
            const isDineIn = order.order_type === 'DineIn';

            return (
              <View
                key={order.id}
                style={[
                  styles.card,
                  isLate && styles.cardLate,
                  activeLane === 'done' && styles.cardDone,
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.codeCol}>
                    <View style={styles.codeRow}>
                      <Text style={styles.orderCode}>{order.order_code}</Text>
                      <View
                        style={[
                          styles.typeBadge,
                          isDelivery
                            ? styles.typeBadgeDelivery
                            : isDineIn
                            ? styles.typeBadgeDineIn
                            : styles.typeBadgeTakeaway,
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeBadgeText,
                            isDelivery
                              ? styles.typeTextDelivery
                              : isDineIn
                              ? styles.typeTextDineIn
                              : styles.typeTextTakeaway,
                          ]}
                        >
                          {isDelivery
                            ? '🚚 Giao tận nơi'
                            : isDineIn
                            ? `🪑 ${order.location_name || 'Tại bàn'}`
                            : '🛍️ Mang đi'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.customerSub}>
                      Khách: <Text style={styles.customerName}>{order.customer_name || 'Khách'}</Text>
                      {order.customer_phone ? ` · ${order.customer_phone}` : ''}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.timerPill,
                      isLate
                        ? styles.timerPillLate
                        : activeLane === 'done'
                        ? styles.timerPillDone
                        : styles.timerPillNormal,
                    ]}
                  >
                    {isLate ? (
                      <Flame size={14} color="#dc2626" />
                    ) : (
                      <Clock size={14} color={activeLane === 'done' ? '#ea580c' : '#64748b'} />
                    )}
                    <Text
                      style={[
                        styles.timerText,
                        isLate
                          ? styles.timerTextLate
                          : activeLane === 'done'
                          ? styles.timerTextDone
                          : styles.timerTextNormal,
                      ]}
                    >
                      {elapsed}p {isLate ? '(Trễ)' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.itemsWrapper}>
                  {order.items?.map((item: any, idx: number) => (
                    <View key={idx} style={styles.itemRow}>
                      <View style={styles.itemAccentBar} />
                      <View style={styles.itemContent}>
                        <View style={styles.itemTitleRow}>
                          <Text style={styles.itemQty}>{item.qty || 1}×</Text>
                          <Text style={styles.itemName}>{item.product_name}</Text>
                        </View>

                        <Text style={styles.itemSpecs}>
                          {item.size_label || 'Size M'}
                          {item.base_tea ? ` · ${item.base_tea}` : ''}
                          {item.sugar_level ? ` · ${item.sugar_level}` : ''}
                          {item.ice_level ? ` · ${item.ice_level}` : ''}
                          {item.toppings?.length > 0
                            ? ` · ${item.toppings.map((t: any) => t.name).join(', ')}`
                            : ''}
                        </Text>

                        {item.note ? (
                          <View style={styles.noteBox}>
                            <AlertCircle size={12} color="#b45309" />
                            <Text style={styles.noteText}>{item.note}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>

                {activeLane === 'delivering' && (
                  <View style={styles.shipperCard}>
                    <View style={styles.shipperRow}>
                      <Bike size={16} color="#d97706" />
                      <Text style={styles.shipperTitle}>
                        Shipper: {order.shipping_driver_name || 'Đang chờ tài xế nhận đơn'}
                      </Text>
                    </View>
                    {order.shipping_driver_phone && (
                      <Text style={styles.shipperPhone}>
                        Liên hệ: {order.shipping_driver_phone}
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.cardFooter}>
                  {activeLane === 'prep' && (
                    <>
                      {isDelivery ? (
                        <TouchableOpacity
                          style={[styles.btnAmber, updatingId === order.id && styles.btnDisabled]}
                          onPress={() => handlePreparationComplete(order)}
                          disabled={updatingId === order.id}
                          activeOpacity={0.85}
                        >
                          {updatingId === order.id ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <Bike size={16} color="#ffffff" />
                              <Text style={styles.btnText}>Pha xong ➔ Giao Shipper</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.btnEmerald, updatingId === order.id && styles.btnDisabled]}
                          onPress={() => handlePreparationComplete(order)}
                          disabled={updatingId === order.id}
                          activeOpacity={0.85}
                        >
                          {updatingId === order.id ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <>
                              <CheckCircle2 size={16} color="#ffffff" />
                              <Text style={styles.btnText}>Hoàn thành món</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  {activeLane === 'delivering' && (
                    <TouchableOpacity
                      style={[styles.btnEmerald, updatingId === order.id && styles.btnDisabled]}
                      onPress={() => handleDeliveryComplete(order)}
                      disabled={updatingId === order.id}
                      activeOpacity={0.85}
                    >
                      {updatingId === order.id ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <PackageCheck size={16} color="#ffffff" />
                          <Text style={styles.btnText}>Xác nhận khách đã nhận món</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {activeLane === 'done' && (
                    <View style={styles.doneBanner}>
                      <CheckCircle2 size={15} color="#ea580c" />
                      <Text style={styles.doneBannerText}>Đơn đã hoàn tất phục vụ</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Modal Bàn Giao Shipper */}
      <Modal
        visible={!!handoverOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setHandoverOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleCol}>
                <Text style={styles.modalTitle}>Bàn giao cho Shipper</Text>
                <Text style={styles.modalSubtitle}>
                  Đơn {handoverOrder?.order_code} · {handoverOrder?.customer_name || 'Khách'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setHandoverOrder(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>
                Tên Shipper <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: Nguyễn Văn Nam (Grab/AhaMove)"
                placeholderTextColor="#94a3b8"
                value={handoverDriverName}
                onChangeText={setHandoverDriverName}
              />

              <Text style={styles.inputLabel}>
                Số điện thoại Shipper <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="VD: 0912345678"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={handoverDriverPhone}
                onChangeText={setHandoverDriverPhone}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setHandoverOrder(null)}
                disabled={handoverLoading}
              >
                <Text style={styles.btnModalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnModalSubmit, handoverLoading && styles.btnDisabled]}
                onPress={submitHandover}
                disabled={handoverLoading}
              >
                {handoverLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Xác nhận giao Shipper</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#f97316',
  },
  tabDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingLabel: {
    marginTop: 14,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLate: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffaf0',
  },
  cardDone: {
    borderColor: '#fed7aa',
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  codeCol: {
    flex: 1,
    marginRight: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orderCode: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeDelivery: {
    backgroundColor: '#dbeafe',
  },
  typeBadgeDineIn: {
    backgroundColor: '#fef3c7',
  },
  typeBadgeTakeaway: {
    backgroundColor: '#fff7ed',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  typeTextDelivery: {
    color: '#1d4ed8',
  },
  typeTextDineIn: {
    color: '#b45309',
  },
  typeTextTakeaway: {
    color: '#ea580c',
  },
  customerSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  customerName: {
    fontWeight: '600',
    color: '#334155',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  timerPillNormal: {
    backgroundColor: '#f1f5f9',
  },
  timerPillLate: {
    backgroundColor: '#fee2e2',
  },
  timerPillDone: {
    backgroundColor: '#fff7ed',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  timerTextNormal: {
    color: '#475569',
  },
  timerTextLate: {
    color: '#dc2626',
  },
  timerTextDone: {
    color: '#ea580c',
  },
  itemsWrapper: {
    paddingVertical: 12,
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemAccentBar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: '#f97316',
    marginRight: 10,
    alignSelf: 'stretch',
  },
  itemContent: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ea580c',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  itemSpecs: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 17,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#fef3c7',
  },
  noteText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
    flex: 1,
  },
  shipperCard: {
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fef3c7',
    marginBottom: 8,
  },
  shipperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shipperTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  shipperPhone: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 3,
    marginLeft: 22,
  },
  cardFooter: {
    marginTop: 4,
  },
  btnEmerald: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f97316',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnAmber: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d97706',
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  doneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
  },
  doneBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ea580c',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  modalTitleCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modalBody: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#ef4444',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  btnModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  btnModalSubmit: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: '#f97316',
  },
  btnModalSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});
