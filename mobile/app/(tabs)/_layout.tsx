import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Coffee, QrCode, ClipboardList, User } from 'lucide-react-native';
import { View, Text, StyleSheet } from 'react-native';
import { useCartStore } from '../../src/store/cartStore';

export default function TabLayout() {
  const itemCount = useCartStore((state) => state.itemCount());

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ea580c',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Thực đơn',
          tabBarIcon: ({ color, size }) => <Coffee color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Quét bàn',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.scanButton}>
              <QrCode color="#ffffff" size={24} strokeWidth={2.2} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Đơn hàng',
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hội viên',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#ea580c',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
});
