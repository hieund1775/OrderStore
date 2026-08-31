import { Link } from '@tanstack/react-router';
import type { PublicCategoryNode } from '@/lib/api';
import { isCategoryActive, isRootCategoryActive } from '@/lib/catalog-navigation';

interface MegaMenuGroupProps {
  root: PublicCategoryNode;
  subcategories: PublicCategoryNode[];
  currentCategorySlug?: string;
  onItemClick?: () => void;
}

export function MegaMenuGroup({
  root,
  subcategories,
  currentCategorySlug,
  onItemClick,
}: MegaMenuGroupProps) {
  const isRootActive = isRootCategoryActive(root, currentCategorySlug);

  return (
    <div className="flex flex-col space-y-2.5 min-w-[140px] max-w-[220px]">
      {/* Root Category Heading Link */}
      <Link
        to="/menu"
        search={(prev) => ({ ...prev, category: root.slug, page: undefined })}
        onClick={onItemClick}
        className={`group inline-flex items-center text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-sm py-0.5 ${
          isRootActive
            ? 'text-primary font-extrabold'
            : 'text-foreground/90 hover:text-primary'
        }`}
      >
        <span className="break-words line-clamp-2">{root.name}</span>
      </Link>

      {/* Subcategories Text Links List */}
      {subcategories.length > 0 && (
        <ul className="flex flex-col space-y-1.5 list-none p-0 m-0">
          {subcategories.map((child) => {
            const isChildActive = isCategoryActive(child.slug, currentCategorySlug);
            return (
              <li key={child.id} className="p-0 m-0">
                <Link
                  to="/menu"
                  search={(prev) => ({ ...prev, category: child.slug, page: undefined })}
                  onClick={onItemClick}
                  className={`block text-xs py-1 px-1.5 -mx-1.5 rounded-md transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary break-words ${
                    isChildActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {child.name}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
