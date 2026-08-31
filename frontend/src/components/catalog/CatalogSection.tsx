import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
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

  // Group products by subcategory
  const subcategoryGroups = useMemo(() => {
    const groups: { id: number | string; name: string; slug?: string; products: typeof section.products }[] = [];
    const productsByCatId = new Map<number | string, typeof section.products>();

    for (const prod of section.products) {
      const catId = prod.category_id || 'other';
      if (!productsByCatId.has(catId)) {
        productsByCatId.set(catId, []);
      }
      productsByCatId.get(catId)!.push(prod);
    }

    // Order by defined section children if available
    if (section.children && section.children.length > 0) {
      for (const child of section.children) {
        const prods = productsByCatId.get(child.id);
        if (prods && prods.length > 0) {
          groups.push({
            id: child.id,
            name: child.name,
            slug: child.slug,
            products: prods,
          });
          productsByCatId.delete(child.id);
        }
      }
    }

    // Any remaining products
    for (const [catId, prods] of productsByCatId.entries()) {
      if (prods.length > 0) {
        groups.push({
          id: catId,
          name: prods[0].category_name || 'Khác',
          slug: prods[0].category_slug,
          products: prods,
        });
      }
    }

    return groups;
  }, [section.products, section.children]);

  return (
    <section className="space-y-5 py-6 border-b last:border-b-0">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {section.root_name}
            </h2>
            <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5 ml-1">
              {section.total_products} sản phẩm
            </Badge>
          </div>
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

      {/* Products Display (Grouped by Subcategory if multiple subcategories exist) */}
      {section.products.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
          Chưa có sản phẩm nào khả dụng trong danh mục này tại chi nhánh đã chọn.
        </div>
      ) : subcategoryGroups.length > 1 ? (
        <div className="space-y-6">
          {subcategoryGroups.map((group) => (
            <div key={group.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3.5 w-1 bg-primary rounded-full" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {group.name}
                </h3>
                <span className="text-[11px] text-muted-foreground/70 font-medium">({group.products.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.products.map((product) => (
                  <ProductCard key={product.id} product={mapApiProduct(product)} />
                ))}
              </div>
            </div>
          ))}
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
