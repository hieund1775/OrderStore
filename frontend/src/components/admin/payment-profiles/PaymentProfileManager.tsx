import { useState, useTransition } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Plus,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  FolderTree,
  Edit2,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  fetchPaymentProfiles,
  createPaymentProfile,
  updatePaymentProfile,
  assignPaymentProfileToRoot,
  unassignPaymentProfileFromRoot,
  fetchPublicCategoryTree,
  type PaymentProfile,
  type PublicCategoryNode,
} from '@/lib/api';

export function PaymentProfileManager() {
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PaymentProfile | null>(null);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [assigningProfileId, setAssigningProfileId] = useState<number | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBin, setBankBin] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [status, setStatus] = useState<'pending' | 'active' | 'disabled'>('pending');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-payment-profiles'],
    queryFn: () => fetchPaymentProfiles(),
  });

  const { data: categoryTree } = useQuery({
    queryKey: ['public-category-tree-admin'],
    queryFn: () => fetchPublicCategoryTree(),
  });

  const rootCategories = (categoryTree || []).filter((c) => !c.parent_id || Number(c.depth) === 0);

  const createMutation = useMutation({
    mutationFn: createPaymentProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updatePaymentProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
      setEditingProfile(null);
      resetForm();
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ profileId, rootId }: { profileId: number; rootId: number }) =>
      assignPaymentProfileToRoot(profileId, rootId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
      setAssigningProfileId(null);
      setSelectedRootId(null);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (rootId: number) => unassignPaymentProfileFromRoot(rootId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
    },
  });

  const resetForm = () => {
    setCode('');
    setDisplayName('');
    setBankName('');
    setBankBin('');
    setAccountNumber('');
    setAccountHolder('');
    setStatus('pending');
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEditDialog = (profile: PaymentProfile) => {
    setEditingProfile(profile);
    setDisplayName(profile.display_name);
    setBankName(profile.bank_name || '');
    setBankBin(profile.bank_bin || '');
    setAccountNumber(profile.account_number_masked || '');
    setAccountHolder(profile.account_holder || '');
    setStatus(profile.status);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      code: code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_'),
      display_name: displayName.trim(),
      bank_name: bankName.trim() || undefined,
      bank_bin: bankBin.trim() || undefined,
      account_number: accountNumber.trim() || undefined,
      account_holder: accountHolder.trim() || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    updateMutation.mutate({
      id: editingProfile.id,
      data: {
        display_name: displayName.trim(),
        bank_name: bankName.trim() || undefined,
        bank_bin: bankBin.trim() || undefined,
        account_number: accountNumber.includes('*') ? undefined : accountNumber.trim() || undefined,
        account_holder: accountHolder.trim() || undefined,
        status,
      },
    });
  };

  const profiles = data?.profiles || [];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="size-6 text-primary" />
            <h2 className="text-xl font-bold tracking-tight">Kênh Thanh Toán & Payment Profiles</h2>
            <Badge variant="outline" className="ml-2 gap-1 border-primary/40 text-primary font-semibold text-xs">
              <ShieldCheck className="size-3.5" /> Super Admin Only
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý tài khoản PayOS theo từng ngành hàng gốc và luồng Checkout Gộp (Grouped Checkout).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`size-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Làm mới
          </Button>
          <Button size="sm" onClick={openCreateDialog} className="shadow-xs font-medium">
            <Plus className="size-4 mr-1.5" /> Thêm Profile
          </Button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <Lock className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
        <div className="space-y-1">
          <p className="font-semibold">Nguyên tắc bảo mật Secret PayOS:</p>
          <p className="text-muted-foreground leading-relaxed">
            Hệ thống <strong>không lưu trữ</strong> và <strong>không có ô nhập API Key / Checksum Key</strong> trên giao diện.
            Khi tạo profile, hãy copy 3 tên biến môi trường bên dưới và cấu hình trực tiếp trên dịch vụ Hosting (Render) của bạn.
          </p>
        </div>
      </div>

      {/* Profile List Cards */}
      <div className="grid grid-cols-1 gap-6">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải danh sách profile…</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-destructive font-medium">Không thể tải danh sách profile</div>
        ) : profiles.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground border rounded-xl bg-card">Chưa có Payment Profile nào</div>
        ) : (
          profiles.map((profile) => {
            const isLongGroup = profile.code === 'LONG_GROUPED_CHECKOUT';
            return (
              <div
                key={profile.id}
                className="rounded-xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/30 transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                      <Building2 className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{profile.display_name}</span>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono font-bold text-foreground/80">
                          {profile.code}
                        </code>
                        <span className="text-[11px] text-muted-foreground font-mono">v{profile.version}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {profile.bank_name ? `${profile.bank_name} • ${profile.account_number_masked}` : 'Chưa có thông tin ngân hàng'}
                        {profile.account_holder && ` • ${profile.account_holder}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {profile.status === 'active' ? (
                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
                        Đang hoạt động
                      </Badge>
                    ) : profile.status === 'disabled' ? (
                      <Badge variant="secondary" className="text-xs">Đã tắt</Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs">
                        Chờ cấu hình ENV
                      </Badge>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(profile)}>
                      <Edit2 className="size-3.5 mr-1" /> Sửa
                    </Button>
                  </div>
                </div>

                {/* Assigned Root Categories */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <FolderTree className="size-3.5 text-primary" />
                      <span>Ngành hàng áp dụng ({profile.assigned_categories.length})</span>
                    </div>
                    {!isLongGroup && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] px-2"
                        onClick={() => setAssigningProfileId(profile.id)}
                      >
                        <Plus className="size-3 mr-1" /> Gán ngành hàng
                      </Button>
                    )}
                  </div>

                  {isLongGroup ? (
                    <p className="text-xs text-muted-foreground/90 italic bg-muted/40 p-2 rounded-lg">
                      Profile hệ thống chung: Tự động dùng khi giỏ hàng có từ 2 ngành hàng trở lên hoặc ngành chưa gán profile riêng.
                    </p>
                  ) : profile.assigned_categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70 italic">Chưa gán ngành hàng nào</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile.assigned_categories.map((cat) => (
                        <span
                          key={cat.category_id}
                          className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-md"
                        >
                          {cat.category_name}
                          <button
                            type="button"
                            onClick={() => unassignMutation.mutate(cat.category_id)}
                            className="hover:text-destructive text-primary/60 font-bold ml-1"
                            title="Hủy gán ngành này"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Required Server ENV Names Box */}
                <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-2 border border-border/40">
                  <div className="flex items-center justify-between text-muted-foreground font-medium">
                    <span>Cấu hình Render ENV ({profile.is_env_configured ? '✅ Đã nhận trên server' : '⚠️ Chưa cấu hình trên server'}):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {Object.entries(profile.env_keys).map(([key, envName]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleCopy(envName, `${profile.id}-${key}`)}
                        className="flex items-center justify-between gap-1 p-2 rounded bg-background border hover:border-primary text-left font-mono text-[11px] transition-colors cursor-pointer"
                        title="Click để copy tên biến"
                      >
                        <span className="truncate">{envName}</span>
                        {copiedKey === `${profile.id}-${key}` ? (
                          <Check className="size-3 text-emerald-500 shrink-0" />
                        ) : (
                          <Copy className="size-3 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dialog: Create Profile */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Tạo Payment Profile Mới</DialogTitle>
              <DialogDescription>
                Tạo kênh nhận tiền cho ngành hàng mới. Mã code sau khi tạo sẽ không thay đổi.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Mã Kỹ Thuật (UPPER_SNAKE_CASE) *</label>
                <Input
                  placeholder="Ví dụ: NUOC_HIEU, QUANAO_HUNG"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Tên Hiển Thị *</label>
                <Input
                  placeholder="Ví dụ: Nước Uống - Hiếu"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Tên Ngân Hàng</label>
                  <Input
                    placeholder="MB Bank, VCB..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Số Tài Khoản</label>
                  <Input
                    placeholder="0987654321"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Chủ Tài Khoản</label>
                <Input
                  placeholder="NGUYEN VAN A"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Đang tạo…' : 'Tạo Profile'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Profile */}
      <Dialog open={Boolean(editingProfile)} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle>Sửa Payment Profile: {editingProfile?.code}</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin đối soát hiển thị hoặc trạng thái hoạt động.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Tên Hiển Thị *</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Tên Ngân Hàng</label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Số Tài Khoản</label>
                  <Input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Chủ Tài Khoản</label>
                <Input
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Trạng Thái</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="active">Đang hoạt động (active)</option>
                  <option value="pending">Chờ cấu hình ENV (pending)</option>
                  <option value="disabled">Tắt / Tạm ngưng (disabled)</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingProfile(null)}>
                Hủy
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Đang lưu…' : 'Lưu Thay Đổi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Assign Root Category */}
      <Dialog open={Boolean(assigningProfileId)} onOpenChange={(open) => !open && setAssigningProfileId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Gán Ngành Hàng Gốc</DialogTitle>
            <DialogDescription>
              Chọn ngành hàng gốc (depth = 0) để nhận tiền vào profile này.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <label className="text-xs font-semibold">Chọn Ngành Hàng</label>
            <select
              value={selectedRootId || ''}
              onChange={(e) => setSelectedRootId(Number(e.target.value) || null)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            >
              <option value="">-- Chọn ngành hàng --</option>
              {rootCategories.map((root) => (
                <option key={root.id} value={root.id}>
                  {root.name} ({root.slug})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningProfileId(null)}>
              Hủy
            </Button>
            <Button
              disabled={!selectedRootId || assignMutation.isPending}
              onClick={() => {
                if (assigningProfileId && selectedRootId) {
                  assignMutation.mutate({ profileId: assigningProfileId, rootId: selectedRootId });
                }
              }}
            >
              {assignMutation.isPending ? 'Đang gán…' : 'Xác Nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
