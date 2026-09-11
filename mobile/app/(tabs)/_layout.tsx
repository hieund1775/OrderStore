/**
 * TeaPlus Staff Operations Tab Layout
 * 5 Phân hệ Vận hành: Bếp KDS, Đơn hàng, POS Bán hàng, Nhân sự, Cá nhân
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import {
  ChefHat,
  ClipboardList,
  ShoppingCart,
  Package,
  Tag,
  User,
  Users,
  CalendarClock,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const color = focused ? '#f97316' : '#94a3b8';
  const size = 22;
  const strokeWidth = focused ? 2.4 : 1.8;

  switch (name) {
    case 'kds':
      return <ChefHat size={size} color={color} strokeWidth={strokeWidth} />;
    case 'orders':
      return <ClipboardList size={size} color={color} strokeWidth={strokeWidth} />;
    case 'pos':
      return <ShoppingCart size={size} color={color} strokeWidth={strokeWidth} />;
    case 'packing':
      return <Package size={size} color={color} strokeWidth={strokeWidth} />;
    case 'stock':
      return <Tag size={size} color={color} strokeWidth={strokeWidth} />;
    case 'accounts':
      return <Users size={size} color={color} strokeWidth={strokeWidth} />;
    case 'preorders':
      return <CalendarClock size={size} color={color} strokeWidth={strokeWidth} />;
    case 'profile':
      return <User size={size} color={color} strokeWidth={strokeWidth} />;
    default:
      return null;
  }
}

export default function StaffTabLayout() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role || 'cashier';

  // Role permissions per MOBILE_STORE_MANAGEMENT_SPEC.md
  const canViewKds = ['super', 'manager', 'kitchen'].includes(role);
  const canViewPos = ['super', 'manager', 'cashier'].includes(role);
  const canViewPacking = ['super', 'manager', 'packing'].includes(role);
  const canViewStock = ['super', 'manager', 'cashier'].includes(role);
  const canManageAccounts = ['super', 'manager'].includes(role);
  const canOperatePreorders = ['super', 'manager', 'kitchen'].includes(role);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f97316',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bếp KDS',
          href: canViewKds ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="kds" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Đơn hàng',
          tabBarIcon: ({ focused }) => <TabIcon name="orders" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: 'POS Quầy',
          href: canViewPos ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="pos" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="packing"
        options={{
          title: 'Đóng gói',
          href: canViewPacking ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="packing" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="preorders"
        options={{
          title: 'Đặt trước',
          href: canOperatePreorders ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="preorders" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: 'Hàng bán',
          href: canViewStock ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon name="stock" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          href: null,
          tabBarIcon: ({ focused }) => <TabIcon name="accounts" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="accounts/create"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="accounts/[id]"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Cá nhân',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
      {/* Ẩn các route thừa */}
      <Tabs.Screen
        name="menu"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
