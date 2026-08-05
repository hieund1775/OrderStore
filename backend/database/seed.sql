-- Tiệm Trà Vườn Xanh — Seed Data (SQL Server)
USE teaplus_db;
GO

-- STORES
SET IDENTITY_INSERT stores ON;
INSERT INTO stores (id, name, city, district, address, lat, lng, hours, phone, amenities) VALUES
(1,N'Vườn Xanh – Nguyễn Huệ',N'TP. Hồ Chí Minh',N'Quận 1',N'125 Nguyễn Huệ, P. Bến Nghé, Quận 1',10.773,106.703,N'07:00 – 22:30','028 3822 1188',N'["Chỗ đỗ ô tô","Máy lạnh","Mua mang đi"]'),
(2,N'Vườn Xanh – Võ Văn Tần',N'TP. Hồ Chí Minh',N'Quận 3',N'88 Võ Văn Tần, P.6, Quận 3',10.7735,106.687,N'07:30 – 22:00','028 3930 6677',N'["Máy lạnh","Mua mang đi","Giao hàng 24/7"]'),
(3,N'Vườn Xanh – Phú Mỹ Hưng',N'TP. Hồ Chí Minh',N'Quận 7',N'R4-15 Hưng Phước, Phú Mỹ Hưng, Quận 7',10.73,106.72,N'08:00 – 23:00','028 5410 2299',N'["Chỗ đỗ ô tô","Không gian rộng","Máy lạnh"]'),
(4,N'Vườn Xanh – Hoàn Kiếm',N'Hà Nội',N'Hoàn Kiếm',N'12 Hàng Bài, P. Tràng Tiền, Hoàn Kiếm',21.0285,105.854,N'07:00 – 22:00','024 3936 5544',N'["Máy lạnh","Mua mang đi"]'),
(5,N'Vườn Xanh – Hải Châu',N'Đà Nẵng',N'Hải Châu',N'45 Bạch Đằng, Hải Châu 1, Hải Châu',16.067,108.221,N'07:30 – 22:30','0236 3812 345',N'["View sông Hàn","Chỗ đỗ ô tô","Máy lạnh"]');
SET IDENTITY_INSERT stores OFF;

-- TABLES
SET IDENTITY_INSERT tables ON;
INSERT INTO tables (id, store_id, name, qr_code_token, is_active) VALUES
(1, 1, N'Bàn 01 - Tầng 1', 'QR-STORE1-TBL01', 1),
(2, 1, N'Bàn 02 - Tầng 1', 'QR-STORE1-TBL02', 1),
(3, 1, N'Bàn 03 - Tầng 1', 'QR-STORE1-TBL03', 1),
(4, 1, N'Bàn 04 - Tầng 2', 'QR-STORE1-TBL04', 1),
(5, 1, N'Bàn 05 - Tầng 2', 'QR-STORE1-TBL05', 1),
(6, 2, N'Bàn 01 - Trệt',   'QR-STORE2-TBL01', 1),
(7, 2, N'Bàn 02 - Trệt',   'QR-STORE2-TBL02', 1);
SET IDENTITY_INSERT tables OFF;

