import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreditCard,
  Plus,
  Copy,
  Check,
  Building2,
  ShieldCheck,
  RefreshCw,
  FolderTree,
  Edit2,
  Lock,
  Layers,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
} from '@/lib/api';

export function PaymentProfileManager() {
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<PaymentProfile | null>(null);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [selectedCreateRootId, setSelectedCreateRootId] = useState<number | null>(null);
  const [assigningProfileId, setAssigningProfileId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [purpose, setPurpose] = useState<'industry' | 'grouped_checkout'>('industry');
  const [isActive, setIsActive] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-payment-profiles'],
    queryFn: () => fetchPaymentProfiles(),
  });

  const { data: categoryTree } = useQuery({
    queryKey: ['public-category-tree-admin'],
    queryFn: () => fetchPublicCategoryTree(),
  });

  const rootCategories = (categoryTree || []).filter((c) => !c.parent_id || Number(c.depth) === 0);
  const selectedCreateRoot = rootCategories.find((root) => root.id === selectedCreateRootId) || null;

  const createMutation = useMutation({
    mutationFn: createPaymentProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updatePaymentProfile>[1] }) =>
      updatePaymentProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
      setEditingProfile(null);
      resetForm();
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
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
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (rootId: number) => unassignPaymentProfileFromRoot(rootId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-profiles'] });
    },
    onError: (err: Error) => {
      setErrorMessage(err.message);
    },
  });

  const resetForm = () => {
    setCode('');
    setDisplayName('');
    setPurpose('industry');
    setIsActive(false);
    setSelectedCreateRootId(null);
    setErrorMessage(null);
  };

  const getIndustryDefaultCode = (slug: string) => `${String(slug || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_]/g, '_')}_DEFAULT`;

  const handleCreatePurposeChange = (nextPurpose: 'industry' | 'grouped_checkout') => {
    setPurpose(nextPurpose);
    if (nextPurpose === 'grouped_checkout') {
      setSelectedCreateRootId(null);
      setCode('GROUP_CHECKOUT');
      return;
    }
    setCode(selectedCreateRoot ? getIndustryDefaultCode(selectedCreateRoot.slug) : '');
  };

  const handleCreateRootChange = (rootId: number | null) => {
    setSelectedCreateRootId(rootId);
    const root = rootCategories.find((item) => item.id === rootId);
    setCode(root ? getIndustryDefaultCode(root.slug) : '');
    if (root && !displayName.trim()) {
      setDisplayName(`${root.name} - Mặc định`);
    }
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
    setPurpose(profile.purpose || 'industry');
    setIsActive(profile.status === 'active');
    setErrorMessage(null);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    createMutation.mutate({
      code: code.toUpperCase().trim().replace(/[^A-Z0-9_]/g, '_'),
      display_name: displayName.trim(),
      purpose,
      root_category_id: purpose === 'industry' ? selectedCreateRootId || undefined : undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setErrorMessage(null);
    updateMutation.mutate({
      id: editingProfile.id,
      data: {
        display_name: displayName.trim(),
        purpose,
        status: isActive ? 'active' : 'disabled',
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
          <p className="font-semibold">Nguyên tắc bảo mật Secret PayOS & Nguồn sự thật thanh toán:</p>
          <p className="text-muted-foreground leading-relaxed">
            Hệ thống <strong>không lưu trữ</strong> và <strong>không hiển thị thông tin số tài khoản / API Key nhập tay</strong>.
            Nơi tiền chuyển đến được quyết định hoàn toàn bởi bộ 3 biến môi trường ENV cấu hình trên Hosting (Render).
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
            const isGrouped = profile.purpose === 'grouped_checkout';
            const hasAssignedCategories = (profile.assigned_categories || []).length > 0;

            return (
              <div
                key={profile.id}
                className="rounded-xl border border-border/80 bg-card p-5 shadow-xs hover:border-primary/30 transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold ${
                      isGrouped ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-primary/10 text-primary'
                    }`}>
                      {isGrouped ? <Layers className="size-5" /> : <Building2 className="size-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{profile.display_name}</span>
                        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono font-bold text-foreground/80">
                          {profile.code}
                        </code>
                        <span className="text-[11px] text-muted-foreground font-mono">v{profile.version}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {isGrouped ? (
                          <Badge variant="secondary" className="bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold text-[11px]">
                            Tài khoản thanh toán gộp
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-sky-500/15 text-sky-700 dark:text-sky-300 font-semibold text-[11px]">
                            Nhận tiền ngành hàng
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges: Independent ENV Status & Business Active Status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {profile.is_env_configured ? (
                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
                        ENV đã sẵn sàng trên server
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs font-semibold">
                        Chờ cấu hình ENV
                      </Badge>
                    )}

                    {profile.status === 'active' ? (
                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
                        Đang bật
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Đã tắt
                      </Badge>
                    )}

                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(profile)}>
                      <Edit2 className="size-3.5 mr-1" /> Sửa
                    </Button>
                  </div>
                </div>

                {/* Purpose and Categories section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <FolderTree className="size-3.5 text-primary" />
                      <span>
                        {isGrouped
                          ? 'Mục đích sử dụng'
                          : `Ngành hàng áp dụng (${profile.assigned_categories?.length || 0})`}
                      </span>
                    </div>
                    {!isGrouped && (
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

                  {isGrouped ? (
                    <p className="text-xs text-muted-foreground/90 bg-purple-500/5 border border-purple-500/20 p-2.5 rounded-lg">
                      Dùng khi khách mua từ nhiều ngành hàng. Hệ thống tự động gom thanh toán về tài khoản này.
                    </p>
                  ) : !hasAssignedCategories ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 italic bg-amber-500/5 border border-amber-500/20 p-2 rounded-lg">
                      {profile.status === 'active'
                        ? 'Sẵn sàng, chưa gán ngành hàng'
                        : 'Chưa gán ngành hàng nào'}
                    </p>
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
                            className="hover:text-destructive text-primary/60 font-bold ml-1 cursor-pointer"
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
                    <span>
                      Cấu hình Render ENV (
                      {profile.is_env_configured ? '✅ Đã nhận đủ trên server' : '⚠️ Chưa cấu hình đủ trên server'}
                      ):
                    </span>
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

      {/* Guidance Note: Decommissioning */}
      <div className="rounded-xl border bg-card p-4 text-xs text-muted-foreground flex items-center gap-2">
        <Info className="size-4 text-primary shrink-0" />
        <span>
          Để ngừng sử dụng một kênh thanh toán: Hãy bỏ gán ngành hàng (nếu có) và gạt công tắc sang <strong>Tắt</strong>.
          Lịch sử thanh toán và đơn hàng cũ vẫn được bảo toàn an toàn.
        </span>
      </div>

      {/* Dialog: Create Profile */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Tạo Payment Profile Mới</DialogTitle>
              <DialogDescription>
                Tạo profile nhận tiền. Profile tạo mới sẽ ở trạng thái <strong>Tắt</strong> cho đến khi cấu hình đủ ENV.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {errorMessage && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive font-medium rounded-lg border border-destructive/20">
                  {errorMessage}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Mã Kỹ Thuật (UPPER_SNAKE_CASE) *</label>
                <Input
                  placeholder="Ví dụ: NUOC_HIEU, DO_AN_LAN"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  readOnly={purpose === 'grouped_checkout'}
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Mục Đích Sử Dụng *</label>
                <select
                  value={purpose}
                  onChange={(e) => handleCreatePurposeChange(e.target.value as 'industry' | 'grouped_checkout')}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                >
                  <option value="industry">Nhận tiền ngành hàng (Đơn thuộc 1 ngành)</option>
                  <option value="grouped_checkout">Tài khoản thanh toán gộp (Đơn gộp nhiều ngành)</option>
                </select>
              </div>
              {purpose === 'industry' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Ngành Hàng Gốc *</label>
                  <select
                    value={selectedCreateRootId || ''}
                    onChange={(e) => handleCreateRootChange(Number(e.target.value) || null)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    required
                  >
                    <option value="">-- Chọn ngành hàng --</option>
                    {rootCategories.map((root) => (
                      <option key={root.id} value={root.id}>
                        {root.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    Mã được gợi ý theo quy ước {selectedCreateRoot ? getIndustryDefaultCode(selectedCreateRoot.slug) : 'TEN_NGANH_DEFAULT'}.
                  </p>
                </div>
              )}
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
                Cập nhật tên hiển thị, mục đích hoặc trạng thái bật/tắt sử dụng.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {errorMessage && (
                <div className="p-3 text-xs bg-destructive/10 text-destructive font-medium rounded-lg border border-destructive/20">
                  {errorMessage}
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Tên Hiển Thị *</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">Mục Đích Sử Dụng</label>
                {editingProfile?.status === 'active' || (editingProfile?.assigned_categories || []).length > 0 ? (
                  <div>
                    <select
                      value={purpose}
                      disabled
                      className="w-full h-9 rounded-md border border-input bg-muted px-3 py-1 text-sm opacity-70 cursor-not-allowed"
                    >
                      <option value="industry">Nhận tiền ngành hàng</option>
                      <option value="grouped_checkout">Tài khoản thanh toán gộp</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ⚠️ Để đổi mục đích: Hãy tắt profile và bỏ gán toàn bộ ngành hàng trước.
                    </p>
                  </div>
                ) : (
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as any)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  >
                    <option value="industry">Nhận tiền ngành hàng</option>
                    <option value="grouped_checkout">Tài khoản thanh toán gộp</option>
                  </select>
                )}
              </div>

              {/* Status Toggle Switch */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="space-y-0.5">
                  <label className="text-xs font-semibold">Bật dùng cho đơn mới</label>
                  <p className="text-[11px] text-muted-foreground">
                    {isActive
                      ? 'Đang bật: Đơn hàng mới có thể sử dụng kênh này.'
                      : 'Đang tắt: Không nhận đơn hàng mới.'}
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
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
          {errorMessage && (
            <div className="p-3 text-xs bg-destructive/10 text-destructive font-medium rounded-lg border border-destructive/20">
              {errorMessage}
            </div>
          )}
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
                  setErrorMessage(null);
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
