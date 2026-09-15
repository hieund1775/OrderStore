# Product Review Aggregates and Hard Delete

## Scope

Make product ratings and review counts authoritative, add the public aggregate review surface at the bottom of Menu and Preorder pages, and let an authorized administrator permanently delete an individual review thread.

This extends the existing public Review Hub and review moderation feature. It does not change checkout, preorder eligibility, payments, authentication, or database schema.

## Public surfaces

- Product cards and product details use the persisted product aggregate: average rating and count of **visible, purchase-verified** reviews across both normal and preorder purchases.
- A product without a visible verified review displays `5.0` and `0 đánh giá`; it must never fall back to a fabricated rating or count.
- The bottom of `/menu` shows the existing public aggregate review hub with all sources available.
- The bottom of `/dat-truoc` shows the same hub constrained to preorder reviews, so the context and list agree.
- Hiding or permanently deleting a review changes aggregates only for that review's product. A review for product A cannot change product B.

## Permanent deletion

The admin delete action is available only in the existing scoped moderation UI and uses the current admin role and branch authorization rules.

1. Lock the target review and obtain its product ID and attached media storage keys.
2. In one database transaction, clear the review's current-revision reference, delete the review, allow review replies, revisions and media rows to cascade, and recompute that product's visible verified rating and count.
3. Commit the transaction. The review is no longer available to customer, product, public-hub, or admin list APIs.
4. After commit, delete captured media objects through the existing review-storage adapter. A storage cleanup failure is logged with the review and storage-key identifiers but never restores or exposes the deleted review. This is required because PostgreSQL and object storage cannot share one transaction.

The action is deliberate and irreversible. It is distinct from Hide/Show: Hide preserves the thread for potential restoration; Delete removes it permanently.

## Aggregate rules

The canonical aggregate query includes only reviews where `visibility_status = 'visible'` and `purchase_verified_at IS NOT NULL`, using each review's current revision rating. It writes `products.rating` rounded to one decimal and `products.review_count`.

For zero matching reviews, the database aggregate is zero/zero. Presentation maps this to `5.0` / `0 đánh giá` only at the UI boundary.

The recomputation runs after create, edit, hide/show, and hard delete. All cases are transactionally tied to their review database mutation.

## API and error handling

- Add an explicit admin-only delete endpoint for one review.
- A nonexistent or out-of-scope review returns the existing not-found/forbidden behavior without revealing cross-branch data.
- A repeated delete is idempotently reported as not found; it never modifies another review.
- A media cleanup failure is server logged for operators; it does not make the deleted review readable again.

## Verification

- Repository/service tests prove cascade-safe hard deletion, product-specific recomputation, zero-review aggregate behavior, and scoped authorization.
- Public API tests prove hidden and deleted reviews do not appear, that normal/preorder filters remain correct, and that public DTOs contain no moderation or order identifiers.
- Frontend tests prove the no-review display is `5.0` / `0 đánh giá`, and that Menu and Preorder embed the appropriate hub mode.
- Run focused review tests, relevant menu/preorder tests, the full frontend suite where baseline allows, production build, and `git diff --check`.
