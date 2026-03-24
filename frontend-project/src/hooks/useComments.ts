'use client';

import { useState, useCallback } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

export interface Comment {
  id: number;
  contentId: number;
  commenter: string;
  text: string;
  signature: string;
  createdAt: number;
  deletedAt?: number;
}

export interface useCommentsReturn {
  comments: Comment[];
  total: number;
  loading: boolean;
  error: string | null;
  fetchComments: (contentId: number, offset?: number, limit?: number) => Promise<void>;
  postComment: (contentId: number, text: string) => Promise<void>;
  deleteComment: (commentId: number) => Promise<void>;
  reset: () => void;
}

/**
 * 管理评论的自定义 Hook
 */
export function useComments(): useCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  /**
   * 获取评论列表
   */
  const fetchComments = useCallback(
    async (contentId: number, offset: number = 0, limit: number = 20) => {
      if (!contentId || isNaN(contentId)) {
        // 不设置错误，直接返回，让界面保持干净
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/comments?contentId=${contentId}&limit=${limit}&offset=${offset}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load comments');
        }

        const data = await response.json();
        if (offset === 0) {
          setComments(data.data);
        } else {
          setComments((prev) => [...prev, ...data.data]);
        }
        setTotal(data.total);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load comments';
        setError(message);
        console.error('fetchComments error:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * 发表评论
   */
  const postComment = useCallback(
    async (contentId: number, text: string) => {
      if (!address) {
        throw new Error('Please connect wallet');
      }

      if (!text || text.length < 1 || text.length > 500) {
        throw new Error('Comment text must be 1-500 characters');
      }

      if (!contentId) {
        throw new Error('Invalid content ID');
      }

      setLoading(true);
      setError(null);

      try {
        // 1. 生成时间戳和消息
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Comment on content ${contentId} at ${timestamp}:\n${text}`;

        // 2. 签名消息
        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch (err) {
          throw new Error('User cancelled signing');
        }

        // 3. 发送到 API
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId,
            text,
            message,
            signature,
            timestamp,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to post comment');
        }

        const newComment = await response.json();

        // 4. 更新本地评论列表
        setComments((prev) => [newComment, ...prev]);
        setTotal((prev) => prev + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to post comment';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, signMessageAsync]
  );

  /**
   * 删除评论
   */
  const deleteComment = useCallback(
    async (commentId: number) => {
      if (!address) {
        throw new Error('Please connect wallet');
      }

      setLoading(true);
      setError(null);

      try {
        // 1. 生成删除消息
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Delete comment ${commentId}`;

        // 2. 签名消息
        let signature: string;
        try {
          signature = await signMessageAsync({ message });
        } catch (err) {
          throw new Error('User cancelled signing');
        }

        // 3. 发送删除请求
        const response = await fetch(`/api/comments/${commentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature,
            message,
            timestamp,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete comment');
        }

        // 4. 从本地列表移除评论
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setTotal((prev) => Math.max(0, prev - 1));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete comment';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, signMessageAsync]
  );

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setComments([]);
    setTotal(0);
    setLoading(false);
    setError(null);
  }, []);

  return {
    comments,
    total,
    loading,
    error,
    fetchComments,
    postComment,
    deleteComment,
    reset,
  };
}
