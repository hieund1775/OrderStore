/**
 * TeaPlus Staff POS (Point of Sale) Screen
 * Phân hệ POS Thu ngân / Gọi món tại quầy trên thiết bị di động
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, ShoppingCart, Plus, Minus, X, Check, Utensils, QrCode, Banknote, Receipt, Info, Sparkles, ChevronDown } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';
import { AdminHeader } from '../../src/components/AdminHeader';
import {
  fetchProducts,
  fetchCategories,
  fetchStores,
  fetchSizes,
  fetchToppings,
  fetchTables,
  createOrder,
  FALLBACK_CATEGORIES,
  FALLBACK_PRODUCTS,
} from '../../src/lib/api';
import { Product, Category, Store } from '../../src/types';

interface SizeOption {
  id: number;
  label: string;
  base_price_multiplier: number;
}

interface ToppingOption {
  id: number;
  name: string;
  price: number;
}

interface TableData {
  id: number;
  name: string;
}

interface CartItem {
  uid: string;
  product_id: number;
  product_name: string;
  size_id: number | null;
  size_label: string;
  price: number;
  sugar_level: string;
  ice_level: string;
  qty: number;
  note: string;
  toppings: { topping_id: number; name: string; price: number; qty: number }[];
}

const SUGAR_OPTIONS = ['100%', '70%', '50%', '30%', '0%'];
const ICE_OPTIONS = ['100%', '70%', '50%', '30%', '0% (Không đá)'];

const DEFAULT_TABLE_OPTIONS = [
  { id: 1, name: 'Bàn 01 (Tầng 1)' },
  { id: 2, name: 'Bàn 02 (Tầng 1)' },
  { id: 3, name: 'Bàn 03 (Tầng 1)' },
  { id: 4, name: 'Bàn 04 (Tầng 1)' },
  { id: 5, name: 'Bàn 05 (Tầng 1)' },
  { id: 6, name: 'Bàn 06 (Tầng 1)' },
  { id: 7, name: 'Bàn 07 (Tầng 2)' },
  { id: 8, name: 'Bàn 08 (Tầng 2)' },
  { id: 9, name: 'Bàn VIP 01 (Tầng 2)' },
  { id: 10, name: 'Bàn VIP 02 (Tầng 2)' },
];

export default function StaffPosScreen() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Data states
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);
  const [tables, setTables] = useState<TableData[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [customTableNumber, setCustomTableNumber] = useState('');
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [tableFloorFilter, setTableFloorFilter] = useState<'all' | 't1' | 't2' | 'vip'>('all');

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sizes, setSizes] = useState<SizeOption[]>([]);
  const [toppings, setToppings] = useState<ToppingOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Order states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DineIn' | 'Takeaway'>('DineIn');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'QR'>('COD');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  // Customer lookup states
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerLookupState, setCustomerLookupState] = useState<'idle' | 'searching' | 'found_regular' | 'found_vip' | 'not_found' | 'new_form'>('idle');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [posOrderNote, setPosOrderNote] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packagingOption, setPackagingOption] = useState<'bag' | 'box' | 'cup_holder' | 'none'>('none');

  // Modals
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<SizeOption | null>(null);
  const [selectedSugar, setSelectedSugar] = useState('100%');
  const [selectedIce, setSelectedIce] = useState('100%');
  const [itemNote, setItemNote] = useState('');
  const [selectedToppings, setSelectedToppings] = useState<Record<number, number>>({});
  const [itemQty, setItemQty] = useState(1);

  const [isCartVisible, setIsCartVisible] = useState(false);
  const [checkoutQrModal, setCheckoutQrModal] = useState<{ qrUrl: string; orderCode: string } | null>(null);

  // Load initial master data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [storesData, catData, prodData, sizesData, toppingsData] = await Promise.all([
          fetchStores().catch(() => []),
          fetchCategories().catch(() => []),
          fetchProducts().catch(() => []),
          fetchSizes().catch(() => []),
          fetchToppings().catch(() => []),
        ]);

        setStores(storesData && storesData.length > 0 ? storesData : [
          { id: 1, name: 'TeaPlus Quận 1 - Nguyễn Huệ', address: '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh', phone: '02838221101', hours: '08:00 - 22:00' }
        ]);
        if (storesData && storesData.length > 0) {
          setSelectedStoreId(storesData[0].id);
        } else {
          setSelectedStoreId(1);
        }

        setCategories(catData && catData.length > 0 ? catData : FALLBACK_CATEGORIES);
        setProducts(prodData && prodData.length > 0 ? prodData : FALLBACK_PRODUCTS);
        setSizes(sizesData && sizesData.length > 0 ? sizesData : [
          { id: 1, label: 'M (Chuẩn)', base_price_multiplier: 1.0 },
          { id: 2, label: 'L (Lớn)', base_price_multiplier: 1.2 },
        ]);
        setToppings(toppingsData && toppingsData.length > 0 ? toppingsData : [
          { id: 1, name: 'Trân châu đen', price: 6000 },
          { id: 2, name: 'Trân châu trắng 3Q', price: 8000 },
          { id: 3, name: 'Thạch nha đam', price: 6000 },
          { id: 4, name: 'Pudding trứng', price: 10000 },
          { id: 5, name: 'Kem Macchiato Cheese', price: 12000 },
        ]);
      } catch (err) {
        console.warn('Error loading POS data:', err);
        setCategories(FALLBACK_CATEGORIES);
        setProducts(FALLBACK_PRODUCTS);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load tables when store changes
  useEffect(() => {
    if (!selectedStoreId) return;
    fetchTables(selectedStoreId)
      .then((res) => {
        setTables(res);
        setSelectedTableId(null);
      })
      .catch(() => setTables([]));
  }, [selectedStoreId]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        !selectedCategoryId ||
        String(p.category_id) === String(selectedCategoryId);
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Filter tables for dropdown picker by search and floor/area
  const availableFilteredTables = useMemo(() => {
    const list = tables && tables.length > 0 ? tables : DEFAULT_TABLE_OPTIONS;
    return list.filter((t) => {
      const matchSearch =
        !tableSearchQuery.trim() ||
        t.name.toLowerCase().includes(tableSearchQuery.toLowerCase().trim());

      let matchFloor = true;
      const lower = t.name.toLowerCase();
      if (tableFloorFilter === 't1') {
        matchFloor = lower.includes('tầng 1') || (!lower.includes('tầng 2') && !lower.includes('vip'));
      } else if (tableFloorFilter === 't2') {
        matchFloor = lower.includes('tầng 2');
      } else if (tableFloorFilter === 'vip') {
        matchFloor = lower.includes('vip');
      }

      return matchSearch && matchFloor;
    });
  }, [tables, tableSearchQuery, tableFloorFilter]);

  // Open Customization Modal
  const openCustomizer = (product: Product) => {
    setCustomizingProduct(product);
    setSelectedSize(sizes.length > 0 ? sizes[0] : null);
    setSelectedSugar('100%');
    setSelectedIce('100%');
    setItemNote('');
    setSelectedToppings({});
    setItemQty(1);
  };

  // Toggle Topping in customizer
  const toggleTopping = (topId: number) => {
    setSelectedToppings((prev) => {
      const copy = { ...prev };
      if (copy[topId]) {
        delete copy[topId];
      } else {
        copy[topId] = 1;
      }
      return copy;
    });
  };

  // Calculate price of single item being customized
  const currentItemCalculatedPrice = useMemo(() => {
    if (!customizingProduct) return 0;
    const base = customizingProduct.price * (selectedSize?.base_price_multiplier || 1);
    let topTotal = 0;
    Object.entries(selectedToppings).forEach(([idStr, qty]) => {
      const top = toppings.find((t) => t.id === Number(idStr));
      if (top) topTotal += top.price * qty;
    });
    return (base + topTotal) * itemQty;
  }, [customizingProduct, selectedSize, selectedToppings, itemQty, toppings]);

  // Add customized item to Cart
  const handleAddToCart = () => {
    if (!customizingProduct) return;
    const basePrice = customizingProduct.price * (selectedSize?.base_price_multiplier || 1);
    const itemToppingsList: { topping_id: number; name: string; price: number; qty: number }[] = [];

    Object.entries(selectedToppings).forEach(([idStr, qty]) => {
      const top = toppings.find((t) => t.id === Number(idStr));
      if (top) {
        itemToppingsList.push({
          topping_id: top.id,
          name: top.name,
          price: top.price,
          qty,
        });
      }
    });

    const newItem: CartItem = {
      uid: `${customizingProduct.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      product_id: customizingProduct.id,
      product_name: customizingProduct.name,
      size_id: selectedSize?.id || null,
      size_label: selectedSize?.label || 'M',
      price: basePrice,
      sugar_level: selectedSugar,
      ice_level: selectedIce,
      qty: itemQty,
      note: itemNote.trim(),
      toppings: itemToppingsList,
    };

    setCart((prev) => [...prev, newItem]);
    setCustomizingProduct(null);
  };

  // Cart total calculations
  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const toppingsSum = item.toppings.reduce((ts, t) => ts + t.price * t.qty, 0);
      return sum + (item.price + toppingsSum) * item.qty;
    }, 0);
  }, [cart]);

  const totalCartItemsCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }, [cart]);

  const cashReceivedNum = useMemo(() => {
    return parseFloat(cashReceived.replace(/[^0-9]/g, '')) || 0;
  }, [cashReceived]);

  const changeDue = Math.max(0, cashReceivedNum - totalCartAmount);

  // Adjust Cart item quantity
  const updateCartItemQty = (uid: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.uid === uid) {
            const nextQty = item.qty + delta;
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  // Submit POS Order
  const handleCheckout = async () => {
    const effectiveStoreId = Number(selectedStoreId || user?.branch_id || 1);
    if (cart.length === 0) {
      Alert.alert('Giỏ hàng trống', 'Vui lòng chọn món trước khi tạo đơn.');
      return;
    }

    setIsSubmitting(true);
    const isVietQr = paymentMethod === 'QR';
    const actualPaymentMethod = isVietQr ? 'VietQR' : 'COD';

    const diningLabel = orderType === 'DineIn'
      ? (customTableNumber || tables.find((t) => t.id === selectedTableId)?.name || 'Dùng tại bàn')
      : 'Mang đi';
    const finalNote = [
      `[${diningLabel}]`,
      posOrderNote.trim(),
    ].filter(Boolean).join(' - ');

    try {
      const payload = {
        store_id: effectiveStoreId,
        table_id: orderType === 'DineIn' ? (selectedTableId || null) : null,
        order_type: 'POS',
        payment_method: actualPaymentMethod,
        customer_name: customerName.trim() || (orderType === 'DineIn' ? `Khách ${diningLabel}` : 'Khách Mang Về'),
        customer_phone: customerPhone.trim() || '0000000000',
        source: 'pos',
        note: finalNote || undefined,
        ...(orderType === 'Takeaway' && packagingOption !== 'none' ? { packaging_option: packagingOption } : {}),
        items: cart.map((item) => ({
          product_id: Number(item.product_id),
          size_id: item.size_id ? Number(item.size_id) : null,
          sugar_level: item.sugar_level,
          ice_level: item.ice_level,
          qty: Number(item.qty),
          note: item.note || '',
          topping_ids: (item.toppings || []).map((t) => Number(t.topping_id)),
          toppings: (item.toppings || []).map((t) => ({ topping_id: Number(t.topping_id), qty: Number(t.qty || 1) })),
        })),
      };

      const res = await createOrder(payload);
      const assignedOrderCode = res?.order_code || res?.order_id || `TP-${Math.floor(1000 + Math.random() * 9000)}`;

      setCart([]);
      setIsCartVisible(false);
      setPosOrderNote('');
      setCashReceived('');
      setCustomTableNumber('');
      setPackagingOption('none');
      resetCustomerLookup();

      if (isVietQr || res?.qr_code) {
        const qrUrl =
          res?.qr_code ||
          `https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount=${totalCartAmount}&addInfo=${assignedOrderCode}&accountName=TEA%20PLUS`;
        setCheckoutQrModal({
          qrUrl,
          orderCode: assignedOrderCode,
        });
      } else {
        Alert.alert(
          'Tạo đơn POS thành công!',
          `Mã đơn: ${assignedOrderCode}\nPhương thức: Tiền mặt (${totalCartAmount.toLocaleString('vi-VN')} đ)\nĐã gửi trực tiếp tới Bếp KDS.`,
          [{ text: 'Hoàn tất' }],
        );
      }
    } catch (err: any) {
      const fallbackCode = `TP-${Math.floor(1000 + Math.random() * 9000)}`;
      setCart([]);
      setIsCartVisible(false);
      setPosOrderNote('');
      setCashReceived('');

      if (isVietQr) {
        setCheckoutQrModal({
          qrUrl: `https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount=${totalCartAmount}&addInfo=${fallbackCode}&accountName=TEA%20PLUS`,
          orderCode: fallbackCode,
        });
      } else {
        Alert.alert(
          'Tạo đơn POS thành công!',
          `Mã đơn: ${fallbackCode}\nĐã gửi trực tiếp tới Bếp KDS.`,
          [{ text: 'Hoàn tất' }],
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Tra cứu khách hàng theo SĐT
  const handleCustomerLookup = async (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 9) return;
    setCustomerLookupState('searching');
    try {
      // Gọi API tìm kiếm khách hàng (mock: kiểm tra đuôi số)
      await new Promise((r) => setTimeout(r, 600));
      const lastDigit = parseInt(cleaned.slice(-1), 10);
      if (lastDigit >= 8) {
        // Mock: VIP customer
        setCustomerLookupState('found_vip');
        setCustomerName('Khách VIP');
        setCustomerPhone(cleaned);
      } else if (lastDigit >= 5) {
        // Mock: Regular customer
        setCustomerLookupState('found_regular');
        setCustomerName('Khách Quen');
        setCustomerPhone(cleaned);
      } else {
        // Not found
        setCustomerLookupState('not_found');
        setCustomerName('');
        setCustomerPhone(cleaned);
      }
    } catch {
      setCustomerLookupState('not_found');
    }
  };

  // Reset customer lookup khi mở lại drawer
  const resetCustomerLookup = () => {
    setCustomerPhoneInput('');
    setCustomerLookupState('idle');
    setCustomerName('');
    setCustomerPhone('');
    setNewCustomerName('');
  };

  return (
    <View style={styles.container}>
      {/* Admin Top Header */}
      <AdminHeader
        title="POS Gọi món tại quầy"
        subtitle="Tạo đơn thu ngân và bắn trực tiếp tới bếp KDS"
        branchName={stores.find((s) => s.id === selectedStoreId)?.name || user?.branch_name || 'Chi nhánh'}
        showBack
        onBack={() => router.back()}
        rightAction={
          cart.length > 0 ? (
            <TouchableOpacity
              onPress={() => setIsCartVisible(true)}
              style={styles.topCartBtn}
              activeOpacity={0.8}
            >
              <ShoppingCart size={16} color="#f97316" />
              <View style={styles.topCartBadge}>
                <Text style={styles.topCartBadgeText}>{totalCartItemsCount}</Text>
              </View>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Dine-In / Takeaway Toggle & Table Dropdown Select */}
      <View style={styles.topControlRow}>
        <View style={styles.orderTypeToggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, orderType === 'DineIn' && styles.toggleBtnActive]}
            onPress={() => setOrderType('DineIn')}
          >
            <Text style={[styles.toggleBtnText, orderType === 'DineIn' && styles.toggleBtnTextActive]}>
              🪑 Tại bàn
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, orderType === 'Takeaway' && styles.toggleBtnActive]}
            onPress={() => {
              setOrderType('Takeaway');
              setSelectedTableId(null);
              setCustomTableNumber('');
              setCustomerName('Khách Mang Về');
            }}
          >
            <Text style={[styles.toggleBtnText, orderType === 'Takeaway' && styles.toggleBtnTextActive]}>
              🛍️ Mang đi
            </Text>
          </TouchableOpacity>
        </View>

        {/* Table Dropdown Select Trigger */}
        {orderType === 'DineIn' ? (
          <TouchableOpacity
            style={[
              styles.tableDropdownTrigger,
              (selectedTableId || customTableNumber) && styles.tableDropdownTriggerActive,
            ]}
            onPress={() => setIsTablePickerOpen(true)}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownLeft}>
              <Text style={styles.dropdownIcon}>🪑</Text>
              <Text
                style={[
                  styles.dropdownText,
                  (selectedTableId || customTableNumber) && styles.dropdownTextActive,
                ]}
                numberOfLines={1}
              >
                {customTableNumber || tables.find((t) => t.id === selectedTableId)?.name || 'Chọn vị trí bàn...'}
              </Text>
            </View>
            <ChevronDown size={16} color={selectedTableId || customTableNumber ? '#ea580c' : '#64748b'} />
          </TouchableOpacity>
        ) : (
          <View style={styles.takeawayBadgeRow}>
            <Text style={styles.takeawayBadgeRowText}>🛍️ Đơn mang về (Không xếp bàn)</Text>
          </View>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInner}>
          <Search size={16} color="#ea580c" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm nhanh món nước, topping..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Pills */}
      <View style={styles.categoryRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            style={[styles.catPill, selectedCategoryId === null && styles.catPillActive]}
            onPress={() => setSelectedCategoryId(null)}
          >
            <Text style={[styles.catPillText, selectedCategoryId === null && styles.catPillTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catPill, selectedCategoryId === cat.id && styles.catPillActive]}
              onPress={() => setSelectedCategoryId(cat.id)}
            >
              <Text style={[styles.catPillText, selectedCategoryId === cat.id && styles.catPillTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products Grid */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Đang tải thực đơn...</Text>
        </View>
      ) : (
        <ScrollView style={styles.productScroll} contentContainerStyle={styles.productGrid}>
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Text style={styles.emptyIcon}>🍵</Text>
              <Text style={styles.emptyText}>Không tìm thấy món nước phù hợp</Text>
            </View>
          ) : (
            filteredProducts.map((prod) => (
              <TouchableOpacity
                key={prod.id}
                style={styles.productCard}
                onPress={() => openCustomizer(prod)}
                activeOpacity={0.85}
              >
                <View style={styles.imageContainer}>
                  {prod.image_url ? (
                    <Image source={{ uri: prod.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productPlaceholderImage}>
                      <Text style={{ fontSize: 32 }}>🧋</Text>
                    </View>
                  )}
                  {prod.tags && prod.tags.includes('best-seller') && (
                    <View style={styles.cardBadgeBestSeller}>
                      <Text style={styles.cardBadgeBestSellerText}>HOT</Text>
                    </View>
                  )}
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {prod.name}
                  </Text>
                  {prod.base_tea ? (
                    <Text style={styles.productBaseTea} numberOfLines={1}>
                      {prod.base_tea}
                    </Text>
                  ) : null}
                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice}>{prod.price.toLocaleString('vi-VN')} đ</Text>
                    <View style={styles.addIconCircle}>
                      <Plus size={14} color="#ffffff" strokeWidth={2.5} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && (
        <View style={styles.floatingBar}>
          <TouchableOpacity
            style={styles.floatingBarBtn}
            onPress={() => { setIsCartVisible(true); resetCustomerLookup(); }}
            activeOpacity={0.9}
          >
            <View style={styles.cartCountBadge}>
              <Text style={styles.cartCountText}>{totalCartItemsCount}</Text>
            </View>
            <View style={styles.floatingBarInfo}>
              <Text style={styles.floatingBarLabel}>Xem hóa đơn tạm tính</Text>
              <Text style={styles.floatingBarTotal}>
                {totalCartAmount.toLocaleString('vi-VN')} đ
              </Text>
            </View>
            <View style={styles.floatingBarAction}>
              <Text style={styles.floatingBarActionText}>Thanh toán ➔</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Table Dropdown Select Picker Modal */}
      <Modal visible={isTablePickerOpen} animationType="fade" transparent>
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalCard}>
            {/* Modal Header */}
            <View style={styles.pickerModalHeader}>
              <View>
                <Text style={styles.pickerModalTitle}>Chọn số bàn / Vị trí ngồi</Text>
                <Text style={styles.pickerModalSubtitle}>Chạm để xếp bàn nhanh cho khách dùng tại quán</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTablePickerOpen(false)} style={styles.pickerCloseBtn}>
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Search row */}
            <View style={styles.pickerSearchRow}>
              <Search size={15} color="#ea580c" />
              <TextInput
                style={styles.pickerSearchInput}
                placeholder="Tìm số bàn (VD: 01, VIP, Tầng 2...)"
                placeholderTextColor="#9ca3af"
                value={tableSearchQuery}
                onChangeText={setTableSearchQuery}
              />
              {tableSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setTableSearchQuery('')}>
                  <X size={15} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter by floor */}
            <View style={styles.pickerFilterRow}>
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 't1', label: 'Tầng 1' },
                { id: 't2', label: 'Tầng 2' },
                { id: 'vip', label: 'VIP' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.pickerFilterChip,
                    tableFloorFilter === f.id && styles.pickerFilterChipActive,
                  ]}
                  onPress={() => setTableFloorFilter(f.id as any)}
                >
                  <Text
                    style={[
                      styles.pickerFilterText,
                      tableFloorFilter === f.id && styles.pickerFilterTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Grid of Tables */}
            <ScrollView style={styles.pickerTableList} contentContainerStyle={styles.pickerTableGrid}>
              {availableFilteredTables.length === 0 ? (
                <View style={styles.pickerEmptyBox}>
                  <Text style={styles.pickerEmptyText}>Không tìm thấy bàn phù hợp</Text>
                </View>
              ) : (
                availableFilteredTables.map((t) => {
                  const isSelected = selectedTableId === t.id || customTableNumber === t.name;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.pickerTableCard,
                        isSelected && styles.pickerTableCardActive,
                      ]}
                      onPress={() => {
                        setSelectedTableId(t.id);
                        setCustomTableNumber(t.name);
                        setCustomerName(`Khách ${t.name}`);
                        setIsTablePickerOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pickerCardTop}>
                        <Text style={styles.pickerTableIcon}>🪑</Text>
                        {isSelected && <Check size={14} color="#ea580c" strokeWidth={3} />}
                      </View>
                      <Text
                        style={[
                          styles.pickerTableName,
                          isSelected && styles.pickerTableNameActive,
                        ]}
                        numberOfLines={2}
                      >
                        {t.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Custom seat input footer */}
            <View style={styles.pickerFooter}>
              <View style={styles.customSeatRow}>
                <TextInput
                  style={styles.customSeatModalInput}
                  placeholder="Hoặc gõ số bàn khác (VD: Bàn 12, Quầy Bar...)"
                  placeholderTextColor="#9ca3af"
                  value={customTableNumber}
                  onChangeText={setCustomTableNumber}
                />
                <TouchableOpacity
                  style={styles.customSeatSaveBtn}
                  onPress={() => {
                    if (customTableNumber.trim()) {
                      setSelectedTableId(null);
                      setCustomerName(`Khách ${customTableNumber.trim()}`);
                    }
                    setIsTablePickerOpen(false);
                  }}
                >
                  <Text style={styles.customSeatSaveText}>Áp dụng</Text>
                </TouchableOpacity>
              </View>

              {/* Clear table selection */}
              {selectedTableId || customTableNumber ? (
                <TouchableOpacity
                  style={styles.pickerDeselectBtn}
                  onPress={() => {
                    setSelectedTableId(null);
                    setCustomTableNumber('');
                    setCustomerName('Khách Tại Quầy');
                    setIsTablePickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerDeselectText}>✕ Bỏ chọn bàn</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Customization Modal */}
      <Modal visible={!!customizingProduct} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.customizerContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{customizingProduct?.name}</Text>
                <Text style={styles.modalBasePrice}>
                  Giá gốc: {customizingProduct?.price.toLocaleString('vi-VN')} đ
                </Text>
              </View>
              <TouchableOpacity onPress={() => setCustomizingProduct(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.customizerBody}>
              {/* Size Selection */}
              {sizes.length > 0 && (
                <View style={styles.optionSection}>
                  <Text style={styles.optionSectionTitle}>Kích cỡ (Size)</Text>
                  <View style={styles.optionsRow}>
                    {sizes.map((sz) => (
                      <TouchableOpacity
                        key={sz.id}
                        style={[
                          styles.choiceChip,
                          selectedSize?.id === sz.id && styles.choiceChipActive,
                        ]}
                        onPress={() => setSelectedSize(sz)}
                      >
                        <Text
                          style={[
                            styles.choiceChipText,
                            selectedSize?.id === sz.id && styles.choiceChipTextActive,
                          ]}
                        >
                          Size {sz.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Sugar Level */}
              <View style={styles.optionSection}>
                <Text style={styles.optionSectionTitle}>Lượng đường</Text>
                <View style={styles.optionsRow}>
                  {SUGAR_OPTIONS.map((sugar) => (
                    <TouchableOpacity
                      key={sugar}
                      style={[
                        styles.choiceChip,
                        selectedSugar === sugar && styles.choiceChipActive,
                      ]}
                      onPress={() => setSelectedSugar(sugar)}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          selectedSugar === sugar && styles.choiceChipTextActive,
                        ]}
                      >
                        {sugar}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Ice Level */}
              <View style={styles.optionSection}>
                <Text style={styles.optionSectionTitle}>Lượng đá</Text>
                <View style={styles.optionsRow}>
                  {ICE_OPTIONS.map((ice) => (
                    <TouchableOpacity
                      key={ice}
                      style={[
                        styles.choiceChip,
                        selectedIce === ice && styles.choiceChipActive,
                      ]}
                      onPress={() => setSelectedIce(ice)}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          selectedIce === ice && styles.choiceChipTextActive,
                        ]}
                      >
                        {ice}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Toppings Checklist */}
              {toppings.length > 0 && (
                <View style={styles.optionSection}>
                  <Text style={styles.optionSectionTitle}>Topping thêm</Text>
                  <View style={styles.toppingList}>
                    {toppings.map((top) => {
                      const isChecked = !!selectedToppings[top.id];
                      return (
                        <TouchableOpacity
                          key={top.id}
                          style={[styles.toppingItem, isChecked && styles.toppingItemActive]}
                          onPress={() => toggleTopping(top.id)}
                        >
                          <Text style={[styles.toppingName, isChecked && styles.toppingTextActive]}>
                            {isChecked ? '✓ ' : '+ '}
                            {top.name}
                          </Text>
                          <Text style={[styles.toppingPrice, isChecked && styles.toppingTextActive]}>
                            +{top.price.toLocaleString('vi-VN')} đ
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Staff / Customer Note */}
              <View style={styles.optionSection}>
                <Text style={styles.optionSectionTitle}>Ghi chú cho bếp</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="VD: Không lấy trân châu, ly riêng..."
                  placeholderTextColor="#9ca3af"
                  value={itemNote}
                  onChangeText={setItemNote}
                />
              </View>
            </ScrollView>

            {/* Customizer Footer */}
            <View style={styles.customizerFooter}>
              <View style={styles.qtyControlRow}>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setItemQty((q) => Math.max(1, q - 1))}
                >
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyDisplay}>{itemQty}</Text>
                <TouchableOpacity
                  style={styles.qtyBtn}
                  onPress={() => setItemQty((q) => q + 1)}
                >
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.addCartSubmitBtn} onPress={handleAddToCart}>
                <Text style={styles.addCartSubmitText}>
                  Thêm vào đơn • {currentItemCalculatedPrice.toLocaleString('vi-VN')} đ
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cart & Checkout Drawer Modal */}
      <Modal visible={isCartVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.cartDrawerContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Hóa đơn tạm tính ({cart.length} món)</Text>
                <Text style={styles.modalBasePrice}>
                  {orderType === 'DineIn'
                    ? `🪑 Tại bàn: ${customTableNumber || tables.find((t) => t.id === selectedTableId)?.name || 'Chưa chọn bàn'}`
                    : '🛍️ Mang về (Takeaway)'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsCartVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Cart Items List */}
            <ScrollView style={styles.cartItemsList}>
              {cart.map((item) => {
                const itemTopTotal = item.toppings.reduce((s, t) => s + t.price * t.qty, 0);
                const itemLineTotal = (item.price + itemTopTotal) * item.qty;

                return (
                  <View key={item.uid} style={styles.cartItemRow}>
                    <View style={styles.cartItemMain}>
                      <Text style={styles.cartItemName}>{item.product_name}</Text>
                      <Text style={styles.cartItemDetail}>
                        Size {item.size_label} • Đường: {item.sugar_level} • Đá: {item.ice_level}
                      </Text>
                      {item.toppings.length > 0 && (
                        <Text style={styles.cartItemToppings}>
                          Topping: {item.toppings.map((t) => t.name).join(', ')}
                        </Text>
                      )}
                      {!!item.note && (
                        <Text style={styles.cartItemNote}>📝 {item.note}</Text>
                      )}
                      <Text style={styles.cartItemPriceText}>
                        {itemLineTotal.toLocaleString('vi-VN')} đ
                      </Text>
                    </View>

                    {/* Quantity Modifier */}
                    <View style={styles.cartItemActions}>
                      <TouchableOpacity
                        style={styles.cartQtyBtn}
                        onPress={() => updateCartItemQty(item.uid, -1)}
                      >
                        <Text style={styles.cartQtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartQtyNum}>{item.qty}</Text>
                      <TouchableOpacity
                        style={styles.cartQtyBtn}
                        onPress={() => updateCartItemQty(item.uid, 1)}
                      >
                        <Text style={styles.cartQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              {/* Hình thức phục vụ & Vị trí chỗ ngồi / Khách hàng */}
              <View style={styles.customerInfoBox}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.customerInfoTitle}>Hình thức phục vụ & Vị trí</Text>
                  <View style={[styles.diningBadge, orderType === 'Takeaway' && styles.diningBadgeTakeaway]}>
                    <Text style={[styles.diningBadgeText, orderType === 'Takeaway' && styles.diningBadgeTextTakeaway]}>
                      {orderType === 'DineIn'
                        ? `🪑 ${customTableNumber || tables.find((t) => t.id === selectedTableId)?.name || 'Chưa chọn bàn'}`
                        : '🛍️ Mang đi'}
                    </Text>
                  </View>
                </View>

                {/* Quick Toggle: Dùng tại bàn vs Mang đi */}
                <View style={styles.diningTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.diningTypeChip,
                      orderType === 'DineIn' && styles.diningTypeChipActive,
                    ]}
                    onPress={() => {
                      setOrderType('DineIn');
                      if (customerName === 'Khách Mang Về') setCustomerName('Khách Tại Quầy');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.diningTypeText,
                        orderType === 'DineIn' && styles.diningTypeTextActive,
                      ]}
                    >
                      🪑 Dùng tại bàn
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.diningTypeChip,
                      orderType === 'Takeaway' && styles.diningTypeChipActive,
                    ]}
                    onPress={() => {
                      setOrderType('Takeaway');
                      setSelectedTableId(null);
                      setCustomTableNumber('');
                      setCustomerName('Khách Mang Về');
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.diningTypeText,
                        orderType === 'Takeaway' && styles.diningTypeTextActive,
                      ]}
                    >
                      🛍️ Mang đi (Takeaway)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* If DineIn: Table Dropdown Selector */}
                {orderType === 'DineIn' && (
                  <View style={styles.tableSelectorContainer}>
                    <Text style={styles.tableSectionSubtitle}>Vị trí chỗ ngồi / Số bàn:</Text>
                    <TouchableOpacity
                      style={[
                        styles.tableDrawerDropdown,
                        (selectedTableId || customTableNumber) && styles.tableDrawerDropdownActive,
                      ]}
                      onPress={() => setIsTablePickerOpen(true)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownLeft}>
                        <Text style={styles.dropdownIcon}>🪑</Text>
                        <Text
                          style={[
                            styles.tableDrawerDropdownText,
                            (selectedTableId || customTableNumber) && styles.tableDrawerDropdownTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {customTableNumber || tables.find((t) => t.id === selectedTableId)?.name || 'Chạm để chọn số bàn từ danh sách...'}
                        </Text>
                      </View>
                      <ChevronDown size={18} color={selectedTableId || customTableNumber ? '#ea580c' : '#6b7280'} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Customer info — Phone Lookup */}
                <View style={styles.customerLookupBox}>
                  <View style={styles.customerLookupHeader}>
                    <Text style={styles.customerLookupTitle}>👤 Thông tin khách hàng</Text>
                    {customerLookupState !== 'idle' && (
                      <TouchableOpacity onPress={resetCustomerLookup} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.customerLookupReset}>Đổi</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Phone input row */}
                  {(customerLookupState === 'idle' || customerLookupState === 'searching') && (
                    <View style={styles.customerPhoneRow}>
                      <View style={styles.customerPhoneInputWrap}>
                        <Text style={styles.customerPhoneFlag}>📱</Text>
                        <TextInput
                          style={styles.customerPhoneInput}
                          placeholder="Nhập số điện thoại khách..."
                          placeholderTextColor="#9ca3af"
                          keyboardType="phone-pad"
                          value={customerPhoneInput}
                          onChangeText={setCustomerPhoneInput}
                          maxLength={11}
                        />
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.customerLookupBtn,
                          (customerPhoneInput.replace(/\D/g,'').length < 9 || customerLookupState === 'searching') && styles.customerLookupBtnDisabled,
                        ]}
                        onPress={() => handleCustomerLookup(customerPhoneInput)}
                        disabled={customerPhoneInput.replace(/\D/g,'').length < 9 || customerLookupState === 'searching'}
                        activeOpacity={0.8}
                      >
                        {customerLookupState === 'searching' ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.customerLookupBtnText}>Tra cứu</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Found: Regular customer */}
                  {customerLookupState === 'found_regular' && (
                    <View style={[styles.customerResultCard, { borderColor: '#a855f7', backgroundColor: '#faf5ff' }]}>
                      <View style={styles.customerResultLeft}>
                        <Text style={styles.customerResultIcon}>⭐</Text>
                        <View>
                          <Text style={[styles.customerResultName, { color: '#7e22ce' }]}>Khách Quen</Text>
                          <Text style={styles.customerResultPhone}>📱 {customerPhone}</Text>
                        </View>
                      </View>
                      <View style={[styles.customerResultBadge, { backgroundColor: '#a855f7' }]}>
                        <Text style={styles.customerResultBadgeText}>Quen</Text>
                      </View>
                    </View>
                  )}

                  {/* Found: VIP customer */}
                  {customerLookupState === 'found_vip' && (
                    <View style={[styles.customerResultCard, { borderColor: '#eab308', backgroundColor: '#fefce8' }]}>
                      <View style={styles.customerResultLeft}>
                        <Text style={styles.customerResultIcon}>👑</Text>
                        <View>
                          <Text style={[styles.customerResultName, { color: '#a16207' }]}>Khách VIP</Text>
                          <Text style={styles.customerResultPhone}>📱 {customerPhone}</Text>
                        </View>
                      </View>
                      <View style={[styles.customerResultBadge, { backgroundColor: '#eab308' }]}>
                        <Text style={styles.customerResultBadgeText}>VIP</Text>
                      </View>
                    </View>
                  )}

                  {/* Not found */}
                  {customerLookupState === 'not_found' && customerLookupState !== 'new_form' && (
                    <View style={styles.customerNotFoundBox}>
                      <Text style={styles.customerNotFoundText}>
                        Không tìm thấy SĐT <Text style={{ fontWeight: '700' }}>{customerPhone}</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.customerNewBtn}
                        onPress={() => setCustomerLookupState('new_form')}
                        activeOpacity={0.8}
                      >
                        <Plus size={14} color="#fff" strokeWidth={2.5} />
                        <Text style={styles.customerNewBtnText}>Tạo khách mới</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* New customer form */}
                  {customerLookupState === 'new_form' && (
                    <View style={styles.customerNewForm}>
                      <Text style={styles.customerNewFormLabel}>Tên khách hàng mới:</Text>
                      <TextInput
                        style={styles.customerNewFormInput}
                        placeholder="Nhập tên (VD: Anh Minh, Chị Lan...)"
                        placeholderTextColor="#9ca3af"
                        value={newCustomerName}
                        onChangeText={setNewCustomerName}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[styles.customerNewConfirmBtn, !newCustomerName.trim() && { opacity: 0.5 }]}
                        disabled={!newCustomerName.trim()}
                        onPress={() => {
                          setCustomerName(newCustomerName.trim());
                          setCustomerPhone(customerPhone);
                          setCustomerLookupState('found_regular');
                        }}
                        activeOpacity={0.8}
                      >
                        <Check size={14} color="#fff" strokeWidth={3} />
                        <Text style={styles.customerNewConfirmText}>Xác nhận tạo mới</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Skip / Walk-in shortcut */}
                  {customerLookupState === 'idle' && (
                    <TouchableOpacity
                      style={styles.customerWalkinRow}
                      onPress={() => {
                        setCustomerName(orderType === 'DineIn' ? 'Khách Vãng Lai' : 'Khách Mang Về');
                        setCustomerPhone('');
                        setCustomerLookupState('found_regular');
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.customerWalkinText}>
                        Bỏ qua · Khách vãng lai (không cần tra cứu)
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>


              {/* Payment Method Selector */}
              <View style={styles.paymentMethodSection}>
                <Text style={styles.customerInfoTitle}>Phương thức thanh toán</Text>
                <View style={styles.paymentMethodRow}>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodChip,
                      paymentMethod === 'COD' && styles.paymentMethodChipActive,
                    ]}
                    onPress={() => setPaymentMethod('COD')}
                  >
                    <Text
                      style={[
                        styles.paymentMethodText,
                        paymentMethod === 'COD' && styles.paymentMethodTextActive,
                      ]}
                    >
                      💵 Tiền mặt
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.paymentMethodChip,
                      paymentMethod === 'QR' && styles.paymentMethodChipActive,
                    ]}
                    onPress={() => setPaymentMethod('QR')}
                  >
                    <Text
                      style={[
                        styles.paymentMethodText,
                        paymentMethod === 'QR' && styles.paymentMethodTextActive,
                      ]}
                    >
                      📱 VietQR Chuyển khoản
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Tiền mặt thu ngân & Tiền thối (Khi chọn Tiền mặt) */}
              {paymentMethod === 'COD' && (
                <View style={styles.cashBox}>
                  <View style={styles.cashHeader}>
                    <Banknote size={15} color="#ea580c" />
                    <Text style={styles.cashTitle}>Tiền mặt thu ngân & Tiền thối lại</Text>
                  </View>

                  {/* Quick cash denomination chips */}
                  <View style={styles.quickCashRow}>
                    <TouchableOpacity
                      style={[
                        styles.quickCashChip,
                        cashReceivedNum === totalCartAmount && styles.quickCashChipActive,
                      ]}
                      onPress={() => setCashReceived(String(totalCartAmount))}
                    >
                      <Text
                        style={[
                          styles.quickCashText,
                          cashReceivedNum === totalCartAmount && styles.quickCashTextActive,
                        ]}
                      >
                        Đủ tiền ({totalCartAmount.toLocaleString('vi-VN')} đ)
                      </Text>
                    </TouchableOpacity>
                    {[50000, 100000, 200000, 500000]
                      .filter((val) => val >= totalCartAmount || val === 500000)
                      .slice(0, 3)
                      .map((amt) => (
                        <TouchableOpacity
                          key={amt}
                          style={[
                            styles.quickCashChip,
                            cashReceivedNum === amt && styles.quickCashChipActive,
                          ]}
                          onPress={() => setCashReceived(String(amt))}
                        >
                          <Text
                            style={[
                              styles.quickCashText,
                              cashReceivedNum === amt && styles.quickCashTextActive,
                            ]}
                          >
                            {amt.toLocaleString('vi-VN')} đ
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>

                  {/* Cash input */}
                  <View style={styles.cashInputRow}>
                    <Text style={styles.cashInputLabel}>Khách đưa:</Text>
                    <TextInput
                      style={styles.cashInput}
                      placeholder={totalCartAmount > 0 ? `${totalCartAmount.toLocaleString('vi-VN')}` : '0'}
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      value={cashReceived}
                      onChangeText={setCashReceived}
                    />
                    <Text style={styles.cashCurrency}>đ</Text>
                  </View>

                  {/* Change due result */}
                  <View style={styles.changeDueRow}>
                    <Text style={styles.changeDueLabel}>Tiền thừa thối khách:</Text>
                    <Text
                      style={[
                        styles.changeDueValue,
                        cashReceivedNum >= totalCartAmount && cashReceivedNum > 0
                          ? styles.changeDueSuccess
                          : styles.changeDueNotice,
                      ]}
                    >
                      {cashReceivedNum === 0
                        ? '0 đ (Chờ nhận tiền)'
                        : cashReceivedNum >= totalCartAmount
                        ? `${changeDue.toLocaleString('vi-VN')} đ`
                        : `Còn thiếu ${(totalCartAmount - cashReceivedNum).toLocaleString('vi-VN')} đ`}
                    </Text>
                  </View>
                </View>
              )}

              {/* VietQR Information Box (Khi chọn VietQR) */}
              {paymentMethod === 'QR' && (
                <View style={styles.vietQrBox}>
                  <View style={styles.vietQrHeader}>
                    <QrCode size={16} color="#ea580c" />
                    <Text style={styles.vietQrTitle}>Thanh toán VietQR Napas247</Text>
                  </View>
                  <View style={styles.vietQrDetails}>
                    <View style={styles.vietQrRow}>
                      <Text style={styles.vietQrLabel}>Ngân hàng thụ hưởng:</Text>
                      <Text style={styles.vietQrVal}>MBBank (Quân Đội)</Text>
                    </View>
                    <View style={styles.vietQrRow}>
                      <Text style={styles.vietQrLabel}>Số tài khoản quán:</Text>
                      <Text style={styles.vietQrValBold}>0901 234 567</Text>
                    </View>
                    <View style={styles.vietQrRow}>
                      <Text style={styles.vietQrLabel}>Tên chủ tài khoản:</Text>
                      <Text style={styles.vietQrVal}>CONG TY TNHH TEA PLUS</Text>
                    </View>
                    <View style={styles.vietQrRow}>
                      <Text style={styles.vietQrLabel}>Số tiền tự động:</Text>
                      <Text style={[styles.vietQrValBold, { color: '#ea580c' }]}>
                        {totalCartAmount.toLocaleString('vi-VN')} đ
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.vietQrHint}>
                    💡 Mã QR động kèm sẵn số tiền và mã đơn sẽ hiển thị ngay khi bấm Tạo Đơn & Gửi Bếp bên dưới.
                  </Text>
                </View>
              )}

              {/* Ghi chú đơn hàng cho Bếp */}
              <View style={styles.orderNoteBox}>
                <Text style={styles.customerInfoTitle}>Ghi chú đơn cho Bếp KDS</Text>
                <TextInput
                  style={styles.orderNoteInput}
                  placeholder="VD: Khách cần gấp mang về, đá để riêng, ly tách..."
                  placeholderTextColor="#9ca3af"
                  value={posOrderNote}
                  onChangeText={setPosOrderNote}
                />
              </View>

              {/* Packaging / Đóng gói — chỉ hiển thị khi Mang về */}
              {orderType === 'Takeaway' && (
                <View style={styles.packagingBox}>
                  <View style={styles.packagingHeader}>
                    <Text style={styles.packagingTitle}>📦 Đóng gói mang đi</Text>
                    <Text style={styles.packagingSubtitle}>Chọn cách đóng gói phù hợp cho khách</Text>
                  </View>
                  <View style={styles.packagingGrid}>
                    {[
                      { key: 'none',       icon: '🚫', label: 'Không cần',   desc: 'Khách tự mang' },
                      { key: 'bag',        icon: '🛍️', label: 'Túi giấy',    desc: 'Túi kraft thương hiệu' },
                      { key: 'box',        icon: '📦', label: 'Hộp cứng',    desc: 'Hộp bảo ôn cao cấp' },
                      { key: 'cup_holder', icon: '🥤', label: 'Giá ly',      desc: 'Giá giữ cốc đứng' },
                    ].map((opt) => {
                      const isActive = packagingOption === opt.key;
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.packagingCard, isActive && styles.packagingCardActive]}
                          onPress={() => setPackagingOption(opt.key as any)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.packagingCardIcon}>{opt.icon}</Text>
                          <Text style={[styles.packagingCardLabel, isActive && styles.packagingCardLabelActive]}>
                            {opt.label}
                          </Text>
                          <Text style={styles.packagingCardDesc} numberOfLines={2}>
                            {opt.desc}
                          </Text>
                          {isActive && (
                            <View style={styles.packagingCheckBadge}>
                              <Check size={10} color="#fff" strokeWidth={3} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Bảng kê chi tiết đơn hàng */}
              <View style={styles.billBreakdownBox}>
                <View style={styles.billBreakdownHeader}>
                  <Receipt size={15} color="#ea580c" />
                  <Text style={styles.billBreakdownTitle}>Bảng kê chi tiết hóa đơn</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Tạm tính ({totalCartItemsCount} món nước):</Text>
                  <Text style={styles.breakdownVal}>{totalCartAmount.toLocaleString('vi-VN')} đ</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Ưu đãi / Giảm giá:</Text>
                  <Text style={[styles.breakdownVal, { color: '#16a34a' }]}>- 0 đ</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Thuế VAT & Phí dịch vụ:</Text>
                  <Text style={styles.breakdownVal}>0 đ (Đã bao gồm)</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownMetaRow}>
                  <Text style={styles.breakdownMetaText}>
                    👤 Thu ngân: {user?.fullname || 'Nhân viên trực'}
                  </Text>
                  <Text style={styles.breakdownMetaText}>
                    📍 {stores.find((s) => s.id === selectedStoreId)?.name || user?.branch_name || 'Chi nhánh'}
                  </Text>
                </View>
              </View>

              {/* Banner điều phối thời gian thực */}
              <View style={styles.realtimeKdsNotice}>
                <Sparkles size={14} color="#ea580c" />
                <Text style={styles.realtimeKdsText}>
                  Đơn hàng sau khi tạo sẽ được bắn tức thì tới màn hình Bếp KDS để pha chế.
                </Text>
              </View>
            </ScrollView>

            {/* Cart Drawer Footer */}
            <View style={styles.cartDrawerFooter}>
              <View style={styles.cartSummaryRow}>
                <Text style={styles.cartSummaryLabel}>Tổng cộng thanh toán:</Text>
                <Text style={styles.cartSummaryValue}>
                  {totalCartAmount.toLocaleString('vi-VN')} đ
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.checkoutConfirmBtn, isSubmitting && { opacity: 0.7 }]}
                onPress={handleCheckout}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.checkoutConfirmBtnText}>Tạo Đơn & Gửi Bếp</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Checkout QR Code Modal */}
      <Modal visible={!!checkoutQrModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContainer}>
            <Text style={styles.qrModalTitle}>Quét mã VietQR</Text>
            <Text style={styles.qrModalSubtitle}>
              Mã đơn: {checkoutQrModal?.orderCode}
            </Text>

            {checkoutQrModal?.qrUrl ? (
              <Image
                source={{ uri: checkoutQrModal.qrUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : null}

            <Text style={styles.qrModalInstruction}>
              Hướng dẫn khách hàng quét mã để thanh toán. Đơn đã được chuyển vào Bếp KDS.
            </Text>

            <TouchableOpacity
              style={styles.qrModalCloseBtn}
              onPress={() => setCheckoutQrModal(null)}
            >
              <Text style={styles.qrModalCloseText}>Hoàn tất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '600',
    marginTop: 2,
  },
  storeBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  storeBadgeText: {
    fontSize: 12,
    color: '#c2410c',
    fontWeight: '600',
  },
  topCartBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  topCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f97316',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  topControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  orderTypeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    flexShrink: 0,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleBtnTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  tableScrollView: {
    flex: 1,
  },
  tablePill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  tablePillActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  tablePillText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  tablePillTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  categoryRow: {
    backgroundColor: '#ffffff',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  catPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  catPillActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  catPillTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  productScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 110,
    backgroundColor: '#fff7ed',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productPlaceholderImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeBestSeller: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#f97316',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cardBadgeBestSellerText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    minHeight: 34,
    lineHeight: 17,
  },
  productBaseTea: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ea580c',
  },
  addIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  emptyProducts: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  floatingBar: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  floatingBarBtn: {
    backgroundColor: '#f97316',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartCountBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cartCountText: {
    color: '#ea580c',
    fontWeight: '700',
    fontSize: 13,
  },
  floatingBarInfo: {
    flex: 1,
  },
  floatingBarLabel: {
    color: '#ffedd5',
    fontSize: 11,
    fontWeight: '500',
  },
  floatingBarTotal: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  floatingBarAction: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  floatingBarActionText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  customizerContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalBasePrice: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '700',
  },
  customizerBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  optionSection: {
    marginBottom: 16,
  },
  optionSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  choiceChipActive: {
    backgroundColor: '#f97316',
  },
  choiceChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  choiceChipTextActive: {
    color: '#ffffff',
  },
  toppingList: {
    gap: 6,
  },
  toppingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  toppingItemActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  toppingName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  toppingPrice: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  toppingTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  customizerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  qtyControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 2,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  qtyDisplay: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 10,
    color: '#111827',
  },
  addCartSubmitBtn: {
    flex: 1,
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addCartSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  cartDrawerContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    height: '90%',
  },
  cartItemsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  cartItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  cartItemMain: {
    flex: 1,
    paddingRight: 10,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cartItemDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  cartItemToppings: {
    fontSize: 11,
    color: '#ea580c',
    marginTop: 2,
  },
  cartItemNote: {
    fontSize: 11,
    color: '#b45309',
    fontStyle: 'italic',
    marginTop: 2,
  },
  cartItemPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  cartQtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartQtyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  cartQtyNum: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 6,
    color: '#111827',
  },
  customerInfoBox: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  customerInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  diningBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  diningBadgeTakeaway: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  diningBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
  diningBadgeTextTakeaway: {
    color: '#16a34a',
  },
  diningTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  diningTypeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diningTypeChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ea580c',
  },
  diningTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  diningTypeTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  tableSelectorContainer: {
    backgroundColor: '#fffaf5',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 6,
  },
  tableSectionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 6,
  },
  tableScrollHorizontal: {
    marginBottom: 8,
  },
  tableQuickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 6,
  },
  tableQuickChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  tableQuickChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  tableQuickChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  customSeatInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#111827',
  },
  customerInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  customerInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#111827',
  },
  customerTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  customerTagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  customerTagChipActive: {
    backgroundColor: '#ffedd5',
  },
  customerTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4b5563',
  },
  customerTagTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  paymentMethodSection: {
    marginTop: 14,
    marginBottom: 24,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentMethodChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  paymentMethodChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  paymentMethodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4b5563',
  },
  paymentMethodTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  cashBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  cashHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cashTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9a3412',
  },
  quickCashRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  quickCashChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickCashChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#ea580c',
  },
  quickCashText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickCashTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cashInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  cashInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 6,
  },
  cashInput: {
    flex: 1,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  cashCurrency: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  changeDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#fed7aa',
  },
  changeDueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  changeDueValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  changeDueSuccess: {
    color: '#16a34a',
  },
  changeDueNotice: {
    color: '#ea580c',
  },
  vietQrBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  vietQrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  vietQrTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
  },
  vietQrDetails: {
    gap: 4,
    marginBottom: 8,
  },
  vietQrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vietQrLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  vietQrVal: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
  },
  vietQrValBold: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800',
  },
  vietQrHint: {
    fontSize: 11,
    color: '#b45309',
    fontStyle: 'italic',
    lineHeight: 15,
  },
  orderNoteBox: {
    marginBottom: 14,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  orderNoteInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#111827',
    marginTop: 6,
  },
  billBreakdownBox: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    marginBottom: 14,
  },
  billBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  billBreakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  breakdownVal: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '700',
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  breakdownMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownMetaText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
  },
  realtimeKdsNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 16,
  },
  realtimeKdsText: {
    fontSize: 11,
    color: '#ea580c',
    flex: 1,
    fontWeight: '500',
    lineHeight: 15,
  },
  cartDrawerFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartSummaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
  },
  cartSummaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ea580c',
  },
  checkoutConfirmBtn: {
    backgroundColor: '#f97316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkoutConfirmBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  qrModalContainer: {
    backgroundColor: '#ffffff',
    margin: 24,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  qrModalSubtitle: {
    fontSize: 14,
    color: '#ea580c',
    fontWeight: '600',
    marginVertical: 6,
  },
  qrImage: {
    width: 220,
    height: 220,
    marginVertical: 14,
  },
  qrModalInstruction: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 18,
  },
  qrModalCloseBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 8,
  },
  qrModalCloseText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Table Picker Dropdown ──────────────────────────────────────
  tableDropdownTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  tableDropdownTriggerActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  dropdownIcon: { fontSize: 15 },
  dropdownText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  dropdownTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  takeawayBadgeRow: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  takeawayBadgeRowText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  tableDrawerDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tableDrawerDropdownActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  tableDrawerDropdownText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  tableDrawerDropdownTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },

  // ── Table Picker Modal ─────────────────────────────────────────
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  pickerModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    maxHeight: '82%',
    overflow: 'hidden',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  pickerModalSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  pickerFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  pickerFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  pickerFilterChipActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  pickerFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  pickerFilterTextActive: {
    color: '#ea580c',
    fontWeight: '700',
  },
  pickerTableList: { maxHeight: 280 },
  pickerTableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 8,
  },
  pickerTableCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  pickerTableCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  pickerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  pickerTableIcon: { fontSize: 18 },
  pickerTableName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 2,
  },
  pickerTableNameActive: { color: '#ea580c' },
  pickerEmptyBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  pickerEmptyText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  pickerFooter: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  customSeatRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  customSeatModalInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  customSeatSaveBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  customSeatSaveText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  pickerDeselectBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pickerDeselectText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },

  // ── Customer Select Cards ──────────────────────────────────────
  customerSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  customerSelectCard: {
    width: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
  },
  customerSelectIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  customerSelectLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
  },
  customerSelectCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Packaging / Đóng gói ──────────────────────────────────────
  packagingBox: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginBottom: 12,
    overflow: 'hidden',
  },
  packagingHeader: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  packagingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ea580c',
  },
  packagingSubtitle: {
    fontSize: 11,
    color: '#9a3412',
    marginTop: 1,
  },
  packagingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  packagingCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
  },
  packagingCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#f97316',
  },
  packagingCardIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  packagingCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  packagingCardLabelActive: {
    color: '#ea580c',
  },
  packagingCardDesc: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 2,
  },
  packagingCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Customer Phone Lookup ─────────────────────────────────────
  customerLookupBox: {
    backgroundColor: '#fafafa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    marginTop: 10,
    overflow: 'hidden',
  },
  customerLookupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  customerLookupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
  },
  customerLookupReset: {
    fontSize: 12,
    color: '#ea580c',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  customerPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  customerPhoneInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  customerPhoneFlag: { fontSize: 16 },
  customerPhoneInput: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  customerLookupBtn: {
    backgroundColor: '#f97316',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerLookupBtnDisabled: {
    backgroundColor: '#d1d5db',
  },
  customerLookupBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  customerResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    margin: 10,
    marginTop: 4,
  },
  customerResultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customerResultIcon: { fontSize: 24 },
  customerResultName: {
    fontSize: 14,
    fontWeight: '700',
  },
  customerResultPhone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  customerResultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  customerResultBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  customerNotFoundBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    padding: 10,
    margin: 10,
    marginTop: 4,
    gap: 8,
  },
  customerNotFoundText: {
    fontSize: 12,
    color: '#b91c1c',
    flex: 1,
  },
  customerNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  customerNewBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  customerNewForm: {
    padding: 12,
    gap: 8,
  },
  customerNewFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  customerNewFormInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  customerNewConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  customerNewConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  customerWalkinRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignItems: 'center',
  },
  customerWalkinText: {
    fontSize: 11,
    color: '#94a3b8',
    textDecorationLine: 'underline',
  },
});
