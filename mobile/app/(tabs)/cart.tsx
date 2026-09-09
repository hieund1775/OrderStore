import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Cart route redirect - Dành cho Staff, điều hướng sang Quản lý Đơn hàng
 */
export default function CartRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/orders');
  }, [router]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <ActivityIndicator size="large" color="#f97316" />
    </View>
  );
}