-- USERS
SET IDENTITY_INSERT users ON;
INSERT INTO users (id,fullname,phone,email,password_hash,tier,points,total_spent,is_admin,admin_role,admin_branch_id) VALUES
(1,N'Nguyễn Hoàng Quân','0900 000 001','quan@travuonxanh.vn','$2b$10$wmXs8Y4ldFIIEBvAAAMY9ODPKLbz1.cMjzfO5ge5UVY8wSoMrLd0G',N'Kim Cương',0,0,1,'super',NULL),
(2,N'Trần Bảo Ngọc','0900 000 002','ngoc@travuonxanh.vn','$2b$10$wmXs8Y4ldFIIEBvAAAMY9ODPKLbz1.cMjzfO5ge5UVY8wSoMrLd0G',N'Kim Cương',0,0,1,'manager',1),
(3,N'Lý Thanh Tùng','0900 000 003','tung@travuonxanh.vn','$2b$10$wmXs8Y4ldFIIEBvAAAMY9ODPKLbz1.cMjzfO5ge5UVY8wSoMrLd0G',N'Kim Cương',0,0,1,'cashier',2),
(4,N'Hồ Mai Chi','0900 000 004','chi@travuonxanh.vn','$2b$10$wmXs8Y4ldFIIEBvAAAMY9ODPKLbz1.cMjzfO5ge5UVY8wSoMrLd0G',N'Kim Cương',0,0,1,'kitchen',3);
INSERT INTO users (id,fullname,phone,email,tier,points,total_spent) VALUES
(5,N'Nguyễn Minh Anh','0903 118 226','minhanh@gmail.com',N'Kim Cương',3240,12480000),
(6,N'Trần Quốc Bảo','0987 442 019','quocbao@gmail.com',N'Vàng',1780,6420000),
(7,N'Lê Thu Hà','0912 776 350','thuha@gmail.com',N'Bạc',640,2380000),
(8,N'Phạm Gia Huy','0934 220 118','giahuy@gmail.com',N'Đồng',120,680000),
(9,N'Đỗ Khánh Linh','0977 615 402','khanhlinh@gmail.com',N'Vàng',1520,5210000),
(10,N'Vũ Nhật Nam','0961 338 274','nhatnam@gmail.com',N'Đồng',50,580000);
SET IDENTITY_INSERT users OFF;

-- CATEGORIES
SET IDENTITY_INSERT categories ON;
INSERT INTO categories (id,name,slug,sort_order,is_visible) VALUES
(1,N'Trà Trái Cây Tươi','tra-trai-cay-tuoi',1,1),(2,N'Trà Đậm Vị','tra-dam-vi',2,1),
(3,N'Trà Trái Cây Tuyết','tra-trai-cay-tuyet',3,1),(4,'Hi-Tea Detox','hi-tea-detox',4,1),
(5,N'Bánh Ngọt Ăn Kèm','banh-ngot-an-kem',5,0);
SET IDENTITY_INSERT categories OFF;

-- PRODUCTS
SET IDENTITY_INSERT products ON;
INSERT INTO products (id,category_id,name,slug,base_tea,description,price,image_url,rating,review_count,calories,fruit_group,tags) VALUES
(1,1,N'Trà Cam Sả Mật Ong','tra-cam-sa',N'Cốt Lục Trà Lài',N'Vị chua dịu của cam vàng hòa cùng sả thơm mật ong rừng.',45000,'/src/assets/p-cam-sa.jpg',4.8,1240,180,N'Cam / Sả',N'["best-seller","seasonal"]'),
(2,1,N'Trà Dâu Tây Lài Thơm','tra-dau-tay',N'Cốt Lục Trà Lài',N'Dâu tây Đà Lạt dầm tươi quyện lục trà nhài thơm ngát.',55000,'/src/assets/p-dau-tay.jpg',4.9,2038,210,N'Dâu / Nho',N'["best-seller"]'),
(3,1,N'Trà Xoài Chanh Dây','tra-xoai-chanh-day',N'Trà Đen Đậm Vị',N'Xoài chín cắt khúc, chanh dây nguyên hạt, vị nhiệt đới rực rỡ.',52000,'/src/assets/p-xoai.jpg',4.7,864,230,N'Xoài / Chanh Dây',N'["new"]'),
(4,2,N'Ô Long Đào Vải','olong-dao-vai',N'Trà Ô Long',N'Đào ngâm giòn ngọt cùng vải thiều.',49000,'/src/assets/p-dao-vai.jpg',4.6,512,195,N'Đào / Vải',N'["seasonal"]'),
(5,3,N'Trà Tuyết Dưa Hấu Táo','tuyet-dua-hau',N'Lục Trà',N'Dưa hấu xay tuyết mát lạnh.',58000,'/src/assets/p-dua-hau.jpg',4.5,390,240,N'Dưa Hấu / Táo',N'["new","seasonal"]'),
(6,4,'Hi-Tea Nho Nha Đam','detox-nho-nha-dam',N'Lục Trà Không Đường',N'Nho mọng cùng nha đam giòn, ít đường.',54000,'/src/assets/p-nho.jpg',4.7,623,150,N'Dâu / Nho',N'["best-seller"]');
SET IDENTITY_INSERT products OFF;

