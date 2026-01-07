import pg from 'pg';
const { Pool } = pg;

// Connection pools
const primaryPool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'admin',
  password: 'admin123',
  database: 'scalingdb',
});

const replicaPool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'admin',
  password: 'admin123',
  database: 'scalingdb',
});

async function demonstrateReadReplicas() {
  console.log('🎯 Read Replicas Demo\n');
  console.log('=' .repeat(60));
  console.log('\nThis demo shows how to distribute read load across databases');
  console.log('In production, replicas automatically sync from primary\n');
  console.log('=' .repeat(60));
  console.log('');

  try {
    // 1. Read from primary
    console.log('📖 Reading from PRIMARY database (port 5432)...');
    const primaryStart = Date.now();
    const primaryResult = await primaryPool.query(`
      SELECT u.username, COUNT(p.id) as post_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      GROUP BY u.id, u.username
      ORDER BY post_count DESC
      LIMIT 5;
    `);
    const primaryTime = Date.now() - primaryStart;
    console.log('  Top 5 users by post count:');
    primaryResult.rows.forEach((row, i) => {
      console.log(`    ${i + 1}. ${row.username} - ${row.post_count} posts`);
    });
    console.log(`  ⏱️  Query time: ${primaryTime}ms\n`);

    // 2. Read from replica
    console.log('📖 Reading from REPLICA database (port 5433)...');
    const replicaStart = Date.now();
    const replicaResult = await replicaPool.query(`
      SELECT u.username, COUNT(p.id) as post_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      GROUP BY u.id, u.username
      ORDER BY post_count DESC
      LIMIT 5;
    `);
    const replicaTime = Date.now() - replicaStart;
    console.log('  Top 5 users by post count:');
    replicaResult.rows.forEach((row, i) => {
      console.log(`    ${i + 1}. ${row.username} - ${row.post_count} posts`);
    });
    console.log(`  ⏱️  Query time: ${replicaTime}ms\n`);

    // 3. Write to primary
    console.log('✍️  Writing NEW USER to PRIMARY database...');
    const newUsername = `demo_user_${Date.now()}`;
    const newEmail = `${newUsername}@example.com`;
    
    const writeStart = Date.now();
    const writeResult = await primaryPool.query(
      'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username',
      [newUsername, newEmail]
    );
    const writeTime = Date.now() - writeStart;
    
    console.log(`  ✅ User created: ${writeResult.rows[0].username}`);
    console.log(`  ⏱️  Write time: ${writeTime}ms\n`);

    // 4. Show the new user is only on primary (not replica yet)
    console.log('🔍 Checking if new user exists...');
    
    const checkPrimary = await primaryPool.query(
      'SELECT username FROM users WHERE username = $1',
      [newUsername]
    );
    console.log(`  PRIMARY: ${checkPrimary.rows.length > 0 ? '✅ Found' : '❌ Not found'}`);
    
    const checkReplica = await replicaPool.query(
      'SELECT username FROM users WHERE username = $1',
      [newUsername]
    );
    console.log(`  REPLICA: ${checkReplica.rows.length > 0 ? '✅ Found' : '⏳ Not yet synced (would sync automatically in production)'}\n`);

    // 5. Show statistics
    const primaryCount = await primaryPool.query('SELECT COUNT(*) FROM users');
    const replicaCount = await replicaPool.query('SELECT COUNT(*) FROM users');

    console.log('=' .repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  • Primary users: ${primaryCount.rows[0].count}`);
    console.log(`  • Replica users: ${replicaCount.rows[0].count}`);
    console.log(`  • Primary read time: ${primaryTime}ms`);
    console.log(`  • Replica read time: ${replicaTime}ms`);
    console.log(`  • Write time: ${writeTime}ms`);
    
    console.log('\n💡 Key Concepts:');
    console.log('  • Writes go to PRIMARY only');
    console.log('  • Reads can go to PRIMARY or REPLICA');
    console.log('  • Distributing reads reduces load on primary');
    console.log('  • In production, replicas auto-sync from primary');
    console.log('\n📚 Use Cases:');
    console.log('  • Reporting queries → Send to replica');
    console.log('  • Analytics → Send to replica');
    console.log('  • User-facing reads → Can use replica');
    console.log('  • All writes → Must go to primary\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await primaryPool.end();
    await replicaPool.end();
  }
}

demonstrateReadReplicas();
