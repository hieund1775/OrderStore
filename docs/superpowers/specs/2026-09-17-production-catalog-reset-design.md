# Production Catalog Reset and Admin Regression Fix Design

## Goal

Remove the legacy test catalog from production, including test records that depend on it, and replace it with a small, coherent catalog that exercises the two fulfillment lanes. Fix TC-01 through TC-13 from `docs/Test Order.xlsx` so the expected tester flows are true after the reset.

## Scope

The reset is limited to catalog-derived test data and its direct test artifacts: products, category trees, product types and schemas, options/presets, media, product variants, wishlists, reviews, order items, and orders that contain the legacy catalog products. It must not modify users, stores, payment-provider configuration, or unrelated operational data.

The reset is a production-only, explicitly-confirmed operation. It must be implemented as a one-shot command that refuses to run unless it receives both an explicit production connection string and a confirmation flag. The command records preflight counts, makes a restorable database backup before mutation, and executes cleanup and replacement seeding in a transaction. It aborts if preflight finds a dependency outside the documented catalog-test graph.

## Data model and replacement catalog

The new data has no cross-lane relationship:

* Kitchen root: `Đồ uống`; child categories: `Trà trái cây`, `Trà sữa`, and `Cà phê`.
* Packing root: `Hàng đóng gói`; child categories: `Snack` and `Phụ kiện`.
* Every root, child, product type, product, product variant, option scope, and product has an explicit fulfillment lane. Kitchen entities use `kitchen`; packing entities use `packing`.
* Generated product imagery is stored as deployed static assets and each product receives an absolute public image URL. The database stores URLs only, never base64 image data.

The seed is deterministic, creates enough examples in every child category to test creation, editing, visibility, option scopes, and lane separation, and uses globally unique code, slug, and SKU values.

## Application changes

Catalog reads stay lane-scoped in the API and in the client. The selected root filter has three stable states: `all`, a valid root in the current lane, and a fallback to `all` only when the selected root disappears. A mutation reloads catalog data without changing that state.

Category/product creation inherits the active lane server-side and validates that a product's leaf category, product type, and fulfillment lane agree. Category and product slugs are derived from the display name on both create and rename, including Vietnamese diacritics; technical slug validation is not exposed to the admin flow.

Option creation and assignment is atomic. It validates against the category/product type before persisting and returns the new scope in the same successful response, preventing a failed toast with saved data or a scope appearing under another block/lane.

Promotions pagination uses semantic buttons with visible previous/next controls, disabled attributes, and a disabled cursor/state on the first and last pages.

## Error handling and safety

The reset command provides a dry-run mode, a dependency report, a backup location, and an execution receipt with deleted/created counts. It does not rely on browser actions. A production run requires a separate final confirmation after the dry run reports the exact counts.

All catalog endpoints return user-safe conflict messages. Duplicate active names/slugs give a clear business message; internal database/schema errors are logged server-side and are not rendered to administrators.

## Verification

Automated regression tests cover every TC except the visual styling detail of TC-06, which also receives a component test for the disabled controls. A dedicated integration rehearsal executes the reset against a guarded disposable database, asserts no legacy catalog rows remain, confirms the new catalog's lane isolation, then rolls back.

Production acceptance is: preflight and backup receipts are saved; the new Kitchen screen never shows packing entities; the new Packing screen never shows kitchen entities; testers can delete and recreate a category/product; option creation persists once in its intended block; root filters survive hide/show/edit actions; and pagination controls are disabled correctly at bounds.
