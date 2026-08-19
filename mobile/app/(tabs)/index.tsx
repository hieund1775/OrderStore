import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ShoppingBag, QrCode, Bike, Gift, Sparkles } from 'lucide-react-native';
import apiClient from '../../src/lib/api';
import { Product, Store } from '../../src/types';
import { ProductCard } from '../../src/components/ProductCard';
import { ProductCustomizerModal } from '../../src/components/ProductCustomizerModal';
import { useCartStore } from '../../src/store/cartStore';

export default function HomeScreen() {
  const router = useRouter();
  const itemCount = useCartStore((state) => state.itemCount());
  const selectedTable = useCartStore((state) => state.selectedTable);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Fetch products
  const { data: products = [], isLoading: loadingProducts, refetch: refetchProducts, isRefetching } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get('/products');
      return data;
    },
  });

  // Fetch stores
  const { data: stores = [] } = useQuery<Store[]>({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data } = await apiClient.get('/stores');
      return data;
    },
  });

  const activeStore = stores[0] || { name: 'TeaPlus - Quận 1', address: '123 Lê Lợi, Q.1' };
  const bestSellers = products.filter((p) => p.tags?.includes('best-seller')).slice(0, 4);
  const newProducts = products.filter((p) => p.tags?.includes('new')).slice(0, 4);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.storeSelector}>
          <MapPin size={18} color="#ea580c" />
          <View style={styles.storeTextWrap}>
            <Text style={styles.storeLabel}>
              {selectedTable ? `Bàn: ${selectedTable.name}` : 'Chi nhánh'}
            </Text>
            <Text style={styles.storeName} numberOfLines={1}>
              {selectedTable?.store_name || activeStore.name}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push('/cart')}
          activeOpacity={0.8}
        >
          <ShoppingBag size={22} color="#ffffff" />
          {itemCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchProducts} />}
      >
        {/* Banner */}
        <View style={styles.bannerContainer}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&q=80' }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <View style={styles.bannerOverlay}>
            <View style={styles.promoTag}>
              <Sparkles size={12} color="#ffffff" />
              <Text style={styles.promoTagText}>Khuyến Mãi Mới</Text>
            </View>
            <Text style={styles.bannerTitle}>Trà Trái Cây Tươi Mát</Text>
            <Text style={styles.bannerSubtitle}>Giảm 20% cho thành viên mới</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/scan')}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#ffedd5' }]}>
              <QrCode size={22} color="#ea580c" />
            </View>
            <Text style={styles.actionText}>Quét Bàn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/menu')}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#dcfce7' }]}>
              <Bike size={22} color="#16a34a" />
            </View>
            <Text style={styles.actionText}>Giao Tận Nơi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: '#fef3c7' }]}>
              <Gift size={22} color="#d97706" />
            </View>
            <Text style={styles.actionText}>Đổi Thưởng</Text>
          </TouchableOpacity>
        </View>

        {/* Best Sellers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🔥 Bán Chạy Nhất</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/menu')}>
              <Text style={styles.viewAllText}>Xem tất cả</Text>
            </TouchableOpacity>
          </View>

          {loadingProducts ? (
            <ActivityIndicator size="small" color="#ea580c" style={{ marginVertical: 20 }} />
          ) : (
            (bestSellers.length > 0 ? bestSellers : products.slice(0, 4)).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onPress={(p) => setSelectedProduct(p)}
              />
            ))
          )}
        </View>

        {/* New Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ Món Mới Hấp Dẫn</Text>
          </View>

          {(newProducts.length > 0 ? newProducts : products.slice(4, 8)).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={(p) => setSelectedProduct(p)}
            />
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Customizer Modal */}
      <ProductCustomizerModal
        product={selectedProduct}
        visible={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafaf9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  storeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storeTextWrap: {
    marginLeft: 8,
    flex: 1,
  },
  storeLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  cartButton: {
    backgroundColor: '#ea580c',
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    flex: 1,
  },
  bannerContainer: {
    margin: 18,
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
    padding: 16,
    justifyContent: 'flex-end',
  },
  promoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 6,
  },
  promoTagText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  bannerSubtitle: {
    color: '#fed7aa',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    gap: 12,
    marginBottom: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  viewAllText: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '700',
  },
});
