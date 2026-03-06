import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  recoverAddressFromMessage,
  validateCommentMessage,
  validateDeleteMessage,
  isTimestampValid,
  addressToBytes,
  bytesToAddress,
} from '@/lib/signature';

// 简单的速率限制 (内存中，仅用于演示)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(address);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(address, { count: 1, resetTime: now + 60000 }); // 60 秒窗口
    return true;
  }

  if (record.count >= 10) {
    return false; // 超过限制
  }

  record.count++;
  return true;
}

/**
 * POST /api/comments
 * 创建新评论
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentId, text, message, signature, timestamp } = body;

    // 1. 参数验证
    if (!contentId || !text || !message || !signature || timestamp === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 2. 文本长度验证
    if (typeof text !== 'string' || text.length < 1 || text.length > 500) {
      return NextResponse.json(
        { error: 'Comment text must be 1-500 characters' },
        { status: 400 }
      );
    }

    // 3. 时间戳验证
    if (!isTimestampValid(timestamp)) {
      return NextResponse.json(
        { error: 'Timestamp expired (must be within ±5 minutes)' },
        { status: 400 }
      );
    }

    // 4. 签名恢复和验证
    let commenter: string;
    try {
      commenter = await recoverAddressFromMessage(message, signature);
    } catch (error) {
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
    }

    // 5. 验证消息格式
    if (!validateCommentMessage(message, contentId, timestamp, text)) {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      );
    }

    // 6. 速率限制
    if (!checkRateLimit(commenter)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before posting another comment' },
        { status: 429 }
      );
    }

    // 7. 验证内容 ID 存在（可选）
    // 如果 contentId 指向链上的内容，可以在这里验证
    // 目前跳过，因为数据在链上

    // 8. 插入数据库
    const result = await query(
      `INSERT INTO comments (content_id, commenter, text, signature, message, timestamp, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, content_id, commenter, text, signature, created_at`,
      [contentId, addressToBytes(commenter), text, signature, message, timestamp]
    );

    if (!result.rows || result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    const comment = result.rows[0];
    return NextResponse.json(
      {
        id: comment.id,
        contentId: comment.content_id,
        commenter: bytesToAddress(comment.commenter),
        text: comment.text,
        signature: comment.signature,
        createdAt: Math.floor(new Date(comment.created_at).getTime() / 1000),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comments?contentId=123&limit=20&offset=0
 * 获取评论列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const contentId = searchParams.get('contentId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100); // 最多 100
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // 1. 参数验证
    if (!contentId) {
      return NextResponse.json(
        { error: 'Missing contentId' },
        { status: 400 }
      );
    }

    const contentIdNum = parseInt(contentId);
    if (isNaN(contentIdNum)) {
      return NextResponse.json(
        { error: 'Invalid contentId' },
        { status: 400 }
      );
    }

    // 2. 查询总数
    const countResult = await query(
      `SELECT COUNT(*) as total FROM comments 
       WHERE content_id = $1 AND deleted_at IS NULL`,
      [contentIdNum]
    );

    const total = parseInt(countResult.rows[0].total) || 0;

    // 3. 查询评论列表
    const result = await query(
      `SELECT id, content_id, commenter, text, signature, created_at
       FROM comments
       WHERE content_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [contentIdNum, limit, offset]
    );

    // 4. 格式化返回数据
    const comments = result.rows.map((row: any) => ({
      id: row.id,
      contentId: row.content_id,
      commenter: bytesToAddress(row.commenter),
      text: row.text,
      signature: row.signature,
      createdAt: Math.floor(new Date(row.created_at).getTime() / 1000),
    }));

    return NextResponse.json({
      data: comments,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('GET /api/comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
