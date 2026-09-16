# Catalog lanes and two-block product configuration

## Goal

Keep the existing customer catalog and preorder experience unchanged while making operational work easier to observe. Admin users manage products through explicit **Kitchen** and **Packing** lanes, without removing the existing product-type (industry) structure.

## Concepts and ownership

| Concept | Purpose | Does not control |
| --- | --- | --- |
| Product type / industry | Owns the catalog hierarchy and option definitions. Examples: Coffee, Apparel. | Which operational screen receives an individual product. |
| Category and subcategory | Organizes products for customers. A category can be published or unpublished as a group. | Checkout or handover behaviour. |
| Product | Has the explicit fulfillment lane selected by an admin: `kitchen` or `packing`. A product can be stopped independently. | Options belonging to another product type. |
| Fulfillment lane | Selects the internal work screen only: Kitchen or Packing. | Customer-facing Menu and Preorder visibility. |

An industry is never implicitly converted into a fulfillment lane. A Coffee product can be explicitly assigned to Kitchen, and an Apparel product can be explicitly assigned to Packing. The lane selector is visible at the point an admin creates or manages catalog records.

## Catalog administration

The Catalog administration screen keeps the existing industry-first workflow:

`Industry -> subcategory -> product -> options`

It adds a clear two-choice operational selector:

`Kitchen | Packing`

The selector scopes the administrative list and creation actions:

- Selecting Kitchen shows only Kitchen categories/products and creates records with `kitchen` as their explicit lane.
- Selecting Packing shows only Packing categories/products and creates records with `packing` as their explicit lane.
- Existing records without an explicit product lane remain readable through the existing legacy resolver, but any new or edited product must persist an explicit lane. This avoids a silent or accidental industry-based route.
- A category/subcategory publish switch governs all products below it for customer visibility. An unpublished category is not offered to customers.
- A product-level `stop selling` switch remains available for a single product while its category stays published.
- Customer Menu and Preorder continue to show all published, sellable products regardless of lane. Lane is never a customer-facing filter.

## Product options

The catalog editor exposes exactly two option blocks. Block 3 is removed from the admin workflow.

- Block 1 and Block 2 retain their current flexible option semantics (required/optional, value pricing, selection rules).
- Option definitions and option values are scoped to one industry. They cannot be reused by a different industry.
- An industry may have no option block; products in it remain valid and purchasable with no options.
- Product-specific assignments remain configurable inside their industry. Examples:
  - Coffee: Block 1 ice amount; Block 2 size with price adjustments.
  - Apparel: Block 1 clothing size; Block 2 colour, logo, or printing add-ons.

## Fulfillment screens and handover

Kitchen and Packing are separate operational screens backed by the existing fulfillment task lanes. Checkout, payment, order creation, and preorder rules remain unchanged.

For each paid order, line items are split by their explicit product lane:

- Kitchen receives only Kitchen items.
- Packing receives only Packing items.
- An order containing both creates one task in each lane.

Both screens use the same safe task progression already supported by the backend:

`pending -> preparing -> ready -> completed`

The Packing UI presents this in the requested operational language:

1. **Đóng gói**: pending/preparing task work.
2. **Shipper**: a ready task can be handed over only after every non-cancelled task of that order is ready or completed.
3. **Hoàn thành**: delivery completion remains the existing order-level completion event.

For a one-lane order, its lane screen can perform the shipper handover. For a mixed Kitchen/Packing order, the handover action stays disabled with a clear `Chờ khâu còn lại` explanation until both tasks are ready. The actual handover is guarded atomically, so it can happen once only and cannot advance the order while another lane is unfinished.

The existing Packing UI must be corrected to pass through `ready` before `completed`; it must not send an invalid direct `preparing -> completed` transition.

## Non-goals and safety boundaries

- No change to customer Menu, Preorder checkout, payment/P1 reconciliation, authentication, or review logic.
- No new database migration is required: the current schema already contains explicit product/category lane fields and fulfillment tasks.
- No automatic reclassification of historical products by industry.
- No customer-visible lane terminology.

## Acceptance criteria

1. Admin can switch between Kitchen and Packing when managing categories/products and every new or edited product stores the selected explicit lane.
2. Industry hierarchy and per-industry option scoping remain intact; the editor contains exactly two option blocks.
3. Category publishing and product-level stop-selling behavior work independently as specified.
4. Kitchen and Packing lists never show the other lane's items.
5. Mixed-lane orders cannot be handed to a shipper until all lane tasks are ready/completed.
6. The packing task UI follows valid transitions and retains existing role/branch access checks.
7. Customer Menu and Preorder remain lane-neutral and keep their existing checkout behavior.
