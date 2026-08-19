export function toReviewDto(review) {
  if (!review) return null;
  let parsedImages = null;
  if (review.image_urls) {
    if (Array.isArray(review.image_urls)) {
      parsedImages = review.image_urls;
    } else {
      try {
        parsedImages = JSON.parse(review.image_urls);
      } catch {
        parsedImages = [String(review.image_urls)];
      }
    }
  }

  return {
    id: Number(review.id),
    user_id: Number(review.user_id),
    user_name: review.user_name || review.fullname || undefined,
    user_avatar: review.user_avatar || review.avatar_url || undefined,
    product_id: Number(review.product_id),
    order_item_id: review.order_item_id == null ? null : Number(review.order_item_id),
    rating: Number(review.rating),
    comment: review.comment || null,
    image_urls: parsedImages,
    created_at: review.created_at,
  };
}

export function toWishlistDto(item) {
  if (!item) return null;
  return {
    id: Number(item.id),
    user_id: Number(item.user_id),
    product_id: Number(item.product_id),
    product_name: item.product_name || item.name || undefined,
    product_slug: item.product_slug || item.slug || undefined,
    price: item.price == null ? undefined : Number(item.price),
    image_url: item.image_url || undefined,
    created_at: item.created_at,
  };
}

export function toJobDto(job) {
  if (!job) return null;
  return {
    id: Number(job.id),
    title: job.title,
    department: job.department || null,
    location: job.location || null,
    type: job.type || null,
    description: job.description || null,
    requirements: job.requirements || null,
    is_active: job.is_active !== false,
    created_at: job.created_at,
  };
}
