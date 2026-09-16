# Catalog lane navigation design

## Decision

Catalog management is split into two independent routes:

- `/admin/catalog/kitchen` for Kitchen industries, categories, products, and two option blocks.
- `/admin/catalog/packing` for Packing industries, categories, products, and two option blocks.

The sidebar item **Sản phẩm & Danh mục** is an expandable parent only. It does not open a combined catalog screen.

Operational queues remain separate and unchanged:

- `/admin/bep` is the Kitchen queue.
- `/admin/dong-goi` is the Packing queue.

## Lane ownership

An industry has one immutable catalog lane at creation time: `kitchen` or `packing`.
It appears only in its assigned catalog route. Categories and products created below it inherit that lane and cannot be reassigned across lanes through editing.

This deliberately avoids shared industries and avoids automatically expanding every industry into both screens. Existing data with no explicit lane is treated as Kitchen for backwards compatibility, but is displayed only in the Kitchen catalog route.

## Catalog workflow

Each lane route enforces the same sequence:

1. Create industry in the current lane.
2. Create subcategory under that industry.
3. Create product in that subcategory.
4. Configure Block 1 and Block 2 options.

Block 3 remains retired. Historical presets remain stored but are not used in public option resolution.

## UI and API boundaries

The current lane is derived from the route, not a mutable in-page switch. The API receives the fixed lane for all reads and writes. Invalid attempts to create, move, or edit a category/product across its industry lane return a validation error.

Customer Menu and Preorder continue to read all visible, sellable products regardless of fulfillment lane.

## Verification

Tests must cover route-derived lane filtering, no cross-lane industry visibility, lane inheritance for new categories/products, legacy Kitchen fallback, and the unchanged Kitchen/Packing operational queue links.