-- OPTIONS
SET IDENTITY_INSERT size_options ON; INSERT INTO size_options (id,label,name,price_extra,sort_order) VALUES (1,'M',N'Size M (Chuẩn)',0,1),(2,'L',N'Size L (Lớn)',10000,2); SET IDENTITY_INSERT size_options OFF;
SET IDENTITY_INSERT base_options ON; INSERT INTO base_options (id,name,sort_order) VALUES (1,N'Lục Trà Lài',1),(2,N'Trà Ô Long',2),(3,N'Trà Đen',3); SET IDENTITY_INSERT base_options OFF;
SET IDENTITY_INSERT sugar_options ON; INSERT INTO sugar_options (id,label,sort_order) VALUES (1,N'0% (Không đường)',1),(2,'30%',2),(3,'50%',3),(4,'70%',4),(5,'100% (Mặc định)',5),(6,N'Ngọt tự nhiên từ trái cây',6); SET IDENTITY_INSERT sugar_options OFF;
SET IDENTITY_INSERT ice_options ON; INSERT INTO ice_options (id,label,sort_order) VALUES (1,N'Không đá',1),(2,'30%',2),(3,'50%',3),(4,'70%',4),(5,'100% (Mặc định)',5),(6,N'Đá riêng',6); SET IDENTITY_INSERT ice_options OFF;
SET IDENTITY_INSERT toppings ON; INSERT INTO toppings (id,name,price,sort_order) VALUES (1,N'Trái cây dầm tươi',10000,1),(2,N'Thạch nha đam',8000,2),(3,N'Thạch trái cây',8000,3),(4,N'Trân châu trắng',7000,4),(5,'Aloe Vera',9000,5),(6,'Macchiato kem cheese',12000,6); SET IDENTITY_INSERT toppings OFF;

