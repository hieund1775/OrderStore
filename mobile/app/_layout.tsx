import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/store/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
});

export default function RootLayout() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="cart"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Giỏ hàng của bạn',
              headerTintColor: '#ea580c',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="checkout"
            options={{
              headerShown: true,
              title: 'Thanh toán đơn hàng',
              headerTintColor: '#ea580c',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="tracking/[code]"
            options={{
              headerShown: true,
              title: 'Theo dõi tiến trình đơn',
              headerTintColor: '#ea580c',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
