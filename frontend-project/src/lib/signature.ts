import { recoverMessageAddress } from 'viem';

/**
 * EIP-191 签名消息格式
 */
export const SIGN_MESSAGE_PREFIX = '\x19Ethereum Signed Message:\n';

/**
 * 从签名和消息中恢复地址
 * @param message 原始消息
 * @param signature EIP-191 签名
 * @returns 恢复的地址（0x 开头的小写字符串）
 */
export async function recoverAddressFromMessage(
  message: string,
  signature: string
): Promise<string> {
  try {
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    return recovered.toLowerCase();
  } catch (error) {
    console.error('Signature recovery error:', error);
    throw new Error('Invalid signature');
  }
}

/**
 * 验证评论消息格式
 * 格式应为: "Comment on content {contentId} at {timestamp}:\n{text}"
 */
export function validateCommentMessage(
  message: string,
  contentId: number,
  timestamp: number,
  text: string
): boolean {
  const expectedMessage = `Comment on content ${contentId} at ${timestamp}:\n${text}`;
  return message === expectedMessage;
}

/**
 * 验证删除消息格式
 * 格式应为: "Delete comment {commentId}"
 */
export function validateDeleteMessage(
  message: string,
  commentId: number
): boolean {
  const expectedMessage = `Delete comment ${commentId}`;
  return message === expectedMessage;
}

/**
 * 验证时间戳是否在有效范围内（±5 分钟）
 */
export function isTimestampValid(timestamp: number, tolerance: number = 300): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  return diff <= tolerance;
}

/**
 * 验证以太坊地址格式
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 将地址转换为 BYTEA 格式（PostgreSQL）
 * 地址 0x1234... → bytea '\x1234...'
 */
export function addressToBytes(address: string): Buffer {
  if (!isValidAddress(address)) {
    throw new Error('Invalid Ethereum address');
  }
  return Buffer.from(address.slice(2), 'hex');
}

/**
 * 将 BYTEA 格式转回地址
 * bytea '\x1234...' → 0x1234...
 */
export function bytesToAddress(bytes: Buffer): string {
  return '0x' + bytes.toString('hex');
}

/**
 * 缩写地址，用于前端显示
 * 0x1234567890abcdef... → 0x1234...abcdef
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!isValidAddress(address)) return address;
  return `${address.substring(0, chars + 2)}...${address.substring(42 - chars)}`;
}
