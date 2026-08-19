import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Product } from '../types';
import { vnd } from '../lib/formatters';

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const isBestSeller = product.tags?.includes('best-seller');
  const isNew = product.tags?.includes('new');

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => onPress(product)}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.image_url || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&q=80' }}
          style={styles.image}
          resizeMode="cover"
        />
        {isBestSeller && (
          <View style={[styles.badge, styles.bestSellerBadge]}>
            <Text style={styles.badgeText}>🔥 Bán chạy</Text>
          </View>
        )}
        {isNew && !isBestSeller && (
          <View style={[styles.badge, styles.newBadge]}>
            <Text style={styles.badgeText}>✨ Mới</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        {product.description ? (
          <Text style={styles.description} numberOfLines={2}>{product.description}</Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.price}>{vnd(product.price)}</Text>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.7}
            onPress={() => onPress(product)}
          >
            <Plus size={18} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 14,
    flexDirection: 'row',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bestSellerBadge: {
    backgroundColor: 'rgba(234, 88, 12, 0.9)',
  },
  newBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.9)',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ea580c',
  },
  addButton: {
    backgroundColor: '#ea580c',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
