-- Migration: 创建评论表
-- Created: 2026-03-06

-- 创建 comments 表
CREATE TABLE IF NOT EXISTS comments (
    id BIGSERIAL PRIMARY KEY,
    content_id BIGINT NOT NULL,
    commenter BYTEA NOT NULL,
    text TEXT NOT NULL CHECK (char_length(text) >= 1 AND char_length(text) <= 500),
    signature TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 创建索引以优化查询性能
CREATE INDEX idx_comments_content_id ON comments(content_id);
CREATE INDEX idx_comments_commenter ON comments(commenter);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX idx_comments_deleted_at ON comments(deleted_at) WHERE deleted_at IS NULL;

-- 创建复合索引以优化查询
CREATE INDEX idx_comments_content_active ON comments(content_id, created_at DESC) 
    WHERE deleted_at IS NULL;

-- 添加表注释
COMMENT ON TABLE comments IS '用户评论表';
COMMENT ON COLUMN comments.id IS '主键ID';
COMMENT ON COLUMN comments.content_id IS '内容ID（对应链上内容）';
COMMENT ON COLUMN comments.commenter IS '评论者地址（BYTEA格式，20字节）';
COMMENT ON COLUMN comments.text IS '评论文本（1-500字符）';
COMMENT ON COLUMN comments.signature IS 'EIP-191签名';
COMMENT ON COLUMN comments.message IS '签名的原始消息';
COMMENT ON COLUMN comments.timestamp IS '签名时的时间戳（Unix秒）';
COMMENT ON COLUMN comments.created_at IS '创建时间';
COMMENT ON COLUMN comments.deleted_at IS '软删除时间（NULL表示未删除）';
