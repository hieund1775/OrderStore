import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CalendarClock, CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/authStore';
import { checkInPreorder, confirmPreorder, fetchKitchenPreorders, fetchOperationalPreorders, reschedulePreorder } from '../../src/lib/api';
import { AdminHeader } from '../../src/components/AdminHeader';

type Preorder = { id: number; preorder_code: string; status: string; scheduled_start_at: string; store_name?: string; customer_name?: string; reschedule_count?: number; late_minutes?: number | null };

export default function PreordersScreen() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role || 'cashier';
  const [rows, setRows] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'pending' | 'today' | 'upcoming'>('pending');
  const [rescheduleId, setRescheduleId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleHour, setRescheduleHour] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');

  const load = useCallback(async () => {
    if (!['super', 'manager', 'kitchen'].includes(role)) { setRows([]); setLoading(false); return; }
    try {
      setError('');
      const data = role === 'kitchen'
        ? await fetchKitchenPreorders(user?.branch_id)
        : await fetchOperationalPreorders({ view, store_id: role === 'manager' ? user?.branch_id : null });
      setRows(data);
    } catch (value: any) {
      setError(value?.status === 403 ? 'Bạn không có quyền truy cập preorder của chi nhánh này.' : value?.message || 'Không thể tải preorder.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [role, user?.branch_id, view]);

  useEffect(() => { void load(); }, [load]);

  async function confirm(item: Preorder) {
    try { await confirmPreorder(item.id); await load(); }
    catch (value: any) { Alert.alert('Không thể xác nhận', value?.message || 'Vui lòng thử lại.'); }
  }
  async function checkIn(item: Preorder) {
    try { await checkInPreorder(item.id); await load(); }
    catch (value: any) { Alert.alert('Không thể check-in', value?.message || 'Kiểm tra khung giờ hẹn.'); }
  }
  async function reschedule(item: Preorder) {
    if (!rescheduleDate || !rescheduleHour || !rescheduleReason.trim()) { Alert.alert('Thiếu thông tin', 'Nhập ngày, giờ và lý do đã thỏa thuận với khách.'); return; }
    try {
      await reschedulePreorder(item.id, { scheduled_date: rescheduleDate, scheduled_hour: Number(rescheduleHour), reason: rescheduleReason.trim() });
      setRescheduleId(null); setRescheduleReason(''); await load();
    } catch (value: any) { Alert.alert('Không thể đổi lịch', value?.message || 'Vui lòng thử lại.'); }
  }

  if (!['super', 'manager', 'kitchen'].includes(role)) return <View style={styles.center}><Text>Vai trò này không có màn hình preorder.</Text></View>;
  return <View style={styles.container}><AdminHeader title={role === 'kitchen' ? 'Preorder đã xác nhận' : 'Đơn đặt trước'} subtitle={role === 'kitchen' ? 'Chỉ hiện sau khi Manager xác nhận' : 'Chờ xác nhận và nhận khách'} />
    {role !== 'kitchen' && <View style={styles.tabs}>{(['pending', 'today', 'upcoming'] as const).map((candidate) => <TouchableOpacity key={candidate} onPress={() => setView(candidate)} style={[styles.tab, view === candidate && styles.tabActive]}><Text style={[styles.tabText, view === candidate && styles.tabTextActive]}>{candidate === 'pending' ? 'Chờ xác nhận' : candidate === 'today' ? 'Hôm nay' : 'Sắp tới'}</Text></TouchableOpacity>)}</View>}
    {loading ? <View style={styles.center}><ActivityIndicator color="#f97316" /></View> : <FlatList data={rows} keyExtractor={(item) => String(item.id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} />} ListEmptyComponent={<View style={styles.empty}><CalendarClock size={28} color="#94a3b8" /><Text style={styles.emptyText}>{error || 'Không có preorder phù hợp.'}</Text><TouchableOpacity onPress={() => void load()} style={styles.refresh}><RefreshCw size={16} color="#ffffff" /><Text style={styles.refreshText}>Thử lại</Text></TouchableOpacity></View>} renderItem={({ item }) => <View style={styles.card}><View style={styles.cardTop}><View><Text style={styles.code}>{item.preorder_code}</Text><Text style={styles.meta}>{new Date(item.scheduled_start_at).toLocaleString('vi-VN')}</Text><Text style={styles.meta}>{item.store_name || ''} {item.customer_name ? `· ${item.customer_name}` : ''}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{item.status}</Text></View></View>{item.late_minutes ? <Text style={styles.late}>Muộn {item.late_minutes} phút</Text> : null}{role !== 'kitchen' && item.status === 'PENDING_MANAGER_CONFIRMATION' ? <TouchableOpacity style={styles.primary} onPress={() => void confirm(item)}><CheckCircle2 size={17} color="#ffffff" /><Text style={styles.primaryText}>Xác nhận & gửi vận hành</Text></TouchableOpacity> : null}{role !== 'kitchen' && item.status === 'CONFIRMED' ? <TouchableOpacity style={styles.secondary} onPress={() => void checkIn(item)}><ClipboardCheck size={17} color="#c2410c" /><Text style={styles.secondaryText}>Check-in khách</Text></TouchableOpacity> : null}{role !== 'kitchen' && ['PENDING_MANAGER_CONFIRMATION','CONFIRMED'].includes(item.status) && item.reschedule_count !== 1 ? <TouchableOpacity style={styles.linkButton} onPress={() => { setRescheduleId(item.id); setRescheduleDate(''); setRescheduleHour(''); setRescheduleReason(''); }}><Text style={styles.linkText}>Đổi lịch (tối đa một lần)</Text></TouchableOpacity> : null}{rescheduleId === item.id && <View style={styles.reschedule}><TextInput style={styles.input} placeholder="YYYY-MM-DD" value={rescheduleDate} onChangeText={setRescheduleDate} /><TextInput style={styles.input} placeholder="Giờ 9–22" keyboardType="number-pad" value={rescheduleHour} onChangeText={setRescheduleHour} /><TextInput style={styles.input} placeholder="Lý do, đã thỏa thuận với khách" value={rescheduleReason} onChangeText={setRescheduleReason} /><TouchableOpacity style={styles.secondary} onPress={() => void reschedule(item)}><Text style={styles.secondaryText}>Lưu đổi lịch</Text></TouchableOpacity></View>}</View>} />}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, empty: { alignItems: 'center', padding: 40, gap: 12 }, emptyText: { color: '#64748b', textAlign: 'center' }, refresh: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }, refreshText: { color: '#fff', fontWeight: '700' }, tabs: { flexDirection: 'row', gap: 8, padding: 12 }, tab: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#e2e8f0' }, tabActive: { backgroundColor: '#ffedd5' }, tabText: { color: '#475569', fontWeight: '700', fontSize: 12 }, tabTextActive: { color: '#c2410c' }, card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, code: { fontSize: 16, fontWeight: '800', color: '#0f172a' }, meta: { fontSize: 13, color: '#64748b', marginTop: 3 }, badge: { alignSelf: 'flex-start', backgroundColor: '#fff7ed', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, maxWidth: 145 }, badgeText: { color: '#c2410c', fontWeight: '700', fontSize: 10, textAlign: 'center' }, late: { color: '#b45309', fontSize: 12 }, primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 9, backgroundColor: '#f97316' }, primaryText: { color: '#fff', fontWeight: '800' }, secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 9, backgroundColor: '#fff7ed' }, secondaryText: { color: '#c2410c', fontWeight: '800' }, linkButton: { alignItems: 'center', paddingVertical: 6 }, linkText: { color: '#c2410c', fontWeight: '700', fontSize: 12 }, reschedule: { gap: 8, backgroundColor: '#f8fafc', padding: 10, borderRadius: 8 }, input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 9 },
});
