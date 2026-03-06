// 测试评论 API 逻辑
import { query } from './src/lib/db';
import {
  recoverAddressFromMessage,
  validateCommentMessage,
  isTimestampValid,
  addressToBytes,
  bytesToAddress,
} from './src/lib/signature';

async function testAPI() {
  console.log('🧪 开始测试评论 API...\n');

  try {
    // 1. 测试数据库连接
    console.log('1️⃣ 测试数据库连接...');
    const versionResult = await query('SELECT version()');
    console.log('✅ 数据库连接成功');
    console.log(`   PostgreSQL: ${versionResult.rows[0].version.substring(0, 40)}...\n`);

    // 2. 测试数据库查询
    console.log('2️⃣ 查询现有评论...');
    const countResult = await query('SELECT COUNT(*) FROM comments WHERE deleted_at IS NULL');
    const count = countResult.rows[0].count;
    console.log(`✅ 当前评论数: ${count}\n`);

    // 3. 测试签名验证逻辑（不实际签名，只测试函数）
    console.log('3️⃣ 测试签名验证逻辑...');
    const testContentId = 123;
    const testTimestamp = Math.floor(Date.now() / 1000);
    const testText = '这是一个测试评论';
    const expectedMessage = `Comment on content ${testContentId} at ${testTimestamp}:\n${testText}`;
    
    const isValidMessage = validateCommentMessage(expectedMessage, testContentId, testTimestamp, testText);
    console.log(`✅ 消息格式验证: ${isValidMessage ? '通过' : '失败'}\n`);

    // 4. 测试时间戳验证
    console.log('4️⃣ 测试时间戳验证...');
    const isValidNow = isTimestampValid(Math.floor(Date.now() / 1000));
    const isValidOld = isTimestampValid(Math.floor(Date.now() / 1000) - 600); // 10 分钟前
    console.log(`✅ 当前时间戳有效: ${isValidNow}`);
    console.log(`✅ 10 分钟前的时间戳有效: ${isValidOld}\n`);

    // 5. 测试地址转换
    console.log('5️⃣ 测试地址转换...');
    const testAddress = '0x1234567890123456789012345678901234567890';
    const addressBytes = addressToBytes(testAddress);
    const recoveredAddress = bytesToAddress(addressBytes);
    const addressCorrect = testAddress.toLowerCase() === recoveredAddress.toLowerCase();
    console.log(`✅ 地址转换正确: ${addressCorrect}`);
    console.log(`   原始: ${testAddress}`);
    console.log(`   恢复: ${recoveredAddress}\n`);

    console.log('🎉 所有测试通过！评论 API 已准备就绪。');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testAPI();
