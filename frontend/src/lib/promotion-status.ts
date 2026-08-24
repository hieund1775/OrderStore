export type PromotionStatusVariant = "inactive" | "expired" | "exhausted" | "pending" | "active";

export interface PromotionStatusInfo {
  label: string;
  variant: PromotionStatusVariant;
  isUnlimitedDate: boolean;
  isUnlimitedUsage: boolean;
  dateDisplay: string;
  usageDisplay: string;
}

export interface PromotionStatusInput {
  is_active?: boolean;
  voucher_type?: "single_use" | "shared" | string;
  usage_limit?: number | null;
  used_count?: number | null;
  start_date?: string | null;
  end_date?: string | null;
}

export function formatVoucherDate(dateStr?: string | null): string {
  if (!dateStr) return "Không hạn ngày";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatLocalDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getPromotionStatus(
  p: PromotionStatusInput,
  now: Date = new Date(),
): PromotionStatusInfo {
  const today = formatLocalDateKey(now);
  const isActive = p.is_active !== false;
  const isUnlimitedDate = !p.end_date;
  const isSingleUse = p.voucher_type === "single_use";
  const isUnlimitedUsage = !isSingleUse && p.usage_limit == null;

  const usedCount = Number(p.used_count || 0);
  const usageLimit = p.usage_limit != null ? Number(p.usage_limit) : null;

  const isExpiredByDate = !isUnlimitedDate && p.end_date!.slice(0, 10) < today;
  const isExpiredByUsage = !isSingleUse && usageLimit != null && usedCount >= usageLimit;
  const isPending = Boolean(p.start_date && p.start_date.slice(0, 10) > today);

  let dateDisplay = "Không hạn ngày";
  if (p.end_date) {
    dateDisplay = formatVoucherDate(p.end_date);
  }

  let usageDisplay = "1 lần / SĐT";
  if (!isSingleUse) {
    usageDisplay =
      usageLimit != null ? `${usedCount}/${usageLimit}` : `${usedCount}/Không hạn lượt`;
  }

  if (!isActive) {
    return {
      label: "Tạm tắt",
      variant: "inactive",
      isUnlimitedDate,
      isUnlimitedUsage,
      dateDisplay,
      usageDisplay,
    };
  }

  if (isPending) {
    return {
      label: "Sắp diễn ra",
      variant: "pending",
      isUnlimitedDate,
      isUnlimitedUsage,
      dateDisplay,
      usageDisplay,
    };
  }

  if (isExpiredByDate) {
    return {
      label: "Hết hạn",
      variant: "expired",
      isUnlimitedDate,
      isUnlimitedUsage,
      dateDisplay,
      usageDisplay,
    };
  }

  if (isExpiredByUsage) {
    return {
      label: "Hết lượt",
      variant: "exhausted",
      isUnlimitedDate,
      isUnlimitedUsage,
      dateDisplay,
      usageDisplay,
    };
  }

  return {
    label: "Đang diễn ra",
    variant: "active",
    isUnlimitedDate,
    isUnlimitedUsage,
    dateDisplay,
    usageDisplay,
  };
}
