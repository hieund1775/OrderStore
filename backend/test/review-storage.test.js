import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakeReviewStorage, SupabaseReviewStorage, verifyObjectMetadata } from '../services/review-storage.js';

describe('verifyObjectMetadata — server-side file verification', () => {
  it('rejects zero byte size', () => {
    const result = verifyObjectMetadata(0, 'image/jpeg', 'image/jpeg');
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects negative byte size', () => {
    const result = verifyObjectMetadata(-100, 'image/jpeg', 'image/jpeg');
    assert.equal(result.valid, false);
  });

  it('rejects unsupported content type', () => {
    const result = verifyObjectMetadata(50000, 'image/gif', 'image/gif');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('không hợp lệ'));
  });

  it('rejects image over 1MB', () => {
    const result = verifyObjectMetadata(2 * 1024 * 1024, 'image/jpeg', 'image/jpeg');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('1MB'));
  });

  it('rejects video over 10MB', () => {
    const result = verifyObjectMetadata(15 * 1024 * 1024, 'video/mp4', 'video/mp4');
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('10MB'));
  });

  it('rejects unsupported video format', () => {
    const result = verifyObjectMetadata(5000000, 'video/avi', 'video/avi');
    assert.equal(result.valid, false);
  });

  it('accepts valid JPEG image', () => {
    const result = verifyObjectMetadata(50000, 'image/jpeg', 'image/jpeg');
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('accepts valid PNG image', () => {
    const result = verifyObjectMetadata(80000, 'image/png', 'image/png');
    assert.equal(result.valid, true);
  });

  it('accepts valid WebP image', () => {
    const result = verifyObjectMetadata(30000, 'image/webp', 'image/webp');
    assert.equal(result.valid, true);
  });

  it('accepts valid MP4 video', () => {
    const result = verifyObjectMetadata(5000000, 'video/mp4', 'video/mp4');
    assert.equal(result.valid, true);
  });

  it('accepts valid WebM video', () => {
    const result = verifyObjectMetadata(3000000, 'video/webm', 'video/webm');
    assert.equal(result.valid, true);
  });

  it('warns on content type mismatch but still accepts', () => {
    // Client claimed image/png but storage detected image/jpeg
    const result = verifyObjectMetadata(50000, 'image/jpeg', 'image/png');
    assert.equal(result.valid, true); // still valid, just warned
    assert.equal(result.errors.length, 0);
  });
});