-- PROMOTIONS
SET IDENTITY_INSERT promotions ON;
INSERT INTO promotions (id,title,type,code,[rule],emoji,discount_value,discount_type,max_discount,min_order,start_date,end_date,status,audience,scope) VALUES
(1,N'Mua 1 Tặng 1 Trà Cam Sả',N'Mua 1 Tặng 1','CAMSA11',N'Đơn tại quầy & online 14:00–17:00.','🍊',100,'percent',45000,45000,'2026-08-01','2026-08-31',N'Đang diễn ra',N'Tất cả khách hàng',N'Toàn chuỗi'),
(2,N'Giảm 30% Trà Trái Cây Tuyết',N'Giảm giá','SNOW30',N'Giảm tối đa 30.000₫.','🍉',30,'percent',30000,89000,'2026-08-01','2026-08-31',N'Đang diễn ra',N'Tất cả khách hàng',N'Toàn chuỗi'),
(3,N'Freeship 0đ Cuối Tuần','Freeship','FREESHIPW',N'Freeship 5km, hạng Bạc trở lên.','🚚',100,'percent',15000,0,'2026-08-05','2026-08-07',N'Đang diễn ra',N'Hạng Bạc trở lên',N'Toàn chuỗi'),
(4,N'Tặng Topping Trái Cây Dầm',N'Tặng topping','TOPPINGFREE',N'Tặng topping đơn từ 69.000₫.','🍓',NULL,NULL,NULL,69000,'2026-06-01','2026-06-30',N'Đã kết thúc',N'Tất cả khách hàng',N'Toàn chuỗi'),
(5,N'Flash Sale 15h Vàng','Flash Sale',NULL,N'Giảm giá 15:00–16:00.',NULL,NULL,NULL,NULL,NULL,'2026-07-01','2026-12-31',N'Đang chạy',N'Tất cả khách hàng',N'Toàn chuỗi'),
(6,N'Happy Hour Trà Tuyết','Happy Hour',NULL,N'T2–T6 · 14:00–16:00.',NULL,NULL,NULL,NULL,NULL,'2026-07-01','2026-12-31',N'Đang chạy',N'Hạng Bạc trở lên','Q1, Q3, Q7'),
(7,N'Mua 2 Tặng 1 Cam Sả',N'Mua 2 Tặng 1',NULL,N'Áp dụng cho khách mới.',NULL,NULL,NULL,NULL,NULL,'2026-08-01','2026-08-07',N'Lên lịch',N'Khách mới',N'Toàn chuỗi'),
(8,N'Combo Trà + Bánh 79K','Combo',NULL,N'Combo 1 trà + 1 bánh 79.000₫.',NULL,NULL,NULL,NULL,NULL,'2026-06-01','2026-06-30',N'Kết thúc',N'Tất cả khách hàng',N'Hà Nội, Đà Nẵng');
INSERT INTO promotions (id,title,type,code,[rule],emoji,discount_value,discount_type,max_discount,min_order,start_date,end_date,status,audience,scope,voucher_type) VALUES
(9,N'Mã 1 lần – Giảm 10%','Giảm giá','SINGLE10',N'Mã dùng 1 lần cho mỗi SĐT.','🎟️',10,'percent',10000,0,'2026-08-01','2026-08-31',N'Đang diễn ra',N'Tất cả khách hàng',N'Toàn chuỗi','single_use');
SET IDENTITY_INSERT promotions OFF;

-- ORDERS
SET IDENTITY_INSERT orders ON;
INSERT INTO orders (id,order_code,user_id,store_id,order_type,payment_method,customer_name,customer_phone,delivery_addr,subtotal,total,created_at) VALUES
(1,'VX26072801',5,1,'Delivery','MoMo',N'Nguyễn Minh Anh','0903 118 226',N'125 Nguyễn Huệ, P. Bến Nghé, Q1',158000,158000,'2026-07-28T15:24:00'),
(2,'VX26072802',6,2,'Take-away','VietQR',N'Trần Quốc Bảo','0987 442 019',NULL,104000,104000,'2026-07-28T15:18:00'),
(3,'VX26072803',7,3,'POS','COD',N'Lê Thu Hà','0912 776 350',NULL,232000,232000,'2026-07-28T15:02:00'),
(4,'VX26072804',8,1,'Delivery','ZaloPay',N'Phạm Gia Huy','0934 220 118',N'88 Võ Văn Tần, P.6, Q3',96000,96000,'2026-07-28T14:47:00'),
(5,'VX26072805',9,4,'Take-away','VietQR',N'Đỗ Khánh Linh','0977 615 402',NULL,143000,143000,'2026-07-28T14:12:00'),
(6,'VX26072806',10,5,'Delivery','COD',N'Vũ Nhật Nam','0961 338 274',N'45 Bạch Đằng, Hải Châu 1, Hải Châu',58000,58000,'2026-07-28T13:55:00');
SET IDENTITY_INSERT orders OFF;

