'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useComments } from '@/hooks/useComments';

interface CommentFormProps {
  contentId: number;
  onCommentPosted?: () => void;
}

export function CommentForm({ contentId, onCommentPosted }: CommentFormProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const { address } = useAccount();
  const { postComment } = useComments();

  const charCount = text.length;
  const maxChars = 500;
  const isOverLimit = charCount > maxChars;
  const isEmpty = text.trim().length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address) {
      setErrorMessage('请先连接钱包');
      return;
    }

    if (isEmpty || isOverLimit) {
      setErrorMessage('评论内容必须在 1-500 字符之间');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await postComment(contentId, text);
      setText('');
      setSuccessMessage('评论发表成功！');
      
      // 3 秒后隐藏成功消息
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // 触发回调（父组件可以刷新列表）
      onCommentPosted?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '发表评论失败';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card card-bordered">
      {/* 标题 */}
      <div className="p-4 border-b border-[var(--border-light)] bg-[var(--paper)]">
        <span className="text-sm font-medium uppercase tracking-wider text-[var(--ink-muted)]">
          发表评论
        </span>
      </div>

      {/* 未连接钱包提示 */}
      {!address && (
        <div className="m-4 p-3 bg-blue-50 border border-blue-200 text-sm text-blue-700">
          请先连接钱包以发表评论
        </div>
      )}

      {/* 表单 */}
      <form onSubmit={handleSubmit} className="p-4">
        {/* 文本输入框 */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="分享你的想法..."
          disabled={!address || isSubmitting}
          maxLength={maxChars}
          rows={4}
          className="w-full p-3 border border-[var(--border-light)] bg-white text-[var(--ink)] placeholder-[var(--ink-faint)] focus:border-[var(--ink)] focus:outline-none disabled:bg-[var(--paper)] disabled:text-[var(--ink-muted)] resize-none"
        />

        {/* 字符计数 */}
        <div className="flex justify-between items-center mt-2 mb-3 text-sm">
          <div className={`font-mono ${isOverLimit ? 'text-[var(--accent-red)]' : 'text-[var(--ink-muted)]'}`}>
            {charCount} / {maxChars}
          </div>
          {charCount > 400 && (
            <div className={isOverLimit ? 'text-[var(--accent-red)]' : 'text-yellow-600'}>
              {isOverLimit ? '超出字数限制' : '接近字数限制'}
            </div>
          )}
        </div>

        {/* 错误消息 */}
        {errorMessage && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* 成功消息 */}
        {successMessage && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 text-sm text-green-700">
            ✓ {successMessage}
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type="submit"
          disabled={!address || isEmpty || isOverLimit || isSubmitting}
          className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? '发表中...' : '发表评论'}
        </button>
      </form>
    </div>
  );
}
