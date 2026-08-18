import postgresDb from '../../config/db-postgres.js';

export class AdminCatalogError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function createAdminCatalogRepository(database = postgresDb) {
  return {
    async listCategories() {
      const [rows] = await database.query(
        `SELECT c.*, (SELECT COUNT(*)::int FROM products WHERE category_id = c.id) AS items
         FROM categories c
         ORDER BY c.sort_order, c.id`,
      );
      return rows;
    },

    async createCategory({ name, slug, sort_order = 0, is_visible = true }) {
      const [rows] = await database.query(
        `INSERT INTO categories (name, slug, sort_order, is_visible)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name.trim(), slug.trim(), Number(sort_order) || 0, is_visible !== false],
      );
      return rows[0];
    },

    async updateCategory(id, { name, slug, sort_order, is_visible }) {
      const fields = [];
      const params = [];
      if (name !== undefined) {
        params.push(name.trim());
        fields.push(`name = $${params.length}`);
      }
      if (slug !== undefined) {
        params.push(slug.trim());
        fields.push(`slug = $${params.length}`);
      }
      if (sort_order !== undefined) {
        params.push(Number(sort_order) || 0);
        fields.push(`sort_order = $${params.length}`);
      }
      if (is_visible !== undefined) {
        params.push(Boolean(is_visible));
        fields.push(`is_visible = $${params.length}`);
      }
      if (fields.length === 0) return null;
      params.push(id);
      const [rows] = await database.query(
        `UPDATE categories SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      return rows[0] || null;
    },

    async deleteCategory(id) {
      const [exists] = await database.query('SELECT id, name FROM categories WHERE id = $1', [id]);
      if (!exists[0]) throw new AdminCatalogError('Không tìm thấy danh mục', 404);
      const [cnt] = await database.query('SELECT COUNT(*)::int AS c FROM products WHERE category_id = $1', [id]);
      if (Number(cnt[0]?.c) > 0) {
        throw new AdminCatalogError(`Không thể xóa danh mục "${exists[0].name}" vì đang có ${cnt[0].c} sản phẩm. Hãy xóa hoặc chuyển sản phẩm trước.`);
      }
      const [, affected] = await database.query('DELETE FROM categories WHERE id = $1', [id]);
      return affected > 0;
    },

    async listProducts({ category_id, search, tag } = {}) {
      let sql = `SELECT p.*, c.name AS category_name
                 FROM products p
                 JOIN categories c ON p.category_id = c.id
                 WHERE TRUE`;
      const params = [];
      if (category_id) {
        params.push(Number(category_id));
        sql += ` AND p.category_id = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        sql += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
      }
      if (tag) {
        params.push(`%"${tag}"%`);
        sql += ` AND p.tags ILIKE $${params.length}`;
      }
      sql += ' ORDER BY c.sort_order, p.id';
      const [rows] = await database.query(sql, params);
      return rows;
    },

    async createProduct({ category_id, name, slug, base_tea, description, price, image_url, calories, fruit_group, tags }) {
      const [rows] = await database.query(
        `INSERT INTO products (category_id, name, slug, base_tea, description, price, image_url, calories, fruit_group, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          category_id,
          name.trim(),
          slug.trim(),
          base_tea || 'Lục trà',
          description || null,
          Number(price) || 0,
          image_url || null,
          Number(calories) || 0,
          fruit_group || null,
          tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : null,
        ],
      );
      return rows[0];
    },

    async updateProduct(id, fields) {
      const sets = [];
      const params = [];
      const allowed = ['category_id', 'name', 'slug', 'base_tea', 'description', 'price', 'image_url', 'calories', 'fruit_group', 'tags', 'is_available'];
      for (const k of allowed) {
        if (fields[k] !== undefined) {
          params.push(k === 'tags' && typeof fields[k] !== 'string' ? JSON.stringify(fields[k]) : fields[k]);
          sets.push(`${k} = $${params.length}`);
        }
      }
      if (sets.length === 0) return null;
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      const [rows] = await database.query(
        `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      return rows[0] || null;
    },

    async toggleProductAvailability(id) {
      const [rows] = await database.query(
        `UPDATE products SET is_available = NOT is_available, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING is_available`,
        [id],
      );
      return rows[0] || null;
    },

    async deleteProduct(id) {
      const [exists] = await database.query('SELECT id, name FROM products WHERE id = $1', [id]);
      if (!exists[0]) throw new AdminCatalogError('Không tìm thấy món', 404);
      const [cnt] = await database.query('SELECT COUNT(*)::int AS c FROM order_items WHERE product_id = $1', [id]);
      if (Number(cnt[0]?.c) > 0) {
        throw new AdminCatalogError(`Không thể xóa món "${exists[0].name}" vì đã có ${cnt[0].c} đơn hàng chứa món này. Hãy dùng chức năng "Tạm ngưng" thay vì xóa.`);
      }
      const [, affected] = await database.query('DELETE FROM products WHERE id = $1', [id]);
      return affected > 0;
    },

    async listAllOptions() {
      const [sizes] = await database.query('SELECT * FROM size_options ORDER BY sort_order, id');
      const [bases] = await database.query('SELECT * FROM base_options ORDER BY sort_order, id');
      const [sugars] = await database.query('SELECT * FROM sugar_options ORDER BY sort_order, id');
      const [ices] = await database.query('SELECT * FROM ice_options ORDER BY sort_order, id');
      const [toppings] = await database.query('SELECT * FROM toppings ORDER BY sort_order, id');
      return { sizes, bases, sugars, ices, toppings };
    },

    async createTopping({ name, price, is_available = true }) {
      const [rows] = await database.query(
        `INSERT INTO toppings (name, price, is_available, sort_order)
         VALUES ($1, $2, $3, 0)
         RETURNING *`,
        [name.trim(), Number(price) || 0, is_available !== false],
      );
      return rows[0];
    },

    async updateTopping(id, { name, price, is_available }) {
      const sets = [];
      const params = [];
      if (name !== undefined) {
        params.push(name.trim());
        sets.push(`name = $${params.length}`);
      }
      if (price !== undefined) {
        params.push(Number(price) || 0);
        sets.push(`price = $${params.length}`);
      }
      if (is_available !== undefined) {
        params.push(Boolean(is_available));
        sets.push(`is_available = $${params.length}`);
      }
      if (sets.length === 0) return null;
      params.push(id);
      const [rows] = await database.query(
        `UPDATE toppings SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params,
      );
      return rows[0] || null;
    },

    async deleteTopping(id) {
      const [exists] = await database.query('SELECT id, name FROM toppings WHERE id = $1', [id]);
      if (!exists[0]) throw new AdminCatalogError('Không tìm thấy topping', 404);
      const [, affected] = await database.query('DELETE FROM toppings WHERE id = $1', [id]);
      return affected > 0;
    },

    async createBase({ name }) {
      const [rows] = await database.query(
        `INSERT INTO base_options (name, sort_order)
         VALUES ($1, 0)
         RETURNING *`,
        [name.trim()],
      );
      return rows[0];
    },

    async updateBase(id, { name }) {
      const [rows] = await database.query(
        `UPDATE base_options SET name = $1 WHERE id = $2 RETURNING *`,
        [name.trim(), id],
      );
      return rows[0] || null;
    },

    async deleteBase(id) {
      const [exists] = await database.query('SELECT id, name FROM base_options WHERE id = $1', [id]);
      if (!exists[0]) throw new AdminCatalogError('Không tìm thấy cốt trà', 404);
      const [, affected] = await database.query('DELETE FROM base_options WHERE id = $1', [id]);
      return affected > 0;
    },
  };
}

export const adminCatalogRepository = createAdminCatalogRepository();
export default adminCatalogRepository;
