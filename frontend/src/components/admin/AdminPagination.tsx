import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function AdminPagination({
  page,
  totalPages,
  totalItems,
  itemLabel,
  onPageChange,
  loading = false,
  className,
}: AdminPaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  const hasItems = totalItems !== undefined && totalItems !== null;

  return (
    <div
      className={cn(
        'mt-6 flex items-center justify-between border-t border-border pt-4 text-sm text-muted-foreground',
        className,
      )}
    >
      <span>
        Trang {page} / {safeTotalPages}
        {hasItems && (
          <span className="ml-1 text-xs opacity-80">
            ({totalItems} {itemLabel || 'mục'})
          </span>
        )}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs gap-1 disabled:cursor-not-allowed"
          aria-label="Trang trước"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
        >
          <ChevronLeft className="size-3.5" />
          <span>Trang trước</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-xs gap-1 disabled:cursor-not-allowed"
          aria-label="Trang sau"
          onClick={() => onPageChange(page < safeTotalPages ? page + 1 : page)}
          disabled={page >= safeTotalPages || loading}
        >
          <span>Trang sau</span>
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
