import React from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Sparkles, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProductCard } from '@/components/menu/ProductCard';
import type { PublicCatalogSection } from '@/lib/api';
import { mapApiProduct } from '@/lib/data';

interface CatalogSectionProps {
  section: PublicCatalogSection;
  searchParams: { store_id?: string; table_id?: string };
}

export function CatalogSection({ section, searchParams }: CatalogSectionProps) {
  const hasMore = section.total_products > section.products.length;

  return (
    <section className="space-y-4 py-6 border-b last:border-b-0">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1.5 rounded-lg">
              <FolderTree className="size-5" />
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {section.root_name}
            </h2>
            <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5 ml-1">
              {section.total_products} sản phẩm
            </Badge>
          </div>

          {/* Child Category Quick Filter Chips */}
          {section.children && section.children.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {section.children.map((child) => (
                <Link
                  key={child.id}
                  to="/menu"
                  search={{ ...searchParams, category: child.slug }}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {hasMore && (
          <Link
            to="/menu"
            search={{ ...searchParams, category: section.root_slug }}
            className="self-start sm:self-auto"
          >
            <Button variant="outline" size="sm" className="font-semibold text-xs rounded-full h-8">
              <span>Xem tất cả ({section.total_products})</span>
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </Link>
        )}
      </div>

      {/* Products Grid */}
      {section.products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
          Chưa có sản phẩm nào khả dụng trong danh mục này tại chi nhánh đã chọn.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {section.products.map((product) => (
            <ProductCard key={product.id} product={mapApiProduct(product)} />
          ))}
        </div>
      )}
    </section>
  );
}
export default CatalogSection;
