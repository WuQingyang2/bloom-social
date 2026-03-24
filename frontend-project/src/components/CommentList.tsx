'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useComments } from '@/hooks/useComments';

interface CommentListProps {
  contentId: number;
  refreshTrigger?: number; // 当值变化时，刷新列表
}

/**
 * 格式化时间戳为相对时间（如"2 小时前"）
 */
function formatTimeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = now - timestamp;

  if (diffSeconds < 60) return '刚刚';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}小时前`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}天前`;
  
  return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
}

/**
 * 缩写地址显示
 */
function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(38)}`;
}

/**
 * 复制地址到剪贴板
 */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

export function CommentList({ contentId, refreshTrigger }: CommentListProps) {
  const [offset, setOffset] = useState(0);
  const [localComments, setLocalComments] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { address } = useAccount();
  const { comments, total, loading, error, fetchComments, deleteComment } = useComments();

  // 初始加载评论
  useEffect(() => {
    setOffset(0);
    setLocalComments([]);
    fetchComments(contentId, 0, 20);
  }, [contentId, fetchComments, refreshTrigger]);

  // 同步 Hook 中的评论到本地状态
  useEffect(() => {
    setLocalComments(comments);
  }, [comments]);

  // 加载更多
  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    const newOffset = offset + 20;
    setOffset(newOffset);
    await fetchComments(contentId, newOffset, 20);
    setIsLoadingMore(false);
  };

  // 删除评论
  const handleDelete = async (commentId: number) => {
    if (!window.confirm('确定要删除这条评论吗？')) return;

    setDeletingId(commentId);
    try {
      await deleteComment(commentId);
    } finally {
      setDeletingId(null);
    }
  };

  // 加载中状态
  if (loading && offset === 0) {
    return (
      <div className="space-y-4">
        <div className="text-sm font-medium uppercase tracking-wider text-[var(--ink-muted)]">评论</div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card card-bordered p-4 animate-pulse">
            <div className="h-4 w-1/4 rounded bg-[var(--border-light)]"></div>
            <div className="mt-2 h-3 w-3/4 rounded bg-[var(--border-light)]"></div>
          </div>
        ))}
      </div>
    );
  }

  // 无评论状态 - 直接不显示
  if (total === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium uppercase tracking-wider text-[var(--ink-muted)]">
          评论 ({total})
        </span>
      </div>

      {/* 错误消息 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 评论列表 */}
      <div className="space-y-3">
        {localComments.map((comment) => (
          <div
            key={comment.id}
            className="card card-bordered p-4"
          >
            {/* 评论头部 */}
            <div className="mb-2 flex items-center justify-between">
              <button
                onClick={() => copyToClipboard(comment.commenter)}
                className="text-sm font-mono text-[var(--ink-muted)] hover:text-[var(--accent-green)] transition-colors"
                title="点击复制地址"
              >
                {shortenAddress(comment.commenter)}
              </button>
              <span className="text-xs text-[var(--ink-faint)]">
                {formatTimeAgo(comment.createdAt)}
              </span>
            </div>

            {/* 评论文本 */}
            <p className="mb-3 text-[var(--ink)] leading-relaxed">{comment.text}</p>

            {/* 删除按钮（仅作者看到） */}
            {address && comment.commenter.toLowerCase() === address.toLowerCase() && (
              <button
                onClick={() => handleDelete(comment.id)}
                disabled={deletingId === comment.id}
                className={`text-sm font-medium ${
                  deletingId === comment.id
                    ? 'cursor-not-allowed text-[var(--ink-faint)]'
                    : 'text-[var(--accent-red)] hover:underline'
                }`}
              >
                {deletingId === comment.id ? '删除中...' : '删除'}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 加载更多按钮 */}
      {offset + 20 < total && (
        <button
          onClick={handleLoadMore}
          disabled={isLoadingMore || loading}
          className="btn btn-ghost w-full"
        >
          {isLoadingMore ? '加载中...' : `加载更多 (剩余 ${total - offset - 20} 条)`}
        </button>
      )}
    </div>
  );
}
