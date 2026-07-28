import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TeaPlus API — Tiệm Trà Vườn Xanh',
      version: '1.0.0',
      description: 'API cho website bán trà trái cây: sản phẩm, đơn hàng, khách hàng, chi nhánh, khuyến mãi, kho, tuyển dụng, hội viên.',
    },
    servers: [{ url: 'http://localhost:5000', description: 'Dev server' }],
    tags: [
      // Public
      { name: 'Products', description: 'Thực đơn / Sản phẩm' },
      { name: 'Categories', description: 'Danh mục dòng trà' },
      { name: 'Options', description: 'Tùy chọn: size, đường, đá, topping' },
      { name: 'Stores', description: 'Chi nhánh' },
      { name: 'Promotions', description: 'Khuyến mãi' },
      { name: 'Jobs', description: 'Tuyển dụng' },
      { name: 'Tiers & Rewards', description: 'Hội viên & đổi thưởng' },
      { name: 'Users', description: 'Khách hàng (profile, wishlist, đơn hàng)' },
      { name: 'Reviews', description: 'Đánh giá sản phẩm' },
      { name: 'Search', description: 'Tìm kiếm' },
      // Admin
      { name: 'Dashboard', description: 'Admin — Tổng quan' },
      { name: 'Admin Orders', description: 'Admin — Quản lý đơn hàng' },
      { name: 'Admin Menu', description: 'Admin — Quản lý thực đơn' },
      { name: 'Admin Customers', description: 'Admin — Quản lý khách hàng' },
      { name: 'Admin Branches', description: 'Admin — Quản lý chi nhánh' },
      { name: 'Admin Promotions', description: 'Admin — Quản lý khuyến mãi' },
      { name: 'Admin Inventory', description: 'Admin — Quản lý kho' },
      { name: 'Admin Kitchen', description: 'Admin — Màn hình bếp (KDS)' },
      { name: 'Admin Reports', description: 'Admin — Báo cáo' },
      { name: 'Admin Settings', description: 'Admin — Cài đặt & nhật ký' },
      { name: 'Admin Notifications', description: 'Admin — Thông báo' },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;
