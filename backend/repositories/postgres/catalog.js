import postgresDb from '../../config/db-postgres.js';

const OPTION_QUERIES = Object.freeze({
  sizes: 'SELECT * FROM size_options ORDER BY sort_order',
  bases: 'SELECT * FROM base_options ORDER BY sort_order',
  sugars: 'SELECT * FROM sugar_options ORDER BY sort_order',
  ices: 'SELECT * FROM ice_options ORDER BY sort_order',
  toppings: 'SELECT * FROM toppings WHERE is_available = TRUE ORDER BY sort_order',
});

export function createCatalogRepository(database = postgresDb) {
  return {
    async listProducts({ category, search, tag } = {}) {
      let sql = `SELECT p.*, c.name AS category_name, c.slug AS category_slug
        FROM products p JOIN categories c ON p.category_id = c.id
        WHERE p.is_available = TRUE AND c.is_visible = TRUE`;
      const params = [];
      if (category) {
        params.push(category);
        sql += ` AND c.slug = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        const parameter = `$${params.length}`;
        sql += ` AND (p.name ILIKE ${parameter} OR p.description ILIKE ${parameter})`;
      }
      if (tag) {
        params.push(`%"${tag}"%`);
        sql += ` AND p.tags ILIKE $${params.length}`;
      }
      sql += ' ORDER BY c.sort_order, p.id';
      const [rows] = await database.query(sql, params);
      return rows;
    },

    async findProductBySlug(slug) {
      const [rows] = await database.query(
        `SELECT p.*, c.name AS category_name
         FROM products p JOIN categories c ON p.category_id = c.id
         WHERE p.slug = $1 LIMIT 1`,
        [slug],
      );
      return rows[0] || null;
    },

    async listCategories() {
      const [rows] = await database.query('SELECT * FROM categories WHERE is_visible = TRUE ORDER BY sort_order');
      return rows;
    },

    async listOptions(kind) {
      const sql = OPTION_QUERIES[kind];
      if (!sql) throw new Error(`Unsupported catalog option kind: ${kind}`);
      const [rows] = await database.query(sql);
      return rows;
    },

    async listJobs() {
      const [rows] = await database.query('SELECT * FROM jobs WHERE is_active = TRUE ORDER BY id');
      return rows;
    },

    async listTiers() {
      const [rows] = await database.query('SELECT * FROM tier_rules ORDER BY min_points');
      return rows;
    },

    async listRewards() {
      const [rows] = await database.query('SELECT * FROM rewards WHERE is_active = TRUE ORDER BY points_cost');
      return rows;
    },

    async listProductReviews(productId) {
      const [rows] = await database.query(
        `SELECT r.*, u.fullname, u.avatar_url
         FROM reviews r JOIN users u ON r.user_id = u.id
         WHERE r.product_id = $1 ORDER BY r.created_at DESC`,
        [productId],
      );
      return rows;
    },

    async listSearchSuggestions(query) {
      const pattern = `%${query || ''}%`;
      const [products] = await database.query(
        'SELECT DISTINCT name FROM products WHERE is_available = TRUE AND name ILIKE $1 ORDER BY name LIMIT 6',
        [pattern],
      );
      const [toppings] = await database.query(
        'SELECT DISTINCT name FROM toppings WHERE is_available = TRUE AND name ILIKE $1 ORDER BY name LIMIT 3',
        [pattern],
      );
      return { products: products.map((product) => product.name), toppings: toppings.map((topping) => topping.name) };
    },
  };
}

export const catalogRepository = createCatalogRepository();
export default catalogRepository;
