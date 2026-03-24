// 测试数据库连接脚本
const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '123456',
    database: 'bloom_social'
  });

  try {
    console.log('正在连接数据库...');
    await client.connect();
    console.log('✅ 数据库连接成功！');

    // 查询数据库版本
    const versionResult = await client.query('SELECT version();');
    console.log('\n数据库版本:');
    console.log(versionResult.rows[0].version);

    // 查询当前数据库
    const dbResult = await client.query('SELECT current_database();');
    console.log('\n当前数据库:', dbResult.rows[0].current_database);

    // 查询 comments 表结构
    const tableResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'comments'
      ORDER BY ordinal_position;
    `);
    
    console.log('\ncomments 表字段:');
    tableResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // 查询 comments 表记录数
    const countResult = await client.query('SELECT COUNT(*) FROM comments;');
    console.log('\n评论总数:', countResult.rows[0].count);

    console.log('\n✅ 数据库环境验证通过！');
  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n数据库连接已关闭。');
  }
}

testConnection();
