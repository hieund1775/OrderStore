import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Leaf, RefreshCw, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  branchName?: string;
  showBack?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  rightAction?: React.ReactNode;
}

export function AdminHeader({
  title,
  subtitle,
  branchName,
  showBack = false,
  onBack,
  onRefresh,
  isRefreshing = false,
  rightAction,
}: AdminHeaderProps & { onBack?: () => void }) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/profile');
    }
  };

  return (
    <View style={styles.headerContainer}>
      {/* Brand & Back Bar */}
      <View style={styles.topBrandRow}>
        <View style={styles.brandLeft}>
          {showBack ? (
            <TouchableOpacity onPress={handleBack} style={styles.backCircleBtn}>
              <ArrowLeft size={18} color="#ea580c" />
            </TouchableOpacity>
          ) : (
            <View style={styles.logoBadge}>
              <Leaf size={16} color="#ffffff" strokeWidth={2.5} />
            </View>
          )}
          <View style={styles.brandTextGroup}>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>TeaPlus</Text>
              <View style={styles.staffTag}>
                <Text style={styles.staffTagText}>STAFF</Text>
              </View>
            </View>
            {branchName ? (
              <Text style={styles.brandBranch} numberOfLines={1}>
                📍 {branchName}
              </Text>
            ) : (
              <Text style={styles.brandBranch}>Hệ thống vận hành cửa hàng</Text>
            )}
          </View>
        </View>

        {/* Right actions */}
        <View style={styles.brandRight}>
          {onRefresh && (
            <TouchableOpacity
              onPress={onRefresh}
              style={[styles.refreshIconBtn, isRefreshing && { opacity: 0.5 }]}
              disabled={isRefreshing}
            >
              <RefreshCw size={14} color="#ea580c" />
            </TouchableOpacity>
          )}
          {rightAction}
        </View>
      </View>

      {/* Page Title & Desc */}
      <View style={styles.pageTitleSection}>
        <Text style={styles.pageTitle}>{title}</Text>
        {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
  },
  topBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  backCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextGroup: {
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  staffTag: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  staffTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.5,
  },
  brandBranch: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
  brandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitleSection: {
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
    lineHeight: 16,
  },
});
