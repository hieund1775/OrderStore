import { Star, MessageSquare, Image } from 'lucide-react';

interface TimelineRevision {
  id: number;
  sequence: number;
  revisionType: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface TimelineReply {
  id: number;
  body: string;
  createdAt: string;
  adminName?: string;
}

interface ReviewTimelineProps {
  revisions: TimelineRevision[];
  replies: TimelineReply[];
}

export function ReviewTimeline({ revisions, replies }: ReviewTimelineProps) {
  const sortedRevisions = [...(revisions || [])].sort((a, b) => a.sequence - b.sequence);

  if (sortedRevisions.length === 0 && (!replies || replies.length === 0)) {
    return null;
  }

  const timelineItems: Array<{
    type: 'original' | 'edit' | 'reply';
    label: string;
    date: string;
    rating?: number;
    comment?: string | null;
    body?: string;
    adminName?: string;
  }> = [];

  for (const rev of sortedRevisions) {
    const isOriginal = rev.revisionType === 'original';
    timelineItems.push({
      type: isOriginal ? 'original' : 'edit',
      label: isOriginal ? 'Đánh giá ban đầu' : 'Đã chỉnh sửa',
      date: rev.createdAt,
      rating: rev.rating,
      comment: rev.comment,
    });
  }

  for (const reply of replies || []) {
    timelineItems.push({
      type: 'reply',
      label: 'Phản hồi từ cửa hàng',
      date: reply.createdAt,
      body: reply.body,
      adminName: reply.adminName,
    });
  }

  timelineItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-500">Dòng thời gian</h4>
      <div className="relative pl-6">
        {/* Vertical line */}
        <div className="absolute bottom-0 left-2.5 top-0 w-0.5 bg-gray-200" />

        <div className="space-y-4">
          {timelineItems.map((item, idx) => (
            <div key={idx} className="relative">
              {/* Dot */}
              <div
                className={`absolute -left-[18px] mt-1.5 h-3 w-3 rounded-full border-2 ${
                  item.type === 'reply'
                    ? 'border-blue-400 bg-blue-50'
                    : item.type === 'edit'
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-green-400 bg-green-50'
                }`}
              />

              <div className="rounded-lg border bg-white p-3">
                <div className="mb-1 flex items-center gap-2">
                  {item.type === 'reply' ? (
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <Star className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  <span className="text-xs font-medium text-gray-700">{item.label}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(item.date).toLocaleDateString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {item.rating && (
                  <div className="mb-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-3 w-3 ${
                          star <= item.rating!
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {item.comment && (
                  <p className="text-sm text-gray-600">{item.comment}</p>
                )}

                {item.body && (
                  <div className="text-sm">
                    {item.adminName && (
                      <span className="font-medium text-blue-700">{item.adminName}: </span>
                    )}
                    <span className="text-gray-600">{item.body}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}