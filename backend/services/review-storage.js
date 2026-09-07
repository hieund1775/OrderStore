/**
 * Review Media Storage Adapter
 *
 * Abstract interface for review media upload and verification.
 * Two implementations:
 *  - FakeReviewStorage: in-memory, for development and tests
 *  - SupabaseReviewStorage: production, uses Supabase Storage REST API
 *
 * Usage:
 *   const storage = createReviewStorage();
 *   const { uploadUrl, publicUrl } = await storage.createSignedUploadUrl(key, contentType);
 *   const metadata = await storage.verifyObject(key, expectedByteSize, expectedContentType);
 *   await storage.deleteObject(key);
 */

// ── Allowed formats ──
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MiB
const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MiB

/**
 * Verify that a stored object's actual metadata matches allowed constraints.
 * This is the server-side "finalize" check — never trust client-provided values.
 *
 * @param {number} byteSize - actual object size from storage
 * @param {string} detectedContentType - MIME type detected from magic bytes, not client header
 * @param {string} originalContentType - what the client claimed (for error messages)
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function verifyObjectMetadata(byteSize, detectedContentType, originalContentType) {
  const errors = [];

  if (!Number.isInteger(byteSize) || byteSize <= 0) {
    errors.push('Kích thước file không hợp lệ');
    return { valid: false, errors };
  }

  const isImage = detectedContentType.startsWith('image/');
  const isVideo = detectedContentType.startsWith('video/');

  if (!isImage && !isVideo) {
    errors.push(`Loại file không được hỗ trợ: ${detectedContentType}`);
    return { valid: false, errors };
  }

  if (isImage) {
    if (!ALLOWED_IMAGE_TYPES.has(detectedContentType)) {
      errors.push(`Định dạng ảnh không hợp lệ: ${detectedContentType}. Chỉ chấp nhận JPEG, PNG, WebP`);
    }
    if (byteSize > MAX_IMAGE_BYTES) {
      errors.push(`Ảnh vượt quá 1MB (${(byteSize / 1024 / 1024).toFixed(2)}MB). Kích thước thực tế: ${byteSize} bytes`);
    }
  }

  if (isVideo) {
    if (!ALLOWED_VIDEO_TYPES.has(detectedContentType)) {
      errors.push(`Định dạng video không hợp lệ: ${detectedContentType}. Chỉ chấp nhận MP4, WebM`);
    }
    if (byteSize > MAX_VIDEO_BYTES) {
      errors.push(`Video vượt quá 10MB (${(byteSize / 1024 / 1024).toFixed(2)}MB). Kích thước thực tế: ${byteSize} bytes`);
    }
  }

  // Warn if client claimed a different type than what was detected
  if (detectedContentType !== originalContentType) {
    console.warn(`[STORAGE] Content type mismatch: client claimed "${originalContentType}", storage detected "${detectedContentType}"`);
  }

  return { valid: errors.length === 0, errors };
}

// ──────────────────────────────────────────────────
// FakeReviewStorage — in-memory, for dev/test
// ──────────────────────────────────────────────────

export class FakeReviewStorage {
  constructor() {
    this.name = 'FakeReviewStorage';
    /** @type {Map<string, { data: Buffer, contentType: string, byteSize: number }>} */
    this._objects = new Map();
  }

  /**
   * Generate a signed upload URL. In the fake, returns a data: URI for testing.
   * @param {string} key - storage key
   * @param {string} contentType - MIME type
   * @param {number} byteSize - expected file size
   * @returns {Promise<{ uploadUrl: string, publicUrl: string }>}
   */
  async createSignedUploadUrl(key, contentType, byteSize) {
    // In the fake, we simulate a signed URL that the test can "upload" to
    return {
      uploadUrl: `fake://upload/${key}`,
      publicUrl: `fake://public/${key}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Simulate uploading a file to the fake storage.
   * In production, the client uploads directly to the signed URL.
   * @param {string} key
   * @param {Buffer} data
   * @param {string} contentType
   */
  async simulateUpload(key, data, contentType) {
    this._objects.set(key, {
      data: Buffer.from(data),
      contentType,
      byteSize: data.length,
    });
  }

  /**
   * Verify a stored object's actual metadata.
   * Fetches the object, detects its type from magic bytes, and validates.
   * @param {string} key - storage key
   * @returns {Promise<{ found: boolean, byteSize: number|null, detectedContentType: string|null, errors: string[] }>}
   */
  async verifyObject(key) {
    const obj = this._objects.get(key);
    if (!obj) {
      return { found: false, byteSize: null, detectedContentType: null, errors: ['Object không tồn tại trong storage'] };
    }

    const detectedType = this._detectMagicBytes(obj.data) || obj.contentType;
    const result = verifyObjectMetadata(obj.byteSize, detectedType, obj.contentType);

    return {
      found: true,
      byteSize: obj.byteSize,
      detectedContentType: detectedType,
      errors: result.errors,
      valid: result.valid,
    };
  }

  /**
   * Delete an object from storage.
   * @param {string} key
   */
  async deleteObject(key) {
    this._objects.delete(key);
  }

  /**
   * Simple magic-byte detection for common formats.
   * In production, use a proper library like `file-type` or `sharp`.
   */
  _detectMagicBytes(buffer) {
    if (!buffer || buffer.length < 4) return null;

    const header = Buffer.from(buffer.subarray(0, 8));

    // JPEG: starts with FF D8 FF
    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
      return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return 'image/png';
    }

    // WebP: RIFF .... WEBP
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
        header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
      return 'image/webp';
    }

    // MP4: ftyp box (starts with 00 00 00 XX 66 74 79 70)
    if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) {
      return 'video/mp4';
    }

    // WebM: 1A 45 DF A3 (EBML header)
    if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) {
      return 'video/webm';
    }

    return null;
  }

  /**
   * Clear all objects (for test cleanup).
   */
  _reset() {
    this._objects.clear();
  }
}

// ──────────────────────────────────────────────────
// SupabaseReviewStorage — production
// ──────────────────────────────────────────────────

export class SupabaseReviewStorage {
  /**
   * @param {Object} options
   * @param {string} options.supabaseUrl - Supabase project URL
   * @param {string} options.supabaseServiceKey - Supabase service_role key (server-side only)
   * @param {string} options.bucketName - Storage bucket name (default: 'review-media')
   * @param {Function} [options.fetchImpl] - fetch implementation (for DI/testing)
   */
  constructor({ supabaseUrl, supabaseServiceKey, bucketName = 'review-media', fetchImpl = globalThis.fetch } = {}) {
    this.name = 'SupabaseReviewStorage';
    this.supabaseUrl = supabaseUrl;
    this.supabaseServiceKey = supabaseServiceKey;
    this.bucketName = bucketName;
    this.fetchImpl = fetchImpl;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('[SupabaseReviewStorage] Không có cấu hình Supabase Storage. Sử dụng FakeReviewStorage làm fallback.');
    }
  }

  get _isConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey);
  }

  /**
   * Generate a signed upload URL via Supabase Storage REST API.
   * POST /object/upload/sign/{bucketName}/{key}
   */
  async createSignedUploadUrl(key, contentType, byteSize) {
    if (!this._isConfigured) {
      throw new Error('SupabaseReviewStorage chưa được cấu hình. Kiểm tra biến môi trường SUPABASE_URL và SUPABASE_SERVICE_KEY.');
    }

    const response = await this.fetchImpl(
      `${this.supabaseUrl}/storage/v1/object/upload/sign/${this.bucketName}/${key}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType,
          contentLength: byteSize,
          upsert: false,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Supabase Storage không thể tạo signed URL: ${response.status} ${errorBody}`);
    }

    const data = await response.json();
    return {
      uploadUrl: data.url || data.signedUrl || data.signed_url,
      publicUrl: `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${key}`,
      expiresAt: data.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Verify a stored object's actual metadata.
   * GET /object/info/{bucketName}/{key}
   * Also fetches the first bytes for magic-byte detection.
   */
  async verifyObject(key) {
    if (!this._isConfigured) {
      return { found: false, byteSize: null, detectedContentType: null, errors: ['Storage chưa được cấu hình'] };
    }

    // Fetch object metadata
    const infoResponse = await this.fetchImpl(
      `${this.supabaseUrl}/storage/v1/object/info/public/${this.bucketName}/${key}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.supabaseServiceKey}` },
      },
    );

    if (!infoResponse.ok) {
      return { found: false, byteSize: null, detectedContentType: null, errors: [`Không tìm thấy object: ${infoResponse.status}`] };
    }

    const info = await infoResponse.json();
    const reportedSize = info.metadata?.contentLength || info.content_length || info.size || 0;
    const reportedType = info.metadata?.contentType || info.content_type || '';

    // Fetch the first 16 bytes for magic-byte detection (using range request)
    const headResponse = await this.fetchImpl(
      `${this.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${key}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.supabaseServiceKey}`,
          Range: 'bytes=0-15',
        },
      },
    );

    let detectedType = reportedType;
    if (headResponse.ok) {
      const buffer = Buffer.from(await headResponse.arrayBuffer());
      const detected = this._detectMagicBytes(buffer);
      if (detected) {
        detectedType = detected;
      }
    }

    const result = verifyObjectMetadata(Number(reportedSize), detectedType, reportedType);

    return {
      found: true,
      byteSize: Number(reportedSize),
      detectedContentType: detectedType,
      errors: result.errors,
      valid: result.valid,
    };
  }

  /**
   * Delete an object from storage.
   * DELETE /object/{bucketName}/{key}
   */
  async deleteObject(key) {
    if (!this._isConfigured) return;

    await this.fetchImpl(
      `${this.supabaseUrl}/storage/v1/object/${this.bucketName}/${key}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.supabaseServiceKey}` },
      },
    );
  }

  /**
   * Simple magic-byte detection (same as FakeReviewStorage).
   * In production, prefer `file-type` package for wider coverage.
   */
  _detectMagicBytes(buffer) {
    if (!buffer || buffer.length < 4) return null;

    const header = Buffer.from(buffer.subarray(0, 8));

    if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return 'image/jpeg';
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return 'image/png';
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
        header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) return 'image/webp';
    if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) return 'video/mp4';
    if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) return 'video/webm';
    return null;
  }
}

/**
 * Factory: create the appropriate storage adapter based on environment.
 * Falls back to FakeReviewStorage when Supabase is not configured.
 */
export function createReviewStorage() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

  if (supabaseUrl && supabaseServiceKey) {
    return new SupabaseReviewStorage({
      supabaseUrl,
      supabaseServiceKey,
      bucketName: process.env.SUPABASE_REVIEW_BUCKET || 'review-media',
    });
  }

  if (process.env.NODE_ENV === 'production') {
    console.warn('[createReviewStorage] WARNING: Production không có SUPABASE_URL/SUPABASE_SERVICE_KEY. Upload media review sẽ không hoạt động.');
  }

  return new FakeReviewStorage();
}

export default createReviewStorage();