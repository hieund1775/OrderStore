# Implementation plan: explicit catalog lanes and Packing operations

## Scope and invariants

Implement the approved catalog-lane design without changing customer Menu, Preorder checkout, payment/P1 reconciliation, authentication, reviews, or database schema. Existing lane columns and fulfillment-task tables are sufficient.

All changes run on a feature branch. No migration, production mutation, merge, or deploy is part of implementation.

## Phase 1 — make Industry, category, and lane ownership explicit

### Backend

1. Update `backend/validation/catalog-v2-schemas.js` so category input accepts and validates `default_fulfillment_lane` as `kitchen`, `packing`, or `null`.
2. Update `backend/repositories/postgres/catalog-v2.js` so `createCategory` and `updateCategory` persist `default_fulfillment_lane`; current UI input must not be silently discarded.
3. Add an atomic `createIndustry` operation to the catalog service/repository:
   - Create one product type and its v1 schema.
   - Create the corresponding root category linked to that product type.
   - Root industries have no lane. The operation rolls back both records if either write fails.
4. Require a child category to inherit its parent industry/product type and to have an explicit lane. Reject a child whose supplied product type differs from its root industry.
5. Extend admin product reads with an optional validated `lane` filter. The SQL source of truth is `COALESCE(p.fulfillment_lane, c.default_fulfillment_lane)`; root categories remain visible as industry navigation, while child categories/products are filtered by the selected lane.
6. Require a product create/update to carry an explicit valid lane and verify it equals the selected leaf category's lane. Remove the hidden fallback from product-type defaults for newly written products. Legacy records remain readable through the existing resolver until edited.
7. Keep the ordinary category publishing rule in the database/public read path: a hidden category makes its descendants unavailable to customers. Do not mass-overwrite individual product `active/inactive` flags when toggling a category, so a manually stopped product stays stopped after its category is re-enabled.

### Admin Catalog UI

1. In `frontend/src/routes/admin.catalog.tsx`, replace the detached root/category setup with the explicit flow `Create industry -> create child category -> create product -> configure options`.
2. Provide a lane switch directly above the category/product work area: **Bếp** and **Đóng gói**. It does not change the selected industry.
3. Scope child-category table, product table, category selector, and create forms to the active lane.
4. A child category's lane is displayed and chosen explicitly; the product modal receives the active lane and cannot silently select another lane.
5. A product edit displays its lane. Moving a product to a category in another lane requires an explicit lane change and server validation; cross-lane moves cannot happen accidentally.

## Phase 2 — retain exactly two option blocks

1. Replace `CatalogOption3BlocksEditor` with a two-block editor (or remove its third block while retaining the stable public component contract):
   - Block 1: free/modifier choices.
   - Block 2: priced choices/variants.
2. Remove all Block 3 preset UI, state, requests, and write controls from admin catalog.
3. Retire Block 3 preset write/read routes with a deterministic `410 BLOCK_3_RETIRED` response, rather than leaving a hidden active feature.
4. Preserve historical preset rows for recovery, but modify `public-catalog-v2-service` to ignore category/product presets during option resolution. Only the two assignment/override blocks contribute to the customer configurator.
5. Keep option definitions, values, assignments, and overrides isolated by the industry's product-type schema. A product with no assigned options remains purchaseable and receives a default variant.

## Phase 3 — lane-safe fulfillment and Packing board

1. Preserve the existing task state machine:

   `pending -> preparing -> ready -> completed`

2. Add one shared service-level handover operation, used by Kitchen and Packing:
   - lock active tasks for the order;
   - validate the actor's role, branch, and lane access;
   - allow handover only if every non-cancelled task is `ready` or `completed`;
   - atomically perform the existing order transition to `Đang giao`, persist driver details, and finalise ready tasks;
   - reject a second handover with a conflict response.
3. Refactor the Kitchen handover path to use this shared operation. Existing single-kitchen order behavior and visible labels remain the same.
4. Rework `frontend/src/routes/admin.dong-goi.tsx` into three operational columns/tabs:
   - **Đóng gói**: pending and preparing packing tasks; actions `Bắt đầu đóng gói` then `Đã đóng gói` (`ready`).
   - **Shipper**: packing-ready orders. The handover control is disabled with `Chờ khâu còn lại` until all order tasks are ready/completed; otherwise it uses the same driver handover dialog/operation as Kitchen.
   - **Hoàn thành**: orders completed through the existing delivery completion flow.
5. Do not allow the old invalid direct transition `preparing -> completed` in the Packing UI.
6. A mixed Coffee/Apparel order creates separate Kitchen/Packing tasks as it does today; its single order-level handover is available exactly once after both tasks are ready.

## Phase 4 — tests and regression checks

### Backend

- Add catalog-lane contracts for category persistence, explicit product lane, lane filtering, industry/schema inheritance, and legacy read compatibility.
- Add option contracts proving Block 3 preset routes are retired and historical presets cannot prefill/lock customer options, while Blocks 1 and 2 remain scoped by product type.
- Add fulfillment contracts for task lane isolation, valid packing transition, one-lane handover, mixed-lane handover rejection before readiness, atomic single handover, and branch/role denial.
- Re-run catalog option resolution, root category navigation, fulfillment, kitchen, preorder, and payment characterization suites.

### Frontend

- Add tests for the Kitchen/Packing selector, lane-scoped category/product creation, product stop-selling versus category visibility, and the two-block-only editor.
- Add Packing board tests for its three display states, disabled mixed-order handover, and valid status requests.
- Run the full relevant Vitest suite and production build.

## Completion criteria

1. Admin observes and creates Kitchen/Packing records only in the selected operational workspace; industries are retained and never silently route products.
2. Menu and Preorder remain lane-neutral and work as before.
3. Only two option blocks are visible and applied; Block 3 is retired without deleting historical data.
4. Packing and Kitchen cannot hand an order to a shipper before all active fulfillment tasks are ready/completed.
5. No migration, payment, checkout, preorder lifecycle, or auth/review behavior changes.
