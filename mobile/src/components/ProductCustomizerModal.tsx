import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { X, Minus, Plus } from 'lucide-react-native';
import { Product } from '../types';
import { vnd } from '../lib/formatters';
import { useCartStore } from '../store/cartStore';

interface ProductCustomizerModalProps {
  product: Product | null;
  visible: boolean;
  onClose: () => void;
}

const SIZES = [
  { label: 'Size M (Vừa)', price: 0 },
  { label: 'Size L (Lớn)', price: 6000 },
  { label: 'Size XL (Khổng lồ)', price: 12000 },
];

const SUGAR_LEVELS = ['100% đường', '70% đường', '50% đường', '30% đường', '0% đường'];
const ICE_LEVELS = ['100% đá', '50% đá', '30% đá', 'Không đá'];
const TEA_BASES = ['Trà Ô Long', 'Trà Lài', 'Trà Đen'];

const AVAILABLE_TOPPINGS = [
  { name: 'Trân châu trắng', price: 6000 },
  { name: 'Thạch nha đam', price: 6000 },
  { name: 'Thạch trái cây', price: 8000 },
  { name: 'Kem Cheese béo ngậy', price: 10000 },
  { name: 'Đào ngâm giòn', price: 10000 },
];

export function ProductCustomizerModal({ product, visible, onClose }: ProductCustomizerModalProps) {
  const addItem = useCartStore((state) => state.addItem);

  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedSugar, setSelectedSugar] = useState(SUGAR_LEVELS[0]);
  const [selectedIce, setSelectedIce] = useState(ICE_LEVELS[0]);
  const [selectedBase, setSelectedBase] = useState(TEA_BASES[0]);
  const [selectedToppings, setSelectedToppings] = useState<Array<{ name: string; price: number }>>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  if (!product) return null;

  const toggleTopping = (topping: { name: string; price: number }) => {
    setSelectedToppings((prev) => {
      const exists = prev.some((t) => t.name === topping.name);
      if (exists) {
        return prev.filter((t) => t.name !== topping.name);
      }
      return [...prev, topping];
    });
  };

  const toppingTotal = selectedToppings.reduce((sum, t) => sum + t.price, 0);
  const unitPrice = product.price + selectedSize.price + toppingTotal;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    addItem({
      product_id: product.id,
      product_name: product.name,
      image_url: product.image_url,
      unit_price: product.price,
      size_label: selectedSize.label.split(' ')[1] || 'M',
      size_price: selectedSize.price,
      sugar_level: selectedSugar,
      ice_level: selectedIce,
      base_tea: selectedBase,
      toppings: selectedToppings,
      note: note.trim() || undefined,
      quantity,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tùy chỉnh món</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#4b5563" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Product Summary */}
            <View style={styles.productSummary}>
              <Image
                source={{ uri: product.image_url || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80' }}
                style={styles.summaryImage}
              />
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryName}>{product.name}</Text>
                <Text style={styles.summaryPrice}>{vnd(product.price)}</Text>
              </View>
            </View>

            {/* Size Options */}
            <Text style={styles.sectionTitle}>1. Chọn kích cỡ (Size)</Text>
            <View style={styles.optionsRow}>
              {SIZES.map((size) => (
                <TouchableOpacity
                  key={size.label}
                  style={[styles.chip, selectedSize.label === size.label && styles.chipActive]}
                  onPress={() => setSelectedSize(size)}
                >
                  <Text style={[styles.chipText, selectedSize.label === size.label && styles.chipTextActive]}>
                    {size.label} {size.price > 0 ? `(+${vnd(size.price)})` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sugar Level */}
            <Text style={styles.sectionTitle}>2. Mức ngọt (Đường)</Text>
            <View style={styles.optionsRow}>
              {SUGAR_LEVELS.map((sugar) => (
                <TouchableOpacity
                  key={sugar}
                  style={[styles.chip, selectedSugar === sugar && styles.chipActive]}
                  onPress={() => setSelectedSugar(sugar)}
                >
                  <Text style={[styles.chipText, selectedSugar === sugar && styles.chipTextActive]}>
                    {sugar}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Ice Level */}
            <Text style={styles.sectionTitle}>3. Lượng đá</Text>
            <View style={styles.optionsRow}>
              {ICE_LEVELS.map((ice) => (
                <TouchableOpacity
                  key={ice}
                  style={[styles.chip, selectedIce === ice && styles.chipActive]}
                  onPress={() => setSelectedIce(ice)}
                >
                  <Text style={[styles.chipText, selectedIce === ice && styles.chipTextActive]}>
                    {ice}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tea Base */}
            <Text style={styles.sectionTitle}>4. Đế trà</Text>
            <View style={styles.optionsRow}>
              {TEA_BASES.map((base) => (
                <TouchableOpacity
                  key={base}
                  style={[styles.chip, selectedBase === base && styles.chipActive]}
                  onPress={() => setSelectedBase(base)}
                >
                  <Text style={[styles.chipText, selectedBase === base && styles.chipTextActive]}>
                    {base}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Toppings */}
            <Text style={styles.sectionTitle}>5. Topping thêm</Text>
            <View style={styles.optionsCol}>
              {AVAILABLE_TOPPINGS.map((topping) => {
                const isSelected = selectedToppings.some((t) => t.name === topping.name);
                return (
                  <TouchableOpacity
                    key={topping.name}
                    style={[styles.toppingRow, isSelected && styles.toppingRowActive]}
                    onPress={() => toggleTopping(topping)}
                  >
                    <Text style={[styles.toppingName, isSelected && styles.toppingNameActive]}>
                      {isSelected ? '✓ ' : '+ '} {topping.name}
                    </Text>
                    <Text style={[styles.toppingPrice, isSelected && styles.toppingPriceActive]}>
                      +{vnd(topping.price)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Special Note */}
            <Text style={styles.sectionTitle}>Ghi chú cho quán</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Ví dụ: Ít ngọt, cho đá riêng, mang về..."
              placeholderTextColor="#9ca3af"
              value={note}
              onChangeText={setNote}
              maxLength={150}
            />
          </ScrollView>

          {/* Footer & Add Button */}
          <View style={styles.footer}>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus size={18} color="#4b5563" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => q + 1)}
              >
                <Plus size={18} color="#4b5563" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} activeOpacity={0.85} onPress={handleAddToCart}>
              <Text style={styles.submitBtnText}>Thêm vào giỏ · {vnd(totalPrice)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    paddingHorizontal: 20,
  },
  productSummary: {
    flexDirection: 'row',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'center',
  },
  summaryImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  summaryInfo: {
    marginLeft: 14,
    flex: 1,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  summaryPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ea580c',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 6,
  },
  chipActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  chipText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  optionsCol: {
    gap: 8,
  },
  toppingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  toppingRowActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  toppingName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  toppingNameActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  toppingPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
  },
  toppingPriceActive: {
    color: '#ea580c',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 4,
    backgroundColor: '#f9fafb',
  },
  qtyBtn: {
    padding: 8,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 8,
    color: '#1f2937',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