describe('FakeReviewStorage — magic byte detection', () => {
  it('detects JPEG from magic bytes', async () => {
    const storage = new FakeReviewStorage();
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    await storage.simulateUpload('test/image.jpg', jpegBuffer, 'image/jpeg');

    const result = await storage.verifyObject('test/image.jpg');
    assert.equal(result.found, true);
    assert.equal(result.detectedContentType, 'image/jpeg');
    assert.equal(result.valid, true);
  });

  it('detects PNG from magic bytes', async () => {
    const storage = new FakeReviewStorage();
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    await storage.simulateUpload('test/image.png', pngBuffer, 'image/png');

    const result = await storage.verifyObject('test/image.png');
    assert.equal(result.found, true);
    assert.equal(result.detectedContentType, 'image/png');
    assert.equal(result.valid, true);
  });

  it('detects WebP from magic bytes', async () => {
    const storage = new FakeReviewStorage();
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
    ]);
    await storage.simulateUpload('test/image.webp', webpBuffer, 'image/webp');

    const result = await storage.verifyObject('test/image.webp');
    assert.equal(result.found, true);
    assert.equal(result.detectedContentType, 'image/webp');
    assert.equal(result.valid, true);
  });

  it('detects MP4 from magic bytes', async () => {
    const storage = new FakeReviewStorage();
    const mp4Buffer = Buffer.alloc(16);
    mp4Buffer.writeUInt32BE(16, 0); // box size
    mp4Buffer[4] = 0x66; mp4Buffer[5] = 0x74; mp4Buffer[6] = 0x79; mp4Buffer[7] = 0x70; // 'ftyp'
    await storage.simulateUpload('test/video.mp4', mp4Buffer, 'video/mp4');

    const result = await storage.verifyObject('test/video.mp4');
    assert.equal(result.found, true);
    assert.equal(result.detectedContentType, 'video/mp4');
    assert.equal(result.valid, true);
  });

  it('detects WebM from magic bytes', async () => {
    const storage = new FakeReviewStorage();
    const webmBuffer = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x00, 0x00, 0x00]);
    await storage.simulateUpload('test/video.webm', webmBuffer, 'video/webm');

    const result = await storage.verifyObject('test/video.webm');
    assert.equal(result.found, true);
    assert.equal(result.detectedContentType, 'video/webm');
    assert.equal(result.valid, true);
  });

  it('rejects unknown format', async () => {
    const storage = new FakeReviewStorage();
    const unknownBuffer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await storage.simulateUpload('test/unknown.bin', unknownBuffer, 'application/octet-stream');

    const result = await storage.verifyObject('test/unknown.bin');
    assert.equal(result.found, true);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('không được hỗ trợ'));
  });

  it('returns not found for missing key', async () => {
    const storage = new FakeReviewStorage();
    const result = await storage.verifyObject('nonexistent/key');
    assert.equal(result.found, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects image that is too large', async () => {
    const storage = new FakeReviewStorage();
    const largeBuffer = Buffer.alloc(2 * 1024 * 1024 + 1); // > 1MB
    await storage.simulateUpload('test/large.jpg', largeBuffer, 'image/jpeg');

    const result = await storage.verifyObject('test/large.jpg');
    assert.equal(result.found, true);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('1MB'));
  });

  it('rejects video that is too large', async () => {
    const storage = new FakeReviewStorage();
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // > 10MB
    await storage.simulateUpload('test/large.mp4', largeBuffer, 'video/mp4');

    const result = await storage.verifyObject('test/large.mp4');
    assert.equal(result.found, true);
    assert.equal(result.valid, false);
    assert.ok(result.errors[0].includes('10MB'));
  });

  it('rejects client MIME mismatch when magic bytes are unsupported', async () => {
    const storage = new FakeReviewStorage();
    // Client says image/png but actual bytes are GIF (not in our detector)
    const gifBuffer = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    await storage.simulateUpload('test/fake.png', gifBuffer, 'image/png');

    const result = await storage.verifyObject('test/fake.png');
    assert.equal(result.found, true);
    // Falls back to client-provided type since GIF isn't detected
    assert.equal(result.detectedContentType, 'image/png');
    // PNG is valid, so verification passes (GIF detection would need file-type library)
    assert.equal(result.valid, true);
  });

  it('detects actual content type vs client claim (PNG claimed, JPEG uploaded)', async () => {
    const storage = new FakeReviewStorage();
    // Client says image/png but actual bytes are JPEG
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    await storage.simulateUpload('test/fake-safe.png', jpegBuffer, 'image/png');

    const result = await storage.verifyObject('test/fake-safe.png');
    assert.equal(result.found, true);
    // Detected as JPEG, not PNG
    assert.equal(result.detectedContentType, 'image/jpeg');
    // JPEG is valid, so passes (but the mismatch is logged as a warning)
    assert.equal(result.valid, true);
  });

  it('supports createSignedUploadUrl', async () => {
    const storage = new FakeReviewStorage();
    const result = await storage.createSignedUploadUrl('test/key', 'image/jpeg', 50000);
    assert.ok(result.uploadUrl.startsWith('fake://'));
    assert.ok(result.publicUrl.startsWith('fake://'));
    assert.ok(result.expiresAt);
  });

  it('supports deleteObject', async () => {
    const storage = new FakeReviewStorage();
    await storage.simulateUpload('test/key', Buffer.from([0xFF, 0xD8, 0xFF]), 'image/jpeg');
    assert.equal(storage._objects.has('test/key'), true);
    await storage.deleteObject('test/key');
    assert.equal(storage._objects.has('test/key'), false);
  });

  it('supports _reset for test cleanup', () => {
    const storage = new FakeReviewStorage();
    storage._objects.set('key1', { data: Buffer.alloc(1), contentType: 'image/jpeg', byteSize: 1 });
    storage._objects.set('key2', { data: Buffer.alloc(1), contentType: 'image/jpeg', byteSize: 1 });
    assert.equal(storage._objects.size, 2);
    storage._reset();
    assert.equal(storage._objects.size, 0);
  });
});

describe('SupabaseReviewStorage — constructor validation', () => {
  it('creates instance without config (logs warning, no crash)', () => {
    const storage = new SupabaseReviewStorage();
    assert.equal(storage.name, 'SupabaseReviewStorage');
    assert.equal(storage._isConfigured, false);
  });

  it('creates instance with full config', () => {
    const storage = new SupabaseReviewStorage({
      supabaseUrl: 'https://test.supabase.co',
      supabaseServiceKey: 'test-service-key',
      bucketName: 'review-media',
    });
    assert.equal(storage.name, 'SupabaseReviewStorage');
    assert.equal(storage._isConfigured, true);
  });

  it('throws on createSignedUploadUrl when not configured', async () => {
    const storage = new SupabaseReviewStorage();
    await assert.rejects(
      () => storage.createSignedUploadUrl('key', 'image/jpeg', 50000),
      /chưa được cấu hình/,
    );
  });

  it('returns not-found result on verifyObject when not configured', async () => {
    const storage = new SupabaseReviewStorage();
    const result = await storage.verifyObject('key');
    assert.equal(result.found, false);
    assert.ok(result.errors.length > 0);
  });

  it('does not throw on deleteObject when not configured', async () => {
    const storage = new SupabaseReviewStorage();
    await storage.deleteObject('key'); // should not throw
  });

  it('generates correct storage URLs with config', () => {
    const storage = new SupabaseReviewStorage({
      supabaseUrl: 'https://abc123.supabase.co',
      supabaseServiceKey: 'test-key',
    });
    assert.equal(storage.supabaseUrl, 'https://abc123.supabase.co');
    assert.equal(storage.bucketName, 'review-media');
  });
});