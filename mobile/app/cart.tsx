import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Trash2, Plus, Minus, Tag, Check, ArrowRight } from 'lucide-react-native';
import { useCartStore } from '../src/store/cartStore';
import { vnd } from '../src/lib/formatters';
import apiClient from '../src/lib/api';

export default function CartScreen() {
  const router = useRouter();
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    total,
    appliedVoucher,
    discountAmount,
    setAppliedVoucher,
    selectedTable,
    orderType,
    setOrderType,
  } = useCartStore();

  const [voucherInput, setVoucherInput] = useState(appliedVoucher?.code || '');
  const [checkingVoucher, setCheckingVoucher] = useState(false);

  const handleApplyVoucher = async () => {
    if (!voucherInput.trim()) return;
    setCheckingVoucher(true);
    try {
      const res = await apiClient.post('/vouchers/apply', {
        code: voucherInput.trim().toUpperCase(),
        subtotal: subtotal(),
      });
      if (res.data.valid) {
        setAppliedVoucher(
          {
            id: 1,
            code: voucherInput.trim().toUpperCase(),
            title: res.data.message || 'Mã giảm giá',
            discount_type: 'fixed',
            discount_value: res.data.discount_amount,
            min_order: 0,
            start_date: '',
            end_date: '',
            is_active: true,
          },
          res.data.discount_amount
        );
        Alert.alert('Thành công', `Đã áp dụng mã giảm ${vnd(res.data.discount_amount)}`);
      }
    } catch (err: any) {
      Alert.alert('Không thể áp dụng voucher', err.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    } finally {
      setCheckingVoucher(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Giỏ hàng đang trống</Text>
        <Text style={styles.emptyDesc}>Hãy chọn cho mình những ly trà trái cây thơm ngon nhé!</Text>
        <TouchableOpacity style={styles.backToMenuBtn} onPress={() => router.push('/(tabs)/menu')}>
          <Text style={styles.backToMenuBtnText}>Khám phá thực đơn</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Type Toggle */}
        <View style={styles.orderTypeSection}>
          <TouchableOpacity
            style={[styles.typeBtn, orderType === 'Takeaway' && styles.typeBtnActive]}
            onPress={() => setOrderType('Takeaway')}
          >
            <Text style={[styles.typeBtnText, orderType === 'Takeaway' && styles.typeBtnTextActive]}>
              🛍️ Mang về
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, orderType === 'Delivery' && styles.typeBtnActive]}
            onPress={() => setOrderType('Delivery')}
          >
            <Text style={[styles.typeBtnText, orderType === 'Delivery' && styles.typeBtnTextActive]}>
              🛵 Giao tận nơi
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeBtn, orderType === 'DineIn' && styles.typeBtnActive]}
            onPress={() => setOrderType('DineIn')}
          >
            <Text style={[styles.typeBtnText, orderType === 'DineIn' && styles.typeBtnTextActive]}>
              🍽️ {selectedTable ? selectedTable.name : 'Tại bàn'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cart Items List */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>Món đã chọn ({items.length})</Text>
          {items.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <Image
                source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80' }}
                style={styles.itemImage}
              />
              <View style={styles.itemDetails}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.product_name}</Text>
                  <TouchableOpacity onPress={() => removeItem(item.id)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.itemOptions}>
                  Size {item.size_label} · {item.sugar_level} · {item.ice_level}
                </Text>
                {item.toppings && item.toppings.length > 0 && (
                  <Text style={styles.itemToppings}>
                    + {item.toppings.map((t) => t.name).join(', ')}
                  </Text>
                )}
                {item.note ? <Text style={styles.itemNote}>"{item.note}"</Text> : null}

                <View style={styles.itemFooter}>
                  <Text style={styles.itemPrice}>{vnd(item.item_total)}</Text>
                  <View style={styles.qtyControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, -1)}
                    >
                      <Minus size={14} color="#4b5563" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.id, 1)}
                    >
                      <Plus size={14} color="#4b5563" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Voucher Input */}
        <View style={styles.voucherSection}>
          <Text style={styles.sectionTitle}>Ưu đãi & Khuyến mãi</Text>
          <View style={styles.voucherInputRow}>
            <Tag size={18} color="#ea580c" />
            <TextInput
              style={styles.voucherInput}
              placeholder="Nhập mã voucher (VD: GIAM20K)..."
              placeholderTextColor="#9ca3af"
              value={voucherInput}
              onChangeText={setVoucherInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.applyBtn}
              activeOpacity={0.8}
              onPress={handleApplyVoucher}
              disabled={checkingVoucher}
            >
              <Text style={styles.applyBtnText}>{checkingVoucher ? '...' : 'Áp dụng'}</Text>
            </TouchableOpacity>
          </View>
          {appliedVoucher ? (
            <View style={styles.voucherAppliedTag}>
              <Check size={14} color="#16a34a" />
              <Text style={styles.voucherAppliedText}>Đã giảm {vnd(discountAmount)} ({appliedVoucher.code})</Text>
            </View>
          ) : null}
        </View>

        {/* Bill Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Chi tiết thanh toán</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryValue}>{vnd(subtotal())}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Giảm giá voucher</Text>
              <Text style={[styles.summaryValue, { color: '#16a34a' }]}>-{vnd(discountAmount)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{vnd(total())}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Checkout Bar */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTotalLabel}>Tổng thanh toán</Text>
          <Text style={styles.bottomTotalValue}>{vnd(total())}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/checkout')}
        >
          <Text style={styles.checkoutBtnText}>Thanh toán</Text>
          <ArrowRight size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
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
  orderTypeSection: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  typeBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeBtnTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  itemsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 10,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  itemImage: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  itemOptions: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemToppings: {
    fontSize: 11,
    color: '#ea580c',
    fontWeight: '600',
  },
  itemNote: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#9ca3af',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ea580c',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  qtyBtn: {
    padding: 6,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    color: '#1f2937',
  },
  voucherSection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  voucherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#fff7ed',
  },
  voucherInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '700',
    height: 42,
  },
  applyBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  applyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  voucherAppliedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  voucherAppliedText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  summarySection: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  bottomTotalValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#ea580c',
  },
  checkoutBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 8,
  },
  checkoutBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  backToMenuBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  backToMenuBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
