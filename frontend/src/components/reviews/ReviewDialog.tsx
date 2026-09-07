import { useState, useRef } from 'react';
import { Star, X, Image, Video, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MiB
const MAX_VIDEO_BYTES = 10 * 1024 * 1024; // 10 MiB

interface UploadIntentResult {
  intentId: string;
  uploadUrl: string;
  mediaType: 'image' | 'video';
  fileName: string;
}

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { rating: number; comment: string; intentIds: string[] }) => Promise<void>;
  initialRating?: number;
  initialComment?: string;
  mode: 'create' | 'edit';
  title?: string;
  /** For create_original intent: order code + item id */
  orderCode?: string;
  orderItemId?: number;
  /** For edit_revision intent: review id */
  reviewId?: number;
}

export function ReviewDialog({
  open,
  onOpenChange,
  onSubmit,
  initialRating = 5,
  initialComment = '',
  mode,
  title,
  orderCode,
  orderItemId,
  reviewId,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadIntentResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      toast.error('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP) hoặc video (MP4, WebM)');
      return;
    }

    // Validate size
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      const limitMB = isImage ? '1MB' : '10MB';
      toast.error(`File ${isImage ? 'ảnh' : 'video'} không được vượt quá ${limitMB}`);
      return;
    }

    // Check if we already have a file of this type (max 1 image + 1 video)
    if (isImage && uploadedFiles.some((f) => f.mediaType === 'image')) {
      toast.error('Chỉ được đăng tối đa 1 ảnh');
      return;
    }
    if (isVideo && uploadedFiles.some((f) => f.mediaType === 'video')) {
      toast.error('Chỉ được đăng tối đa 1 video');
      return;
    }

    uploadFile(file, isImage ? 'image' : 'video');
  }

  async function uploadFile(file: File, mediaType: 'image' | 'video') {
    setUploading(true);
    try {
      // 1. Create upload intent
      const action = mode === 'create' ? 'create_original' : 'edit_revision';
      const body: Record<string, unknown> = {
        action,
        media_type: mediaType,
        content_type: file.type,
        byte_size: file.size,
      };
      if (mode === 'create' && orderCode && orderItemId) {
        body.order_id = undefined; // The server handles this from the order item
        body.order_item_id = orderItemId;
      }
      if (mode === 'edit' && reviewId) {
        body.review_id = reviewId;
      }

      const intent = await apiPost<{
        intentId: string;
        uploadUrl: string;
        publicUrl: string | null;
        expiresAt: string;
      }>('/api/review-media/intents', body);

      // 2. Upload file to signed URL (no auth header needed — signed URL is self-contained)
      const uploadResponse = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Không thể tải file lên');
      }

      // 3. Track the uploaded intent
      setUploadedFiles((prev) => [
        ...prev,
        {
          intentId: intent.intentId,
          uploadUrl: intent.uploadUrl,
          mediaType,
          fileName: file.name,
        },
      ]);

      toast.success(`Đã tải ${mediaType === 'image' ? 'ảnh' : 'video'} lên`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể tải file lên');
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeFile(intentId: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.intentId !== intentId));
  }

  async function handleSubmit() {
    if (rating < 1 || rating > 5) {
      toast.error('Vui lòng chọn điểm đánh giá');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        rating,
        comment: comment.trim(),
        intentIds: uploadedFiles.map((f) => f.intentId),
      });
      toast.success(mode === 'create' ? 'Đã gửi đánh giá' : 'Đã cập nhật đánh giá');
      onOpenChange(false);
      if (mode === 'create') {
        setRating(5);
        setComment('');
        setUploadedFiles([]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (!submitting && !uploading) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {title || (mode === 'create' ? 'Đánh giá sản phẩm' : 'Chỉnh sửa đánh giá')}
          </DialogTitle>
          <DialogDescription>
            Chia sẻ trải nghiệm của bạn về sản phẩm này
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Star Rating */}
          <div className="text-center">
            <p className="mb-2 text-sm font-medium text-gray-700">Chất lượng sản phẩm</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredStar || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {rating === 1 && 'Rất tệ'}
              {rating === 2 && 'Tệ'}
              {rating === 3 && 'Bình thường'}
              {rating === 4 && 'Tốt'}
              {rating === 5 && 'Tuyệt vời'}
            </p>
          </div>

          {/* Comment */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nhận xét (không bắt buộc)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
              rows={4}
              maxLength={2000}
              className="resize-none"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {comment.length}/2000
            </p>
          </div>

          {/* Media Upload */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hình ảnh / Video (không bắt buộc)
            </label>

            {/* Uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="mb-2 space-y-1">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.intentId}
                    className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm"
                  >
                    {file.mediaType === 'image' ? (
                      <Image className="h-4 w-4 text-green-600" />
                    ) : (
                      <Video className="h-4 w-4 text-green-600" />
                    )}
                    <span className="flex-1 truncate text-green-800">{file.fileName}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(file.intentId)}
                      className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                      disabled={submitting || uploading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
              onChange={handleFileSelect}
              className="hidden"
              disabled={uploading || submitting}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || submitting || uploadedFiles.length >= 2}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <Upload className="mr-1 h-4 w-4" />
                  {uploadedFiles.length >= 2
                    ? 'Đã đủ 2 file'
                    : 'Chọn ảnh hoặc video'}
                </>
              )}
            </Button>
            <p className="mt-1 text-xs text-gray-400">
              Ảnh: tối đa 1MB (JPEG, PNG, WebP) &middot; Video: tối đa 10MB (MP4, WebM)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={submitting || uploading}
          >
            Hủy
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Đang gửi...
              </>
            ) : mode === 'create' ? (
              'Gửi đánh giá'
            ) : (
              'Lưu chỉnh sửa'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}