-- ORDER ITEMS
SET IDENTITY_INSERT order_items ON;
INSERT INTO order_items (id,order_id,product_id,product_name,qty,size_label,base_tea,sugar_level,ice_level,unit_price,line_total) VALUES
(1,1,2,N'Trà Dâu Tây Lài Thơm',2,'L',N'Lục Trà Lài','50%','70%',73000,146000),
(2,1,1,N'Trà Cam Sả Mật Ong',1,'M',N'Lục Trà Lài','30%','100%',45000,45000),
(3,2,4,N'Ô Long Đào Vải',1,'M',N'Trà Ô Long','70%','100%',56000,56000),
(4,2,6,'Hi-Tea Nho Nha Đam',1,'L',N'Lục Trà','0%',N'Đá riêng',64000,64000),
(5,3,5,N'Trà Tuyết Dưa Hấu Táo',3,'L',N'Lục Trà','50%','100%',78000,234000),
(6,3,3,N'Trà Xoài Chanh Dây',1,'M',N'Trà Đen','100%','100%',52000,52000),
(7,4,1,N'Trà Cam Sả Mật Ong',2,'L',N'Lục Trà Lài','30%','100%',64000,128000),
(8,5,2,N'Trà Dâu Tây Lài Thơm',2,'M',N'Lục Trà Lài','70%','100%',67000,134000),
(9,6,5,N'Trà Tuyết Dưa Hấu Táo',1,'L',N'Lục Trà','50%','100%',58000,58000);
SET IDENTITY_INSERT order_items OFF;

SET IDENTITY_INSERT order_item_toppings ON;
INSERT INTO order_item_toppings (id,order_item_id,topping_name,topping_price) VALUES
(1,1,N'Thạch nha đam',8000),(2,3,N'Trân châu trắng',7000),(3,5,N'Trái cây dầm tươi',10000),(4,7,'Aloe Vera',9000),(5,8,'Macchiato kem cheese',12000);
SET IDENTITY_INSERT order_item_toppings OFF;

INSERT INTO order_status_history (order_id,status,created_at) VALUES
(1,N'Chờ xác nhận','2026-07-28T15:24:00'),(2,N'Đang chuẩn bị','2026-07-28T15:22:00'),(2,N'Đã xác nhận','2026-07-28T15:20:00'),(2,N'Chờ xác nhận','2026-07-28T15:18:00'),
(3,N'Đang chuẩn bị','2026-07-28T15:06:00'),(3,N'Đã xác nhận','2026-07-28T15:04:00'),(3,N'Chờ xác nhận','2026-07-28T15:02:00'),
(4,N'Đang giao','2026-07-28T15:00:00'),(4,N'Đang chuẩn bị','2026-07-28T14:52:00'),(4,N'Đã xác nhận','2026-07-28T14:50:00'),(4,N'Chờ xác nhận','2026-07-28T14:47:00'),
(5,N'Hoàn thành','2026-07-28T14:40:00'),(5,N'Đang chuẩn bị','2026-07-28T14:18:00'),(5,N'Đã xác nhận','2026-07-28T14:15:00'),(5,N'Chờ xác nhận','2026-07-28T14:12:00'),
(6,N'Đã hủy','2026-07-28T14:10:00'),(6,N'Chờ xác nhận','2026-07-28T13:55:00');

