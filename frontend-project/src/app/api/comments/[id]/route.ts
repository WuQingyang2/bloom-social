import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  recoverAddressFromMessage,
  validateDeleteMessage,
  isTimestampValid,
  bytesToAddress,
} from '@/lib/signature';

/**
 * DELETE /api/comments/[id]
 * 删除评论（仅评论作者可删除）
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const commentId = parseInt(params.id);

    if (isNaN(commentId)) {
      return NextResponse.json(
        { error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { signature, message, timestamp } = body;

    // 1. 参数验证
    if (!signature || !message || timestamp === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 2. 时间戳验证
    if (!isTimestampValid(timestamp)) {
      return NextResponse.json(
        { error: 'Timestamp expired (must be within ±5 minutes)' },
        { status: 400 }
      );
    }

    // 3. 签名恢复
    let requester: string;
    try {
      requester = await recoverAddressFromMessage(message, signature);
    } catch (error) {
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    // 4. 验证删除消息格式
    if (!validateDeleteMessage(message, commentId)) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // 5. 查询评论
    const commentResult = await query(
      `SELECT id, commenter, deleted_at FROM comments WHERE id = $1`,
      [commentId]
    );

    if (!commentResult.rows || commentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    const comment = commentResult.rows[0];

    // 6. 检查是否已删除
    if (comment.deleted_at !== null) {
      return NextResponse.json(
        { error: 'Comment already deleted' },
        { status: 404 }
      );
    }

    // 7. 权限检查：验证删除者是否为评论作者
    const commentAuthor = bytesToAddress(comment.commenter);
    if (requester.toLowerCase() !== commentAuthor.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot delete this comment' },
        { status: 403 }
      );
    }

    // 8. 软删除（标记 deleted_at）
    const deleteResult = await query(
      `UPDATE comments 
       SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, content_id, commenter, text, signature, created_at, deleted_at`,
      [commentId]
    );

    if (!deleteResult.rows || deleteResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete comment' },
        { status: 500 }
      );
    }

    const deleted = deleteResult.rows[0];
    return NextResponse.json({
      id: deleted.id,
      contentId: deleted.content_id,
      commenter: bytesToAddress(deleted.commenter),
      text: deleted.text,
      signature: deleted.signature,
      createdAt: Math.floor(new Date(deleted.created_at).getTime() / 1000),
      deletedAt: Math.floor(new Date(deleted.deleted_at).getTime() / 1000),
    });
  } catch (error) {
    console.error('DELETE /api/comments/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
