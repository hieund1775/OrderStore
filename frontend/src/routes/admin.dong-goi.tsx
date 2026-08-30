import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Package,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Store,
  Barcode,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiGet, apiPatch, getUser } from '@/lib/api';
import { toast } from 'sonner';

export const Route = createFileRoute('/admin/dong-goi')({
  component: PackingStationPage,
});

type FulfillmentTaskItem = {
  id: number;
  task_id: number;
  product_name: string;
  sku?: string;
  quantity: number;
  modifiers_snapshot?: Record<string, any>;
  item_notes?: string;
};

type FulfillmentTask = {
  id: number;
  order_id: number;
  order_code: string;
  order_type: string;
  branch_id: number;
  store_name: string;
  lane: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  customer_name?: string;
  customer_phone?: string;
  table_id?: number;
  location_name?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  items: FulfillmentTaskItem[];
};

export function PackingStationPage() {
  const user = getUser();
  const isSuperAdmin = user?.role === 'super';
  const [tasks, setTasks] = useState<FulfillmentTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>(() =>
    user?.role === 'super' ? '' : user?.branch_id ? String(user.branch_id) : '',
  );
  const [branches, setBranches] = useState<Array<{ id: number; name: string }>>([]);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const fetchTasks = async () => {
    if (isSuperAdmin && !selectedBranch) {
      setTasks([]);
      return;
    }
    try {
      setLoading(true);
      const query = new URLSearchParams();
      query.set('lane', 'packing');
      if (selectedBranch) {
        query.set('branch_id', selectedBranch);
      }

      const data = await apiGet<{ tasks: FulfillmentTask[] }>(
        `/admin/fulfillment/tasks?${query.toString()}`,
      );
      setTasks(data.tasks || []);
    } catch (err: any) {
      toast.error(err?.message || 'Không thể tải danh sách đóng gói');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [selectedBranch]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    apiGet<Array<{ id: number; name: string }>>('/admin/branches')
      .then((rows) => setBranches(Array.isArray(rows) ? rows : []))
      .catch(() => setBranches([]));
  }, [isSuperAdmin]);

  const handleUpdateStatus = async (taskId: number, newStatus: 'preparing' | 'ready' | 'completed') => {
    setUpdatingTaskId(taskId);
    try {
      const res = await apiPatch<{ success: boolean; message: string; allTasksCompleted?: boolean }>(
        `/admin/fulfillment/tasks/${taskId}/status`,
        { status: newStatus },
      );
      toast.success(res.message);
      if (res.allTasksCompleted) {
        toast.info('🎉 Toàn bộ các khâu của đơn hàng đã sẵn sàng giao!');
      }
      fetchTasks();
    } catch (err: any) {
      toast.error(err?.message || 'Cập nhật trạng thái thất bại');
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.order_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.customer_name && t.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      t.items.some((i) => i.product_name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === 'pending') return t.status === 'pending';
    if (activeTab === 'preparing') return t.status === 'preparing';
    if (activeTab === 'completed') return t.status === 'ready' || t.status === 'completed';
    return t.status === 'pending' || t.status === 'preparing';
  });

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const preparingCount = tasks.filter((t) => t.status === 'preparing').length;
  const completedCount = tasks.filter((t) => t.status === 'ready' || t.status === 'completed').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Package className="size-7 text-primary" />
            <span>Khu Vực Đóng Gói (Packing Station)</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý và hoàn thiện đơn hàng cho các sản phẩm thời trang, đồ khô, snack và quà lưu niệm.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Filters & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Tìm mã đơn, tên khách, sản phẩm…"
              className="pl-9 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {isSuperAdmin && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Chọn chi nhánh" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={String(branch.id)}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList className="grid grid-cols-4 w-full sm:w-[480px]">
            <TabsTrigger value="active" className="text-xs">
              Đang chờ ({pendingCount + preparingCount})
            </TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">
              Chưa làm ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="preparing" className="text-xs">
              Đang gói ({preparingCount})
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs">
              Đã xong ({completedCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Task Grid */}
      {filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
          <Package className="size-12 text-muted-foreground/40 mb-3" />
          <p className="text-base font-semibold text-foreground">Không có đơn hàng đóng gói nào</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            Các đơn hàng chứa sản phẩm quần áo, đồ ăn đóng gói hoặc merchandise sẽ tự động xuất hiện tại đây khi khách thanh toán.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => {
            const isUpdating = updatingTaskId === task.id;
            return (
              <Card
                key={task.id}
                className={`flex flex-col border shadow-sm transition-all ${
                  task.status === 'preparing'
                    ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10 ring-1 ring-amber-500/20'
                    : task.status === 'ready' || task.status === 'completed'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-border bg-card'
                }`}
              >
                <CardHeader className="pb-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-bold text-foreground">
                        #{task.order_code}
                      </span>
                      <Badge variant="outline" className="text-[11px] font-semibold">
                        {task.order_type}
                      </Badge>
                    </div>
                    {task.status === 'pending' && (
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold text-xs">
                        Chờ đóng gói
                      </Badge>
                    )}
                    {task.status === 'preparing' && (
                      <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 font-bold text-xs animate-pulse">
                        Đang đóng gói
                      </Badge>
                    )}
                    {(task.status === 'ready' || task.status === 'completed') && (
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-xs">
                        ✓ Đã đóng gói
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs flex items-center justify-between pt-1">
                    <span className="flex items-center gap-1">
                      <Store className="size-3 text-muted-foreground" /> {task.store_name}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="size-3 text-muted-foreground" />
                      {new Date(task.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-3 pt-3">
                  {/* Items list */}
                  <div className="space-y-2">
                    {task.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-background border flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground truncate">{item.product_name}</p>
                          {item.sku && (
                            <p className="font-mono text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Barcode className="size-3" /> SKU: {item.sku}
                            </p>
                          )}
                          {item.modifiers_snapshot && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(item.modifiers_snapshot).map(([k, v]) => {
                                if (!v) return null;
                                return (
                                  <span
                                    key={k}
                                    className="inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground"
                                  >
                                    {String(v)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {item.item_notes && (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 italic mt-1">
                              * {item.item_notes}
                            </p>
                          )}
                        </div>
                        <span className="font-bold font-mono text-sm px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          x{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Customer info */}
                  {task.customer_name && (
                    <div className="text-[11px] text-muted-foreground pt-1 border-t flex justify-between">
                      <span>Khách: <b>{task.customer_name}</b></span>
                      {task.customer_phone && <span className="font-mono">{task.customer_phone}</span>}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-2">
                    {task.status === 'pending' && (
                      <Button
                        className="w-full font-bold text-xs h-9"
                        variant="hero"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(task.id, 'preparing')}
                      >
                        <Play className="mr-1.5 size-3.5" /> Bắt đầu đóng gói
                      </Button>
                    )}

                    {task.status === 'preparing' && (
                      <Button
                        className="w-full font-bold text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(task.id, 'completed')}
                      >
                        <CheckCircle2 className="mr-1.5 size-3.5" /> Hoàn thành đóng gói
                      </Button>
                    )}

                    {(task.status === 'ready' || task.status === 'completed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs h-8"
                        disabled={isUpdating}
                        onClick={() => handleUpdateStatus(task.id, 'preparing')}
                      >
                        <RotateCcw className="mr-1 size-3" /> Mở lại gói hàng
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default PackingStationPage;
