import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { QrCode, Banknote, MapPin, Phone, User, CheckCircle } from 'lucide-react-native';
import { useCartStore } from '../src/store/cartStore';
import { useAuthStore } from '../src/store/authStore';
import { vnd } from '../src/lib/formatters';
import apiClient from '../src/lib/api';
import { VietQRModal } from '../src/components/VietQRModal';

export default function CheckoutScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const {
    items,
    total,
    subtotal,
    discountAmount,
    appliedVoucher,
    selectedStore,
    selectedTable,
    orderType,
    customerName: storedName,
    customerPhone: storedPhone,
    deliveryAddress: storedAddress,
    clearCart,
  } = useCartStore();

  const [name, setName] = useState(user?.fullname || storedName || '');
  const [phone, setPhone] = useState(user?.phone || storedPhone || '');
  const [address, setAddress] = useState(storedAddress || '');
  const [paymentMethod, setPaymentMethod] = useState<'VietQR' | 'COD'>('VietQR');
  const [submitting, setSubmitting] = useState(false);

  // VietQR Modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const [createdOrderCode, setCreatedOrderCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const handlePlaceOrder = async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người nhận');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại');
      return;
    }
    if (orderType === 'Delivery' && !address.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập địa chỉ nhận hàng');
      return;
    }

    setSubmitting(true);
    try {
      const orderPayload = {
        store_id: selectedTable?.store_id || selectedStore?.id || 1,
        table_id: orderType === 'DineIn' ? selectedTable?.id : undefined,
        order_type: orderType,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        delivery_addr: orderType === 'Delivery' ? address.trim() : undefined,
        payment_method: paymentMethod,
        source: 'online',
        voucher_code: appliedVoucher?.code || undefined,
        items: items.map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          size_label: it.size_label,
          sugar_level: it.sugar_level,
          ice_level: it.ice_level,
          base_tea: it.base_tea,
          toppings: it.toppings,
          note: it.note,
        })),
      };

      const res = await apiClient.post('/orders', orderPayload);
      const order = res.data;

      if (paymentMethod === 'VietQR') {
        setCreatedOrderCode(order.order_code || `TP-${Date.now()}`);
        setQrCodeUrl(order.qr_code_url || order.checkout_url || '');
        setShowQRModal(true);
      } else {
        clearCart();
        Alert.alert('Đặt hàng thành công!', `Mã đơn hàng: ${order.order_code}`, [
          {
            text: 'Theo dõi đơn',
            onPress: () => router.replace(`/tracking/${order.order_code}`),
          },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Đặt hàng không thành công', err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishQR = () => {
    setShowQRModal(false);
    clearCart();
    router.replace(`/tracking/${createdOrderCode}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Destination & Location Info */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Hình thức phục vụ</Text>
          <View style={styles.locationBadge}>
            <MapPin size={18} color="#ea580c" />
            <Text style={styles.locationText}>
              {orderType === 'DineIn'
                ? `Tại bàn: ${selectedTable?.name || 'Bàn 01'} (${selectedTable?.store_name || 'TeaPlus Q.1'})`
                : orderType === 'Delivery'
                ? 'Giao hàng tận nơi'
                : 'Đến lấy tại quán (Takeaway)'}
            </Text>
          </View>
        </View>

        {/* Receiver Contact Information */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
          <View style={styles.inputGroup}>
            <View style={styles.inputRow}>
              <User size={18} color="#9ca3af" />
              <TextInput
                style={styles.textInput}
                placeholder="Họ và tên..."
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputRow}>
              <Phone size={18} color="#9ca3af" />
              <TextInput
                style={styles.textInput}
                placeholder="Số điện thoại..."
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {orderType === 'Delivery' && (
              <View style={styles.inputRow}>
                <MapPin size={18} color="#9ca3af" />
                <TextInput
                  style={styles.textInput}
                  placeholder="Địa chỉ giao hàng chi tiết..."
                  placeholderTextColor="#9ca3af"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>
            )}
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'VietQR' && styles.paymentOptionActive]}
            onPress={() => setPaymentMethod('VietQR')}
            activeOpacity={0.8}
          >
            <View style={styles.paymentIconWrap}>
              <QrCode size={22} color="#ea580c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentName}>Chuyển khoản VietQR / PayOS</Text>
              <Text style={styles.paymentDesc}>Quét mã QR tự động mở App ngân hàng</Text>
            </View>
            {paymentMethod === 'VietQR' && <CheckCircle size={20} color="#ea580c" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, paymentMethod === 'COD' && styles.paymentOptionActive]}
            onPress={() => setPaymentMethod('COD')}
            activeOpacity={0.8}
          >
            <View style={[styles.paymentIconWrap, { backgroundColor: '#dcfce7' }]}>
              <Banknote size={22} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentName}>Tiền mặt khi nhận món</Text>
              <Text style={styles.paymentDesc}>Thanh toán trực tiếp cho nhân viên</Text>
            </View>
            {paymentMethod === 'COD' && <CheckCircle size={20} color="#16a34a" />}
          </TouchableOpacity>
        </View>

        {/* Order Summary */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tóm tắt đơn hàng</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính ({items.length} món):</Text>
            <Text style={styles.summaryValue}>{vnd(subtotal())}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Mã giảm giá ({appliedVoucher?.code}):</Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{vnd(discountAmount)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Thanh toán:</Text>
            <Text style={styles.totalValue}>{vnd(total())}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Place Order Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.orderBtn}
          activeOpacity={0.85}
          onPress={handlePlaceOrder}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.orderBtnText}>Xác nhận đặt hàng · {vnd(total())}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* VietQR Modal */}
      <VietQRModal
        visible={showQRModal}
        orderCode={createdOrderCode}
        qrCodeUrl={qrCodeUrl}
        amount={total()}
        onClose={handleFinishQR}
        onConfirmPaid={handleFinishQR}
      />
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
  sectionCard: {
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
    marginBottom: 12,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
    flex: 1,
  },
  inputGroup: {
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  textInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: '#1f2937',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  paymentOptionActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  paymentIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  paymentDesc: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
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
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    padding: 16,
  },
  orderBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  orderBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
