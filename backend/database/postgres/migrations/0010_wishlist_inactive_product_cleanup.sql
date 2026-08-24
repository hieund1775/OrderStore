-- Migration 0010: Cleanup wishlists pointing to inactive/unavailable products and notify affected customers

-- 1. Notify affected customers about inactive wishlist products being removed
INSERT INTO notifications (user_id, type, title, body, link, is_read, created_at)
SELECT DISTINCT
    w.user_id,
    'system',
    'Món yêu thích tạm ngưng phục vụ',
    'Món "' || p.name || '" trong danh sách yêu thích của bạn hiện đã tạm ngưng phục vụ và được tự động xóa khỏi danh sách.',
    '/menu',
    FALSE,
    NOW()
FROM wishlists w
JOIN products p ON p.id = w.product_id
JOIN users u ON u.id = w.user_id
WHERE p.is_available = FALSE AND u.is_admin = FALSE;

-- 2. Delete all wishlist rows pointing to inactive products
DELETE FROM wishlists
WHERE product_id IN (
    SELECT id FROM products WHERE is_available = FALSE
);