INSERT INTO wishlists (user_id,product_id) VALUES (5,2);
SET IDENTITY_INSERT rewards ON;
INSERT INTO rewards (id,name,emoji,points_cost,type,value,stock) VALUES
(1,N'Voucher giảm 20.000₫','🎟️',200,'voucher',20000,NULL),(2,N'Miễn phí Topping','🍒',120,'topping',NULL,NULL),
(3,N'Upsize Size L miễn phí','🥤',90,'upsize',NULL,NULL),(4,N'1 Ly Trà Cam Sả Size M','🍹',450,'product',NULL,NULL),
(5,N'Bình giữ nhiệt Vườn Xanh','🧊',1200,'merchandise',NULL,50),(6,N'Voucher giảm 100.000₫','💳',900,'voucher',100000,NULL);
SET IDENTITY_INSERT rewards OFF;
SET IDENTITY_INSERT tier_rules ON;
INSERT INTO tier_rules (id,tier,min_points,discount_percent,freeship_km,birthday_gift,description) VALUES
(1,N'Đồng',0,0,NULL,N'Ưu đãi sinh nhật 10%',N'Tích 1 điểm / 10.000₫'),
(2,N'Bạc',500,5,NULL,N'Tặng 1 topping / tháng',N'Giảm 5% mọi đơn'),
(3,N'Vàng',1500,10,3.0,N'Quà sinh nhật đặc biệt',N'Giảm 10% | Freeship 3km'),
(4,N'Kim Cương',3000,15,NULL,N'Bộ quà VIP',N'Giảm 15% | Freeship không giới hạn');
SET IDENTITY_INSERT tier_rules OFF;
SET IDENTITY_INSERT jobs ON;
INSERT INTO jobs (id,title,type,salary,description,requirements) VALUES
(1,N'Nhân viên Pha Chế (Barista)',N'Toàn thời gian',N'7–9 triệu + thưởng',N'Pha chế theo công thức chuẩn.',N'Từ 18 tuổi, ưu tiên 6 tháng KN F&B.'),
(2,N'Thu Ngân',N'Toàn thời gian / Ca linh hoạt',N'6.5–8 triệu',N'Tiếp nhận đơn, thanh toán, tư vấn.',N'Giao tiếp tốt, dùng được máy POS.'),
(3,N'Quản Lý Cửa Hàng',N'Toàn thời gian',N'12–18 triệu',N'Quản lý vận hành, nhân sự, doanh thu.',N'Tối thiểu 1 năm KN quản lý F&B.'),
(4,N'Nhân Viên Part-time',N'Bán thời gian (4h/ca)',N'25k–30k/giờ',N'Hỗ trợ pha chế, phục vụ.',N'Sinh viên, tối thiểu 4 ca/tuần.');
SET IDENTITY_INSERT jobs OFF;
SET IDENTITY_INSERT ingredients ON;
INSERT INTO ingredients (id,store_id,name,kind,unit,stock,safe_level) VALUES
(1,1,N'Cam vàng','fresh',N'kg',42,60),(2,1,N'Ổi ruột hồng','fresh',N'kg',9,40),(3,1,N'Táo Envy','fresh',N'kg',24,50),
(4,1,N'Dưa hấu','fresh',N'kg',0,45),(5,1,N'Dứa (thơm)','fresh',N'kg',33,40),(6,1,N'Dâu tây Đà Lạt','fresh',N'kg',6,30),
(7,1,'Pepsi Có Đường','canned',N'lon',240,300),(8,1,'Pepsi Không Đường','canned',N'lon',58,300),(9,1,N'Nha đam đóng hộp','canned',N'hộp',74,120);
SET IDENTITY_INSERT ingredients OFF;
SET IDENTITY_INSERT notifications ON;
INSERT INTO notifications (id,user_id,type,title,body,created_at) VALUES
(1,5,'voucher','Voucher SNOW30 đã vào ví',N'Giảm 30% Trà Trái Cây Tuyết.','2026-07-28T15:19:00'),
(2,5,'order',N'Đơn VX240712 đã giao',N'Đơn hàng đã giao thành công.','2026-07-28T13:00:00'),
(3,5,'news',N'Món mới: Trà Tuyết Dưa Hấu Táo',N'Ghé thử ngay tại Vườn Xanh!','2026-07-27T09:00:00');
SET IDENTITY_INSERT notifications OFF;
SET IDENTITY_INSERT audit_logs ON;
INSERT INTO audit_logs (id,user_id,action,detail,ip_address,user_agent,created_at) VALUES
(1,1,N'Cập nhật giá',N'Trà Cam Sả: 42k→45k','113.185.44.2','Chrome·macOS','2026-07-27T14:52:00'),
(2,2,N'Tạm ngưng bán',N'Trà Tuyết Dưa Hấu','171.244.10.88','Safari·iPad','2026-07-27T13:20:00'),
(3,1,N'Tạo khuyến mãi',N'Flash Sale 15h Vàng','113.185.44.2','Chrome·macOS','2026-07-26T09:11:00'),
(4,3,N'Hủy đơn hàng','VX26072806 – khách hủy','14.161.7.19','Chrome·Windows','2026-07-26T08:04:00');
SET IDENTITY_INSERT audit_logs OFF;

PRINT N'✅ Seed data imported';
