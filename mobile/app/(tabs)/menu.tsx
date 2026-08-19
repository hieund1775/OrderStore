import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, ShoppingBag } from 'lucide-react-native';
import apiClient from '../../src/lib/api';
import { Product, Category } from '../../src/types';
import { ProductCard } from '../../src/components/ProductCard';
import { ProductCustomizerModal } from '../../src/components/ProductCustomizerModal';
import { useCartStore } from '../../src/store/cartStore';
import { vnd } from '../../src/lib/formatters';

export default function MenuScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const itemCount = useCartStore((state) => state.itemCount());
  const subtotal = useCartStore((state) => state.subtotal());

  // Fetch Categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get('/categories');
      return data;
    },
  });

  // Fetch Products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await apiClient.get('/products');
      return data;
    },
  });

  const filteredProducts = products.filter((p) => {
    const matchCategory =
      selectedCategory === 'all' ||
      p.category_slug === selectedCategory ||
      String(p.category_id) === selectedCategory;
    const matchSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header & Search */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Thực Đơn TeaPlus</Text>
        <View style={styles.searchBar}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm trà trái cây, topping..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
          <TouchableOpacity
            style={[styles.categoryChip, selectedCategory === 'all' && styles.categoryChipActive]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[styles.categoryChipText, selectedCategory === 'all' && styles.categoryChipTextActive]}>
              ✨ Tất cả ({products.length})
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.slug}
              style={[styles.categoryChip, selectedCategory === cat.slug && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.slug)}
            >
              <Text style={[styles.categoryChipText, selectedCategory === cat.slug && styles.categoryChipTextActive]}>
                {cat.emoji || '🍵'} {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Product List */}
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#ea580c" style={{ marginTop: 40 }} />
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Không tìm thấy món phù hợp</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ProductCard product={item} onPress={(p) => setSelectedProduct(p)} />
            )}
          />
        )}
      </View>

      {/* Floating Cart Button */}
      {itemCount > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            activeOpacity={0.9}
            onPress={() => router.push('/cart')}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{itemCount}</Text>
              </View>
              <Text style={styles.floatingCartTitle}>Xem giỏ hàng</Text>
            </View>
            <Text style={styles.floatingCartTotal}>{vnd(subtotal)}</Text>
          </TouchableOpacity>
        </View>
      )}

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
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2937',
    marginBottom: 10,
  },
  searchBar: {
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
    fontSize: 14,
    color: '#1f2937',
  },
  categoryContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryList: {
    paddingHorizontal: 18,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  categoryChipActive: {
    backgroundColor: '#ea580c',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  productList: {
    padding: 18,
    paddingBottom: 90,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#6b7280',
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: 16,
    left: 18,
    right: 18,
  },
  floatingCartBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cartCountBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 10,
  },
  cartCountText: {
    color: '#ea580c',
    fontWeight: '800',
    fontSize: 13,
  },
  floatingCartTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  floatingCartTotal: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
