export function toProductDto(product) {
  if (!product) return null;
  let parsedTags = [];
  if (product.tags) {
    if (Array.isArray(product.tags)) {
      parsedTags = product.tags;
    } else {
      try {
        parsedTags = JSON.parse(product.tags);
      } catch {
        parsedTags = [String(product.tags)];
      }
    }
  }

  return {
    id: Number(product.id),
    category_id: Number(product.category_id),
    name: product.name,
    slug: product.slug,
    price: Number(product.price || 0),
    base_tea: product.base_tea || null,
    description: product.description || null,
    image_url: product.image_url || null,
    calories: product.calories == null ? null : Number(product.calories),
    fruit_group: product.fruit_group || null,
    tags: parsedTags,
    rating: product.rating == null ? 5 : Number(product.rating),
    review_count: product.review_count == null ? 0 : Number(product.review_count),
    is_available: product.is_available !== false,
    category_name: product.category_name || undefined,
    category_slug: product.category_slug || undefined,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

export function toCategoryDto(category) {
  if (!category) return null;
  return {
    id: Number(category.id),
    name: category.name,
    slug: category.slug,
    icon: category.icon || null,
    sort_order: Number(category.sort_order || 0),
    is_visible: category.is_visible !== false,
    items: category.items == null ? undefined : Number(category.items),
    created_at: category.created_at,
    updated_at: category.updated_at,
  };
}

export function toOptionDto(option) {
  if (!option) return null;
  return {
    id: Number(option.id),
    name: option.name || option.label,
    label: option.label || option.name,
    price: option.price == null ? undefined : Number(option.price),
    price_extra: option.price_extra == null ? undefined : Number(option.price_extra),
    description: option.description || null,
    sort_order: option.sort_order == null ? undefined : Number(option.sort_order),
    is_available: option.is_available !== false,
    is_active: option.is_active !== false,
  };
}
