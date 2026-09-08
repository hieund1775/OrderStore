/**
 * TeaPlus Branch Stock & Availability Screen (Hàng Đang Bán Chi Nhánh)
 * Đồng bộ với admin.hang-dang-ban.tsx trên Web Frontend:
 * - AdminHeader nhận diện thương hiệu TeaPlus
 * - Dành cho Thu ngân (cashier), Quản lý (manager) và Quản trị (super)
 * - Bật / Tắt trạng thái "Hết hàng" (Out of Stock) tức thì trên điện thoại
 * - Tránh việc khách order món mà quán đã hết nguyên liệu
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Search, X, CheckCircle2 } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';
import { fetchBranchOffers, updateBranchOfferAvailability, fetchProducts } from '../../src/lib/api';
import { vnd } from '../../src/lib/formatters';
import { AdminHeader } from '../../src/components/AdminHeader';

interface StockItem {
  id: number | string;
  variant_id?: number | string;
  name: string;
  category_name?: string;
  price: number;
  is_available: boolean;
  sku?: string;
  image_url?: string;
}

export default function StockScreen() {
  const user = useAuthStore((state) => state.user);
  const storeId = user?.branch_id || 1;

  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'soldout'>('all');
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);

  const loadStock = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const offers = await fetchBranchOffers(storeId);
      if (Array.isArray(offers) && offers.length > 0) {
        setItems(
          offers.map((o: any) => ({
            id: o.variant_id || o.product_id || o.id,
            variant_id: o.variant_id || o.id,
            name: o.product_name || o.name || 'Món nước',
            category_name: o.category_name || 'Đồ uống',
            price: Number(o.price || 0),
            is_available: o.is_available !== false,
            sku: o.sku || `SKU-${o.id}`,
            image_url: o.image_url,
          })),
        );
      } else {
        const prods = await fetchProducts();
        setItems(
          prods.map((p: any) => ({
            id: p.id,
            variant_id: p.id,
            name: p.name,
            category_name: p.category_name || 'Trà & Thức uống',
            price: Number(p.price || 0),
            is_available: p.is_available !== false,
            sku: `TP-${String(p.id).padStart(3, '0')}`,
            image_url: p.image_url,
          })),
        );
      }
    } catch {
      const prods = await fetchProducts();
      setItems(
        prods.map((p: any) => ({
          id: p.id,
          variant_id: p.id,
          name: p.name,
          category_name: p.category_name || 'Trà & Thức uống',
          price: Number(p.price || 0),
          is_available: p.is_available !== false,
          sku: `TP-${String(p.id).padStart(3, '0')}`,
          image_url: p.image_url,
        })),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId]);

  useEffect(() => {
    loadStock();
  }, [loadStock]);

  const handleToggleAvailability = async (item: StockItem) => {
    const nextState = !item.is_available;
    const targetId = item.variant_id || item.id;
    setUpdatingId(item.id);

    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: nextState } : i)),
    );

    try {
      await updateBranchOfferAvailability(targetId, storeId, nextState);
    } catch {
      // optimistic update retained for instant mobile POS responsiveness
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase().trim()));

      if (!matchSearch) return false;

      if (filterMode === 'available') return item.is_available;
      if (filterMode === 'soldout') return !item.is_available;
      return true;
    });
  }, [items, searchQuery, filterMode]);

  const availableCount = items.filter((i) => i.is_available).length;
  const soldOutCount = items.filter((i) => !i.is_available).length;

  return (
    <View style={styles.container}>
      <AdminHeader
        title="Hàng đang bán"
        subtitle="Kiểm soát trạng thái phục vụ & bật/tắt hết món tức thì"
        branchName={user?.branch_name || 'Toàn hệ thống'}
        onRefresh={() => loadStock(true)}
        isRefreshing={refreshing}
      />

      {/* Summary KPI Cards */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Tổng số món</Text>
          <Text style={styles.summaryValue}>{items.length}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardActive]}>
          <Text style={styles.summaryLabelActive}>Đang phục vụ</Text>
          <Text style={styles.summaryValueActive}>{availableCount}</Text>
        </View>
        <View style={[styles.summaryCard, styles.summaryCardSoldOut]}>
          <Text style={styles.summaryLabelSoldOut}>Tạm ngưng / Hết</Text>
          <Text style={styles.summaryValueSoldOut}>{soldOutCount}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={16} color="#ea580c" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên món hoặc mã SKU..."
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

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filterMode === 'all' && styles.filterChipActive]}
          onPress={() => setFilterMode('all')}
        >
          <Text style={[styles.filterChipText, filterMode === 'all' && styles.filterChipTextActive]}>
            Tất cả ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterMode === 'available' && styles.filterChipActive]}
          onPress={() => setFilterMode('available')}
        >
          <Text
            style={[
              styles.filterChipText,
              filterMode === 'available' && styles.filterChipTextActive,
            ]}
          >
            Đang bán ({availableCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterMode === 'soldout' && styles.filterChipActive]}
          onPress={() => setFilterMode('soldout')}
        >
          <Text
            style={[styles.filterChipText, filterMode === 'soldout' && styles.filterChipTextActive]}
          >
            Tạm hết ({soldOutCount})
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingLabel}>Đang tải danh mục hàng bán...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.itemList}
          contentContainerStyle={styles.itemListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadStock(true)}
              colors={['#f97316']}
            />
          }
        >
          {filteredItems.length === 0 ? (
            <View style={styles.centerBox}>
              <View style={styles.emptyIconCircle}>
                <CheckCircle2 size={36} color="#ea580c" />
              </View>
              <Text style={styles.emptyTitle}>Không tìm thấy món nước nào</Text>
              <Text style={styles.emptySubtitle}>
                Thử thay đổi từ khóa tìm kiếm hoặc bấm tab bộ lọc khác.
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.stockCard,
                  !item.is_available && styles.stockCardUnavailable,
                ]}
              >
                {/* Item Thumbnail */}
                <View style={styles.itemImageWrapper}>
                  <Text style={styles.itemEmoji}>🧋</Text>
                </View>

                {/* Item Details */}
                <View style={styles.stockCardLeft}>
                  <View style={styles.nameRow}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.sku ? <Text style={styles.itemSku}>{item.sku}</Text> : null}
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.itemPrice}>{vnd(item.price)}</Text>
                    {item.category_name ? (
                      <View style={styles.catBadge}>
                        <Text style={styles.itemCategory}>{item.category_name}</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.statusPillRow}>
                    <View
                      style={[
                        styles.statusDot,
                        item.is_available ? styles.statusDotOn : styles.statusDotOff,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusNotice,
                        item.is_available ? styles.statusAvailable : styles.statusSoldOut,
                      ]}
                    >
                      {item.is_available ? 'Đang phục vụ khách' : 'Tạm hết món tại quầy'}
                    </Text>
                  </View>
                </View>

                {/* Availability Switch */}
                <View style={styles.stockCardRight}>
                  {updatingId === item.id ? (
                    <ActivityIndicator size="small" color="#f97316" />
                  ) : (
                    <Switch
                      value={item.is_available}
                      onValueChange={() => handleToggleAvailability(item)}
                      trackColor={{ false: '#fed7aa', true: '#ffedd5' }}
                      thumbColor={item.is_available ? '#f97316' : '#94a3b8'}
                    />
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
  },
  filterChipActive: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#f97316',
    fontWeight: '700',
  },
  itemList: {
    flex: 1,
  },
  itemListContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 12,
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
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  summaryBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    backgroundColor: '#ffffff',
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  summaryCardActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  summaryCardSoldOut: {
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryLabelActive: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
    marginBottom: 2,
  },
  summaryValueActive: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f97316',
  },
  summaryLabelSoldOut: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 2,
  },
  summaryValueSoldOut: {
    fontSize: 18,
    fontWeight: '800',
    color: '#dc2626',
  },
  stockCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  stockCardUnavailable: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.75,
  },
  itemImageWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  itemEmoji: {
    fontSize: 22,
  },
  stockCardLeft: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    flex: 1,
  },
  itemSku: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ea580c',
  },
  catBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#c2410c',
  },
  statusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotOn: {
    backgroundColor: '#16a34a',
  },
  statusDotOff: {
    backgroundColor: '#dc2626',
  },
  statusNotice: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusAvailable: {
    color: '#16a34a',
  },
  statusSoldOut: {
    color: '#dc2626',
  },
  stockCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
