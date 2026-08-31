import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import type { PublicCategoryNode } from '@/lib/api';
import { getRootCategories, shouldUseMegaMenu } from '@/lib/catalog-navigation';
import { MegaMenu } from './MegaMenu';
import { SimpleCategoryDropdown } from './SimpleCategoryDropdown';

interface CategoryMenuProps {
  categoryTree: PublicCategoryNode[];
  isLoading?: boolean;
  isError?: boolean;
  refetch?: () => void;
  currentCategorySlug?: string;
  isMenuRouteActive?: boolean;
}

export function CategoryMenu({
  categoryTree,
  isLoading,
  isError,
  refetch,
  currentCategorySlug,
  isMenuRouteActive,
}: CategoryMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearCloseTimer();
    setIsOpen(true);
  }, [clearCloseTimer]);

  const handleMouseLeave = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  }, [clearCloseTimer]);

  const handleToggle = useCallback(() => {
    clearCloseTimer();
    setIsOpen((prev) => !prev);
  }, [clearCloseTimer]);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    setIsOpen(false);
  }, [clearCloseTimer]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // Escape key listener
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    }

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose]);

  // Cleanup close timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const isMega = shouldUseMegaMenu(categoryTree);
  const rootCategories = getRootCategories(categoryTree);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerEnter={handleMouseEnter}
      onPointerLeave={handleMouseLeave}
      className="relative inline-block"
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="category-desktop-menu"
        className={`hover:bg-accent rounded-full px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
          isMenuRouteActive || isOpen
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'text-foreground'
        }`}
      >
        <span>Danh mục</span>
        <ChevronDown
          className={`size-3.5 opacity-60 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          id="category-desktop-menu"
          className={`absolute top-full pt-2 z-50 animate-in fade-in-0 duration-150 ${
            isMega ? 'left-0' : 'left-0'
          }`}
        >
          {isLoading ? (
            <div className="w-56 rounded-xl border border-border/80 bg-popover/98 p-4 text-xs text-muted-foreground shadow-xl backdrop-blur-xl text-center">
              Đang tải danh mục…
            </div>
          ) : isError ? (
            <div className="w-56 rounded-xl border border-border/80 bg-popover/98 p-3 text-xs text-center shadow-xl backdrop-blur-xl space-y-2">
              <p className="text-destructive font-medium">Không thể tải danh mục</p>
              {refetch && (
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                >
                  <RefreshCw className="size-3" /> Thử lại
                </button>
              )}
            </div>
          ) : rootCategories.length === 0 ? (
            <div className="w-56 rounded-xl border border-border/80 bg-popover/98 p-4 text-xs text-muted-foreground shadow-xl backdrop-blur-xl text-center">
              Chưa có danh mục công khai
            </div>
          ) : isMega ? (
            <MegaMenu
              categoryTree={categoryTree}
              currentCategorySlug={currentCategorySlug}
              onClose={handleClose}
            />
          ) : (
            <SimpleCategoryDropdown
              categoryTree={categoryTree}
              currentCategorySlug={currentCategorySlug}
              onClose={handleClose}
            />
          )}
        </div>
      )}
    </div>
  );
}
