import React, { useEffect, useState } from "react";
import {
  formatDateTimeInZone,
  formatVietnamDateTime,
  formatVietnamDate,
  formatVietnamTime,
  formatVietnamTimeFull,
  parseTimestamp,
  canonicalizeTimeZone,
  isVietnamTimeZone,
  VIETNAM_TIMEZONE,
  FALLBACK_DASH,
} from "@/lib/time";

export type CustomerTimeVariant = "datetime" | "date" | "time" | "timeFull";

export interface CustomerDateTimeProps {
  value: string | Date | number | null | undefined;
  variant?: CustomerTimeVariant;
  className?: string;
  subClassName?: string;
  showStoreTime?: boolean;
  /** Optional override for testing */
  forcedClientTimeZone?: string;
}

function formatByVariant(value: unknown, timeZone: string, variant: CustomerTimeVariant): string {
  switch (variant) {
    case "date":
      return formatDateTimeInZone(value, timeZone, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    case "time":
      return formatDateTimeInZone(value, timeZone, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    case "timeFull":
      return formatDateTimeInZone(value, timeZone, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    case "datetime":
    default:
      return formatDateTimeInZone(value, timeZone, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
  }
}

/**
 * Customer-facing DateTime component.
 * SSR-safe: renders Vietnam store time initially to prevent hydration mismatch,
 * then adapts to client browser timezone if different from Vietnam.
 */
export function CustomerDateTime({
  value,
  variant = "datetime",
  className = "",
  subClassName = "text-[11px] text-muted-foreground block font-normal",
  showStoreTime = true,
  forcedClientTimeZone,
}: CustomerDateTimeProps) {
  const [clientTimeZone, setClientTimeZone] = useState<string | null>(null);

  useEffect(() => {
    try {
      const resolved = forcedClientTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
      setClientTimeZone(resolved && canonicalizeTimeZone(resolved) ? resolved : VIETNAM_TIMEZONE);
    } catch {
      // Fallback to Vietnam timezone if detection fails
      setClientTimeZone(VIETNAM_TIMEZONE);
    }
  }, [forcedClientTimeZone]);

  const timestamp = parseTimestamp(value);
  if (!timestamp) {
    return <span className={className}>{FALLBACK_DASH}</span>;
  }

  const storeTimeFormatted = formatByVariant(timestamp, VIETNAM_TIMEZONE, variant);

  // During SSR or initial client render before mount, render store time directly
  if (!clientTimeZone || isVietnamTimeZone(clientTimeZone)) {
    return <span className={className}>{storeTimeFormatted}</span>;
  }

  const localTimeFormatted = formatByVariant(timestamp, clientTimeZone, variant);

  return (
    <span className={className}>
      <span>{localTimeFormatted}</span>
      {showStoreTime && (
        <span className={subClassName}>{`(Giờ cửa hàng: ${storeTimeFormatted} GMT+7)`}</span>
      )}
    </span>
  );
}

export default CustomerDateTime;
