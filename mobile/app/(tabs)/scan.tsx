import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { QrCode, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react-native';
import apiClient from '../../src/lib/api';
import { useCartStore } from '../../src/store/cartStore';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resolvedTable, setResolvedTable] = useState<{ name: string; store_name: string } | null>(null);

  const setTable = useCartStore((state) => state.setTable);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || loading) return;
    setIsScanning(false);
    setLoading(true);

    try {
      // Parse table_id from QR code content (can be URL 'https://teaplus.vn/table?table_id=1' or direct number '1')
      let tableId = data;
      if (data.includes('table_id=')) {
        const match = data.match(/table_id=(\d+)/);
        if (match) tableId = match[1];
      }

      const res = await apiClient.get(`/table/resolve?table_id=${tableId}`);
      const table = res.data.table;

      if (table) {
        setTable(table);
        setResolvedTable({
          name: table.name,
          store_name: table.store_name || 'Chi nhánh TeaPlus',
        });
      } else {
        throw new Error('Không tìm thấy thông tin bàn');
      }
    } catch (err: any) {
      Alert.alert('Không nhận diện được bàn', err.message || 'Mã QR bàn không hợp lệ hoặc đã ngừng hoạt động.', [
        { text: 'Quét lại', onPress: () => setIsScanning(true) },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <QrCode size={64} color="#ea580c" />
        <Text style={styles.permissionTitle}>Cần quyền truy cập Camera</Text>
        <Text style={styles.permissionText}>
          TeaPlus cần quyền Camera để bạn quét mã QR đặt món trực tiếp tại bàn.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Cấp quyền Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {resolvedTable ? (
        <View style={styles.successContainer}>
          <CheckCircle2 size={72} color="#16a34a" />
          <Text style={styles.successTitle}>Đã nhận diện bàn!</Text>
          <View style={styles.tableCard}>
            <Text style={styles.tableName}>{resolvedTable.name}</Text>
            <Text style={styles.storeName}>{resolvedTable.store_name}</Text>
          </View>
          <Text style={styles.successDesc}>
            Mọi món bạn chọn sẽ tự động được gửi tới phục vụ tại bàn này.
          </Text>

          <TouchableOpacity
            style={styles.goToMenuBtn}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/menu')}
          >
            <Text style={styles.goToMenuText}>Bắt đầu chọn món</Text>
            <ArrowRight size={20} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={() => {
              setResolvedTable(null);
              setIsScanning(true);
            }}
          >
            <RotateCcw size={16} color="#6b7280" />
            <Text style={styles.rescanText}>Quét lại bàn khác</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          />

          {/* Overlay Box */}
          <View style={styles.overlay}>
            <Text style={styles.scanInstruction}>
              Hướng camera về phía mã QR dán trên bàn
            </Text>

            <View style={styles.scanBox}>
              <View style={[styles.corner, styles.tl]} />
              <View style={[styles.corner, styles.tr]} />
              <View style={[styles.corner, styles.bl]} />
              <View style={[styles.corner, styles.br]} />
            </View>

            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.loadingText}>Đang nhận diện bàn...</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permissionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanInstruction: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  scanBox: {
    width: 250,
    height: 250,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#ea580c',
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  loadingBox: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1f2937',
    marginTop: 16,
  },
  tableCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 16,
    width: '100%',
  },
  tableName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#16a34a',
  },
  storeName: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
    marginTop: 4,
  },
  successDesc: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 28,
  },
  goToMenuBtn: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    gap: 8,
  },
  goToMenuText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    padding: 8,
  },
  rescanText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
});
