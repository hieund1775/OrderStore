-- Tiệm Trà Vườn Xanh — Database Schema (SQL Server / T-SQL)

IF DB_ID('teaplus_db') IS NOT NULL BEGIN
  ALTER DATABASE teaplus_db SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
  DROP DATABASE teaplus_db;
END;
GO
CREATE DATABASE teaplus_db;
GO
USE teaplus_db;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type = 'U')
CREATE TABLE users (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    fullname        NVARCHAR(120)   NOT NULL,
    phone           NVARCHAR(20)    NOT NULL UNIQUE,
    email           NVARCHAR(150)   NULL UNIQUE,
    password_hash   NVARCHAR(255)   NULL,
    avatar_url      NVARCHAR(500)   NULL,
    address         NVARCHAR(300)   NULL,
    tier            NVARCHAR(20)    NOT NULL DEFAULT N'Đồng' CHECK(tier IN (N'Đồng',N'Bạc',N'Vàng',N'Kim Cương')),
    points          INT             NOT NULL DEFAULT 0,
    total_spent     BIGINT          NOT NULL DEFAULT 0,
    is_admin        BIT             NOT NULL DEFAULT 0,
    admin_role      NVARCHAR(20)    NULL CHECK(admin_role IN ('super','manager','kitchen','cashier')),
    admin_branch_id INT             NULL,
    is_active       BIT             NOT NULL DEFAULT 1,
    created_at      DATETIME2       NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME2       NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[stores]') AND type = 'U')
CREATE TABLE stores (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(200) NOT NULL,
    city       NVARCHAR(100) NOT NULL,
    district   NVARCHAR(100) NOT NULL,
    address    NVARCHAR(300) NOT NULL,
    lat        DECIMAL(10,7) NULL,
    lng        DECIMAL(10,7) NULL,
    hours      NVARCHAR(100) NOT NULL,
    phone      NVARCHAR(20)  NOT NULL,
    amenities  NVARCHAR(MAX) NULL,
    is_active  BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[categories]') AND type = 'U')
CREATE TABLE categories (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(150) NOT NULL UNIQUE,
    slug       NVARCHAR(150) NOT NULL UNIQUE,
    sort_order INT NOT NULL DEFAULT 0,
    is_visible BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[products]') AND type = 'U')
CREATE TABLE products (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    category_id  INT NOT NULL REFERENCES categories(id),
    name         NVARCHAR(200) NOT NULL,
    slug         NVARCHAR(200) NOT NULL UNIQUE,
    base_tea     NVARCHAR(100) NOT NULL,
    description  NVARCHAR(MAX) NULL,
    price        INT NOT NULL,
    image_url    NVARCHAR(MAX) NULL,
    rating       DECIMAL(2,1) NOT NULL DEFAULT 0,
    review_count INT NOT NULL DEFAULT 0,
    calories     INT NOT NULL DEFAULT 0,
    fruit_group  NVARCHAR(100) NULL,
    tags         NVARCHAR(MAX) NULL,
    is_available BIT NOT NULL DEFAULT 1,
    created_at   DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at   DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[size_options]') AND type = 'U')
CREATE TABLE size_options (id INT IDENTITY(1,1) PRIMARY KEY, label NVARCHAR(50) NOT NULL, name NVARCHAR(100) NOT NULL, price_extra INT NOT NULL DEFAULT 0, sort_order INT NOT NULL DEFAULT 0);
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[base_options]') AND type = 'U')
CREATE TABLE base_options (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100) NOT NULL UNIQUE, sort_order INT NOT NULL DEFAULT 0);
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sugar_options]') AND type = 'U')
CREATE TABLE sugar_options (id INT IDENTITY(1,1) PRIMARY KEY, label NVARCHAR(50) NOT NULL UNIQUE, sort_order INT NOT NULL DEFAULT 0);
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ice_options]') AND type = 'U')
CREATE TABLE ice_options (id INT IDENTITY(1,1) PRIMARY KEY, label NVARCHAR(50) NOT NULL UNIQUE, sort_order INT NOT NULL DEFAULT 0);
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[toppings]') AND type = 'U')
CREATE TABLE toppings (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(150) NOT NULL, price INT NOT NULL, is_available BIT NOT NULL DEFAULT 1, sort_order INT NOT NULL DEFAULT 0);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tables]') AND type = 'U')
CREATE TABLE tables (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    store_id       INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name           NVARCHAR(100) NOT NULL,
    qr_code_token  NVARCHAR(100) NOT NULL UNIQUE,
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[promotions]') AND type = 'U')
CREATE TABLE promotions (
    id INT IDENTITY(1,1) PRIMARY KEY, title NVARCHAR(300) NOT NULL, type NVARCHAR(100) NOT NULL,
    code NVARCHAR(50) NULL, description NVARCHAR(MAX) NULL, [rule] NVARCHAR(MAX) NULL, emoji NVARCHAR(10) NULL,
    discount_value INT NULL, discount_type NVARCHAR(20) NULL CHECK(discount_type IN ('percent','fixed')),
    voucher_type NVARCHAR(30) NOT NULL DEFAULT 'time_bounded' CHECK(voucher_type IN ('single_use','time_bounded')),
    usage_limit INT NULL, used_count INT NOT NULL DEFAULT 0,
    max_discount INT NULL, min_order INT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
    status NVARCHAR(30) NOT NULL DEFAULT N'Lên lịch' CHECK(status IN (N'Sắp diễn ra',N'Đang diễn ra',N'Đã kết thúc',N'Lên lịch',N'Đang chạy',N'Kết thúc')),
    audience NVARCHAR(200) NULL, scope NVARCHAR(200) NULL, is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);
CREATE UNIQUE NONCLUSTERED INDEX UQ_promotions_code ON promotions(code) WHERE code IS NOT NULL;

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[promotion_stores]') AND type = 'U')
CREATE TABLE promotion_stores (
    id INT IDENTITY(1,1) PRIMARY KEY, promotion_id INT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES stores(id), UNIQUE(promotion_id, store_id)
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[orders]') AND type = 'U')
CREATE TABLE orders (
    id INT IDENTITY(1,1) PRIMARY KEY, order_code NVARCHAR(20) NOT NULL UNIQUE,
    user_id INT NULL REFERENCES users(id), store_id INT NOT NULL REFERENCES stores(id),
    table_id INT NULL REFERENCES tables(id), location_name NVARCHAR(200) NULL,
    order_type NVARCHAR(20) NOT NULL DEFAULT 'Take-away' CHECK(order_type IN ('Delivery','Take-away','POS')),
    payment_method NVARCHAR(20) NOT NULL DEFAULT 'COD' CHECK(payment_method IN ('COD','VietQR','MoMo','ZaloPay')),
    payment_status NVARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','paid','expired')),
    payment_provider NVARCHAR(30) NULL,
    payment_link_id NVARCHAR(100) NULL,
    payos_order_code BIGINT NULL,
    transaction_id NVARCHAR(100) NULL,
    payment_created_at DATETIME NULL,
    payment_expires_at DATETIME NULL,
    paid_at DATETIME NULL,
    paid_verified_by INT NULL,
    customer_name NVARCHAR(120) NOT NULL, customer_phone NVARCHAR(20) NOT NULL,
    delivery_addr NVARCHAR(300) NULL, voucher_code NVARCHAR(50) NULL,
    discount_amount INT NOT NULL DEFAULT 0, points_used INT NOT NULL DEFAULT 0, points_earned INT NOT NULL DEFAULT 0,
    subtotal INT NOT NULL, total INT NOT NULL,
    shipping_driver_name NVARCHAR(120) NULL,
    shipping_driver_phone NVARCHAR(20) NULL,
    shipping_tracking_url NVARCHAR(500) NULL,
    cancel_token_hash CHAR(64) NULL,
    is_printed BIT NOT NULL DEFAULT 0, kitchen_notified_at DATETIME2 NULL,
    note NVARCHAR(500) NULL, cancel_reason NVARCHAR(300) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(), updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[voucher_usage_history]') AND type = 'U')
CREATE TABLE voucher_usage_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    promotion_id INT NOT NULL REFERENCES promotions(id),
    user_phone NVARCHAR(20) NOT NULL,
    order_id INT NOT NULL REFERENCES orders(id),
    used_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[order_items]') AND type = 'U')
CREATE TABLE order_items (
    id INT IDENTITY(1,1) PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id), product_name NVARCHAR(200) NOT NULL,
    qty INT NOT NULL DEFAULT 1, size_label NVARCHAR(50) NOT NULL, base_tea NVARCHAR(100) NOT NULL,
    sugar_level NVARCHAR(50) NOT NULL, ice_level NVARCHAR(50) NOT NULL,
    note NVARCHAR(300) NULL, unit_price INT NOT NULL, line_total INT NOT NULL
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[order_item_toppings]') AND type = 'U')
CREATE TABLE order_item_toppings (
    id INT IDENTITY(1,1) PRIMARY KEY, order_item_id INT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    topping_name NVARCHAR(150) NOT NULL, topping_price INT NOT NULL
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[order_status_history]') AND type = 'U')
CREATE TABLE order_status_history (
    id INT IDENTITY(1,1) PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status NVARCHAR(30) NOT NULL CHECK(status IN (N'Chờ xác nhận',N'Đã xác nhận',N'Đang chuẩn bị',N'Đang giao',N'Hoàn thành',N'Đã hủy')),
    note NVARCHAR(300) NULL, changed_by INT NULL REFERENCES users(id),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[reviews]') AND type = 'U')
CREATE TABLE reviews (
    id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
    product_id INT NOT NULL REFERENCES products(id), order_item_id INT NULL REFERENCES order_items(id),
    rating TINYINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment NVARCHAR(MAX) NULL, image_urls NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_review UNIQUE(user_id, product_id, order_item_id)
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[wishlists]') AND type = 'U')
CREATE TABLE wishlists (
    id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(), CONSTRAINT UQ_wishlist UNIQUE(user_id, product_id)
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[rewards]') AND type = 'U')
CREATE TABLE rewards (
    id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(200) NOT NULL, emoji NVARCHAR(10) NULL,
    points_cost INT NOT NULL, type NVARCHAR(20) NOT NULL CHECK(type IN ('voucher','topping','upsize','product','merchandise')),
    value INT NULL, stock INT NULL, is_active BIT NOT NULL DEFAULT 1, created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[point_transactions]') AND type = 'U')
CREATE TABLE point_transactions (
    id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL, type NVARCHAR(20) NOT NULL CHECK(type IN ('earn','redeem','expire','admin')),
    source NVARCHAR(200) NULL, note NVARCHAR(300) NULL, created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[user_vouchers]') AND type = 'U')
CREATE TABLE user_vouchers (
    id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
    promotion_id INT NULL REFERENCES promotions(id), code NVARCHAR(50) NOT NULL,
    used_at DATETIME2 NULL, expires_at DATE NULL, created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[jobs]') AND type = 'U')
CREATE TABLE jobs (
    id INT IDENTITY(1,1) PRIMARY KEY, title NVARCHAR(200) NOT NULL, type NVARCHAR(100) NOT NULL,
    salary NVARCHAR(150) NOT NULL, description NVARCHAR(MAX) NOT NULL,
    requirements NVARCHAR(MAX) NOT NULL, benefits NVARCHAR(MAX) NULL,
    is_active BIT NOT NULL DEFAULT 1, created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[job_stores]') AND type = 'U')
CREATE TABLE job_stores (id INT IDENTITY(1,1) PRIMARY KEY, job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, store_id INT NOT NULL REFERENCES stores(id), UNIQUE(job_id, store_id));

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[job_applications]') AND type = 'U')
CREATE TABLE job_applications (
    id INT IDENTITY(1,1) PRIMARY KEY, job_id INT NOT NULL REFERENCES jobs(id), store_id INT NULL REFERENCES stores(id),
    fullname NVARCHAR(120) NOT NULL, phone NVARCHAR(20) NOT NULL, email NVARCHAR(150) NOT NULL, cv_url NVARCHAR(500) NULL,
    status NVARCHAR(30) NOT NULL DEFAULT N'Mới' CHECK(status IN (N'Mới',N'Đang xem xét',N'Phỏng vấn',N'Trúng tuyển',N'Từ chối')),
    note NVARCHAR(MAX) NULL, created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ingredients]') AND type = 'U')
CREATE TABLE ingredients (
    id INT IDENTITY(1,1) PRIMARY KEY, store_id INT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name NVARCHAR(200) NOT NULL, kind NVARCHAR(20) NOT NULL DEFAULT 'fresh' CHECK(kind IN ('fresh','canned','dry','other')),
    unit NVARCHAR(20) NOT NULL, stock DECIMAL(10,2) NOT NULL DEFAULT 0, safe_level DECIMAL(10,2) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(), updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ingredient_logs]') AND type = 'U')
CREATE TABLE ingredient_logs (
    id INT IDENTITY(1,1) PRIMARY KEY, ingredient_id INT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    change_amount DECIMAL(10,2) NOT NULL, reason NVARCHAR(200) NOT NULL,
    reference NVARCHAR(200) NULL, created_by INT NULL REFERENCES users(id),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[notifications]') AND type = 'U')
CREATE TABLE notifications (
    id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NULL REFERENCES users(id) ON DELETE CASCADE,
    type NVARCHAR(20) NOT NULL CHECK(type IN ('order','voucher','news','stock','staff','payment','system')),
    title NVARCHAR(300) NOT NULL, body NVARCHAR(MAX) NULL, is_read BIT NOT NULL DEFAULT 0,
    link NVARCHAR(500) NULL, created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[audit_logs]') AND type = 'U')
CREATE TABLE audit_logs (
    id INT IDENTITY(1,1) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id),
    action NVARCHAR(200) NOT NULL, detail NVARCHAR(MAX) NULL,
    ip_address NVARCHAR(45) NULL, user_agent NVARCHAR(300) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[tier_rules]') AND type = 'U')
CREATE TABLE tier_rules (
    id INT IDENTITY(1,1) PRIMARY KEY, tier NVARCHAR(20) NOT NULL UNIQUE CHECK(tier IN (N'Đồng',N'Bạc',N'Vàng',N'Kim Cương')),
    min_points INT NOT NULL DEFAULT 0, discount_percent INT NOT NULL DEFAULT 0,
    freeship_km DECIMAL(5,1) NULL, birthday_gift NVARCHAR(200) NULL, description NVARCHAR(MAX) NULL
);
GO

-- ═══════════ PHASE 2 PERFORMANCE INDEXES ═══════════
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_store_payment_created' AND object_id = OBJECT_ID('orders'))
    CREATE NONCLUSTERED INDEX IX_orders_store_payment_created ON orders (store_id, payment_status, created_at DESC, id DESC) INCLUDE (order_code, total, order_type, table_id, payment_provider);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_payment_expiry' AND object_id = OBJECT_ID('orders'))
    CREATE NONCLUSTERED INDEX IX_orders_payment_expiry ON orders (payment_provider, payment_status, payment_expires_at) INCLUDE (order_code);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_user_created' AND object_id = OBJECT_ID('orders'))
    CREATE NONCLUSTERED INDEX IX_orders_user_created ON orders (user_id, created_at DESC, id DESC) INCLUDE (order_code, store_id, total, payment_status, payment_provider, order_type);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_status_history_order_created' AND object_id = OBJECT_ID('order_status_history'))
    CREATE NONCLUSTERED INDEX IX_order_status_history_order_created ON order_status_history (order_id, created_at DESC, id DESC) INCLUDE (status, note, changed_by);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_items_order_id' AND object_id = OBJECT_ID('order_items'))
    CREATE NONCLUSTERED INDEX IX_order_items_order_id ON order_items (order_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_item_toppings_item_id' AND object_id = OBJECT_ID('order_item_toppings'))
    CREATE NONCLUSTERED INDEX IX_order_item_toppings_item_id ON order_item_toppings (order_item_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_voucher_usage_promotion_phone' AND object_id = OBJECT_ID('voucher_usage_history'))
    CREATE NONCLUSTERED INDEX IX_voucher_usage_promotion_phone ON voucher_usage_history (promotion_id, user_phone);
GO

PRINT N'✅ Schema created successfully';
