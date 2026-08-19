import React from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { X, ExternalLink, CheckCircle, Copy } from 'lucide-react-native';
import { vnd } from '../lib/formatters';

interface VietQRModalProps {
  visible: boolean;
  qrCodeUrl?: string;
  orderCode: string;
  amount: number;
  onClose: () => void;
  onConfirmPaid: () => void;
}

export function VietQRModal({
  visible,
  qrCodeUrl,
  orderCode,
  amount,
  onClose,
  onConfirmPaid,
}: VietQRModalProps) {
  const qrImage = qrCodeUrl || `https://api.vietqr.io/image/970422-0901234567-compact2.jpg?amount=${amount}&addInfo=${orderCode}&accountName=TEA%20PLUS`;

  const handleOpenBankingApp = async () => {
    // VietQR / Banking universal deeplink scheme
    const vietqrDeeplink = `https://dl.vietqr.io/pay?amount=${amount}&info=${orderCode}`;
    try {
      const supported = await Linking.canOpenURL(vietqrDeeplink);
      if (supported) {
        await Linking.openURL(vietqrDeeplink);
      } else {
        Alert.alert('Thông báo', 'Vui lòng mở ứng dụng ngân hàng và quét mã QR trên màn hình.');
      }
    } catch {
      Alert.alert('Thông báo', 'Vui lòng mở ứng dụng ngân hàng và quét mã QR trên màn hình.');
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Thanh toán VietQR</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#4b5563" />
            </TouchableOpacity>
          </View>

          {/* QR Container */}
          <View style={styles.qrSection}>
            <Text style={styles.amountText}>{vnd(amount)}</Text>
            <Text style={styles.orderCodeText}>Nội dung: {orderCode}</Text>

            <View style={styles.qrWrapper}>
              <Image source={{ uri: qrImage }} style={styles.qrImage} resizeMode="contain" />
            </View>

            <Text style={styles.instruction}>
              Quét mã bằng bất kỳ ứng dụng ngân hàng nào (Vietcombank, MB, Techcombank, Momo, VNPay...)
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.bankBtn} activeOpacity={0.85} onPress={handleOpenBankingApp}>
              <ExternalLink size={18} color="#ea580c" />
              <Text style={styles.bankBtnText}>Mở ứng dụng Ngân hàng</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} activeOpacity={0.85} onPress={onConfirmPaid}>
              <CheckCircle size={18} color="#ffffff" />
              <Text style={styles.confirmBtnText}>Tôi đã thanh toán</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 4,
  },
  qrSection: {
    alignItems: 'center',
    width: '100%',
  },
  amountText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ea580c',
  },
  orderCodeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 4,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  qrWrapper: {
    width: 230,
    height: 230,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fed7aa',
    padding: 8,
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  instruction: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  bankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  bankBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ea580c',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
