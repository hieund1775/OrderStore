# 🍹 Fresh Fruit Juice & Smoothie Bar — Complete Lovable Prompt

Build a modern, vibrant e-commerce website for a fresh fruit juice & smoothie bar called **"JuiceBox"**. The brand focuses on fresh-pressed juices, fruit smoothies, detox drinks, and fruit-based desserts. Design should feel fresh, colorful, tropical, and energetic.

---

## TECH STACK
- React + TypeScript
- Tailwind CSS
- React Router v6
- Lucide React icons (or any icon set)
- shadcn/ui components
- Framer Motion for animations

---

## DESIGN DIRECTION
- **Vibe:** Tropical peach orchard, fresh-pressed, warm sunset vibes, Instagram-worthy
- **Palette:** Peach (#FD8A6E) primary, coral pink (#FF6B6B) accent, mint green (#4ECDC4) secondary, cream (#FFF8F0) background, warm yellow (#FFE0B2) highlight. Think sunset peach grove — warm, juicy, inviting.
- **Gradients:** peach-to-coral for hero/CTA, peach-to-cream for cards, green-to-mint for detox/healthy sections
- **Typography:** Poppins (headings), Inter (body)
- **Shapes:** Rounded corners (16-24px), organic blob shapes, circular elements
- **Imagery:** Colorful fruit photos, splashing juice effects, tropical leaves decoration
- **Animations:** Subtle float animations on fruit icons, smooth page transitions, scroll-reveal on cards, bouncy add-to-cart

---

## SITEMAP & ROUTING

```
/                  → Homepage
/menu              → Full Menu (juices, smoothies, detox, bowls, snacks)
/stores            → Store Locator
/about             → Our Story
/events            → Promotions & Events
/membership        → Loyalty Program
/cart              → Shopping Cart
/checkout          → Checkout
/order/:id         → Order Tracking
/profile           → User Profile
/profile/orders    → Order History
/profile/wishlist  → Favorites
```

---

## GLOBAL COMPONENTS

### 1. Navbar (Sticky, glassmorphism on scroll)
- **Left:** Logo (🍑 JuiceBox) — peach-to-coral gradient text
- **Center (desktop):** Nav links — Menu, Stores, Events, Membership
- **Right:** Search icon (opens search modal), Wishlist ❤️ (badge), Cart 🛒 (badge with item count), Profile 👤 (dropdown: Profile, Orders, Logout / or Login modal)
- **Mobile:** Logo + Cart + Hamburger → slide-out drawer from right
- On scroll: background becomes white/80 with backdrop-blur-xl

### 2. Footer (4 columns)
- Brand info (logo, address, phone, email, business license)
- Policies (privacy, terms, delivery, returns)
- Social links (Instagram, Facebook, TikTok, Zalo)
- Newsletter signup + QR code for mobile app

### 3. Floating Action Buttons (fixed bottom-right)
- 📞 Phone call button
- 💬 Chat bubble (Messenger/Zalo)
- ⬆ Back to top (appears after scrolling 300px)

### 4. Mobile Bottom Cart Bar
- Visible only on mobile (<768px) when cart has items
- Shows: total items + total price + "View Cart" button
- Fixed to bottom, white background, border-top

### 5. Login/Register Modal
- Tabs: Login | Register
- Phone number input → Send OTP button → OTP input → Verify
- Divider "or continue with" → Google login button
- Mock: OTP is always 123456

### 6. Search Overlay
- Full-screen overlay with search input at top
- Real-time results as you type (debounced 300ms)
- Shows matching products with thumbnail, name, category, price
- Click result → navigate to /menu with that item highlighted

---

## PAGES — DETAILED SPECS

---

### 🏠 HOMEPAGE `/`

**1. Hero Section (Full viewport)**
- Animated gradient background (peach→coral→cream cycle every 8s)
- Floating fruit emojis (🍊🍋🍓🥝🍍🥭) with subtle float animation
- Large headline: "Fresh & Juicy" with a secondary line "Cold-pressed daily. Taste the sunshine."
- 2 CTA buttons: [Browse Menu →] (filled white) [Find Store 📍] (outlined white)
- Bottom wave SVG divider transitioning to cream background

**2. Category Quick-Pick Strip**
- 6 circular icons in a row (scrollable on mobile):
  - 🍊 Fresh Juices | 🥤 Smoothies | 🌿 Detox | 🍓 Berry Bowls | 🥑 Healthy Shots | 🍰 Desserts
  - Each is a white card with colored shadow, hover lifts up 8px

**3. Best Sellers Carousel**
- Horizontal scrollable row of product cards (4-5 visible, snap scroll)
- Each card: large fruit image, name, ⭐ rating, price, [Add +] button
- Hot items have a 🔥 badge, new items have a ✨ badge

**4. Promo Banner**
- Gradient coral→purple background
- "Summer Splash — Buy 2 Get 1 Free on all Smoothies!"
- [Claim Offer →] button

**5. Why JuiceBox Section**
- 4 feature cards in a grid:
  - 🍎 100% Fresh — Never from concentrate
  - 🚀 Fast Delivery — Within 30 minutes
  - 🌱 Eco-Friendly — Biodegradable cups & straws
  - ⭐ Top Rated — 4.8/5 from 2000+ reviews

**6. Customer Reviews Carousel**
- 3 review cards, auto-rotating
- Each: avatar, name, 5 stars, quote text

**7. Instagram Feed Teaser**
- Grid of 6 colorful drink photos
- "Follow us @juicebox.vn" overlay

**8. Final CTA**
- "Ready to refresh?" — large text
- [Order Now 🍹] big button

---

### 🧃 MENU PAGE `/menu` — THE CORE PAGE

**Desktop Layout:**
- **Left 75%:** Search bar + category filter tabs + product grid
- **Right 25%:** Sticky cart panel

**Category Filter Tabs (horizontal, sticky on scroll):**
```
[All] [Fresh Juices] [Smoothies] [Detox & Greens] [Berry Bowls] [Healthy Shots] [Desserts]
```
- Active tab has colored underline + bold text
- When "All" selected: show each category as a section with 1-2 rows + "View all →" link
- When specific category selected: show full grid of that category

**Product Card:**
```
┌──────────────────┐
│   [Fruit Image]  │  ← 200x200, object-cover, zoom on hover
│ 🔥 HOT           │  ← badge top-left
│           ♡      │  ← wishlist top-right (appears on hover)
│                  │
│ Mango Tango      │
│ ⭐ 4.8 (156)     │
│ 65,000đ          │  ← price in bold orange
│        [+]       │  ← bouncy add button
└──────────────────┘
```

**Product Detail Modal (opens on card click):**
```
┌──────────────────────────────────────────────┐
│                                       [✕]    │
│  ┌──────────┐                                │
│  │  Large   │  Mango Tango                   │
│  │  Fruit   │  ⭐ 4.8 (156 reviews)          │
│  │  Image   │  65,000đ                       │
│  │          │  Fresh mango blended with      │
│  │          │  coconut milk & a hint of lime │
│  └──────────┘                                │
│                                              │
│  SIZE           ○ S  ● M (+10k)  ○ L (+20k) │
│  SUGAR LEVEL    ○ 0% ○ 30% ● 50% ○ 70% ○ 100%│
│  ADD-ONS        ☑ Chia seeds (+5k)          │
│                  ☐ Protein boost (+10k)      │
│                  ☐ Coconut cream (+8k)       │
│                                              │
│  QUANTITY       [−]  2  [+]                 │
│  SPECIAL NOTE   [_________________]          │
│                                              │
│  Total: 70,000đ × 2 = 140,000đ              │
│                                              │
│  [Add to Cart]        [Buy Now →]           │
└──────────────────────────────────────────────┘
```
- Price updates in real-time when options change
- "Buy Now" → adds to cart + navigates to /checkout
- "Add to Cart" → adds + shows toast notification + closes modal

**Cart Panel (right sidebar, sticky):**
- Lists all cart items (thumbnail, name, options summary, qty +/- buttons, item price, remove ✕)
- Input for promo code
- Subtotal, discount, total
- [Checkout →] button

**On Mobile:** No sidebar. Cart accessed via bottom bar or /cart page.

---

### 🛒 CART PAGE `/cart`

- Full list of cart items with larger images (80x80)
- Each item: image, full name, size/sugar/add-ons listed, quantity stepper, line total, remove button
- Promo code input at top
- Order summary sidebar (sticky): subtotal, discount, delivery fee, total
- [Checkout →] button
- Empty state: cart icon + "Your cart is empty" + [Browse Menu] button
- [← Continue Shopping] link back to /menu

---

### 💳 CHECKOUT PAGE `/checkout`

**Requires login** — if not logged in, show login prompt

**Form sections:**
1. **Delivery Method:** Radio buttons — 🛵 Delivery | 🏪 Pickup at Store
2. **Contact Info:** Full name *, Phone *, Address * (if delivery), Store selection dropdown (if pickup)
3. **Promo & Points:** Promo code input, use loyalty points slider
4. **Payment Method:** Radio cards — 💵 Cash on Delivery | 📱 Bank Transfer (QR) | 🟣 MoMo | 🔵 ZaloPay

**Order Summary (right sidebar):**
- All items listed with prices
- Subtotal, delivery fee, discount, total
- [Place Order 🎉] button

**On submit:** Show loading state → generate order ID → navigate to `/order/:id`

---

### 📦 ORDER TRACKING `/order/:id`

- Order ID displayed prominently
- Status badge (color-coded: yellow=pending, blue=confirmed, purple=preparing, orange=delivering, green=completed, red=cancelled)
- **Timeline (vertical on mobile, horizontal on desktop):**
  - ⏳ Pending → ✅ Confirmed → 🔄 Preparing → 🛵 Out for Delivery → 🎉 Delivered
  - Completed steps: green with checkmark
  - Current step: orange with pulse animation
  - Future steps: grey
  - Each step shows timestamp if completed
- Order details: items list, delivery address, payment method, total
- [Cancel Order] button if status is "pending"

---

### 🏪 STORE LOCATOR `/stores`

- City filter dropdown → District filter dropdown
- [📍 Find Nearest Store] button (uses browser geolocation)
- **Google Maps embed** with store pins (iframe)
- Store cards below map:
  - Store name, full address, opening hours, phone number
  - [Get Directions →] button (opens Google Maps)
  - [Order from here →] button (goes to menu)

---

### 📖 ABOUT PAGE `/about`

**Professional, story-driven design:**

1. **Hero:** Large fruit splash image background, "Our Story" heading
2. **Mission & Vision:** 2-column layout with images, fade-in on scroll
3. **Stats counters:** 10+ Stores | 50K+ Customers | 100K+ Orders | 4.8★ Rating — numbers animate counting up
4. **Core Values:** 4 cards (Freshness, Creativity, Community, Sustainability) with icons
5. **Journey Timeline:** 2020→2025 milestones, vertical line with dots (horizontal scroll on mobile)
6. **Team photo section** (placeholder)
7. **CTA Banner:** "Come say hi 👋" → Store Locator

---

### 🎉 EVENTS PAGE `/events` + `/events/:id`

**Events List:**
- Grid of event cards with large banner images
- Status badges: 🟢 Ongoing | 🟡 Upcoming | ⚫ Ended
- Date range on each card
- Click → detail page

**Event Detail:**
- Hero banner, title, date range, status badge
- Full event description (rich text area)
- Applicable stores list
- [Save Voucher] button if ongoing

---

### 👥 MEMBERSHIP `/membership`

- Hero explaining points system: 1,000đ = 1 point
- **4 Tier Cards (side by side, responsive grid):**
  - 🌱 Seed (0-300pts) — 3% off
  - 🌿 Sprout (300-1000pts) — 5% off + birthday gift
  - 🌳 Tree (1000-3000pts) — 10% off + free delivery + priority
  - 💎 Forest (3000pts+) — 15% off + all perks + VIP events
- Each tier: icon, name, point range, discount %, perks list, distinct accent color
- **Rewards Redemption Section:**
  - Grid of reward cards (vouchers, merchandise, free drinks)
  - Each shows: image, name, points cost, [Redeem] button

---

### 👤 PROFILE PAGE `/profile`

**Layout:** Left sidebar menu + Right content area

**Sidebar tabs:**
- 👤 Personal Info
- 💳 My Membership
- 📦 Order History
- ❤️ Wishlist
- 🔔 Notifications

**Tab Contents:**
- **Personal Info:** Editable form (name, phone, email, default address) + [Save] button
- **My Membership:** Current tier card (large), progress bar to next tier, total points, QR code for in-store scanning (canvas/dummy)
- **Order History:** List of past orders with date, order ID, status badge, total. [Reorder] + [Rate] buttons for completed orders
- **Wishlist:** Grid of favorited products (ProductCards)
- **Notifications:** List of notifications (promos, order updates, vouchers), unread items highlighted

---

## PRODUCT DATA (Mock — 24 items)

Create a data file with these categories and sample items:

| Category | Items | Price Range |
|---|---|---|
| Fresh Juices | 4 items | 45k-65k |
| Smoothies | 5 items | 55k-75k |
| Detox & Greens | 3 items | 50k-65k |
| Berry Bowls | 3 items | 65k-85k |
| Healthy Shots | 3 items | 25k-40k |
| Desserts | 3 items | 30k-55k |
| Seasonal Specials | 3 items | 55k-75k |

Each product needs: id, name, category, price, image (use colorful gradient placeholder + fruit emoji), description, ingredients, calories, rating, reviews, sold count, tags (bestseller, new, hot)

---

## Add-ons / Customization Options
- Sizes: S (base price), M (+10k), L (+20k)
- Sugar level: 0%, 30%, 50%, 70%, 100%
- Extra add-ons from a list of 6-8 items (each +5-10k): chia seeds, protein powder, coconut cream, extra fruit, granola, honey drizzle, etc.

---

## DATA FLOW
- Use React Context for: Cart state (persisted to localStorage), Auth state
- All product/store/event data from local data files (src/data/)
- Cart: add/remove/update quantity/clear, auto-calculate subtotal
- Toast notifications for all actions (add to cart, place order, errors)

---

## RESPONSIVE BREAKPOINTS
- Mobile: < 768px (1-2 columns, hamburger menu, bottom cart bar)
- Tablet: 768-1024px (2-3 columns, simplified nav)
- Desktop: > 1024px (full layout, sidebar cart)

---

## KEY INTERACTIONS & STATES
Every data-driven component must handle:
1. **Loading state** — skeleton/spinner placeholder
2. **Empty state** — friendly illustration + message + action button
3. **Error state** — error message + retry button
4. **Success feedback** — toast notification after every action

---

## ANIMATION REQUIREMENTS
- Page transitions: fade + subtle slide up (Framer Motion AnimatePresence)
- Cards: stagger fade-in on scroll (Intersection Observer)
- Numbers: count-up animation (stats section)
- Buttons: scale on hover + tap
- Cart: slide-in from right (sidebar), slide-up (mobile bottom bar)
- Modals: scale + fade in, click-outside to close
- Toast: slide in from right, auto-dismiss 3s
