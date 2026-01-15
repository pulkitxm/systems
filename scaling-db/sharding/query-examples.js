import { 
  getShardForUser, 
  getAllShards, 
  queryAllShards,
  closeAllShards 
} from './shard-manager.js';

async function runQueryExamples() {
  console.log('🔍 Sharding Query Patterns\n');
  console.log('=' .repeat(60));
  console.log('');

  try {
    // Pattern 1: Point Query (Best Case)
    console.log('📌 PATTERN 1: Point Query (Single Shard)\n');
    console.log('Query: Find user by username\n');
    console.log('✅ GOOD: We know the shard key (username)');
    console.log('✅ Only queries ONE shard\n');

    const username = 'alice_smith';
    const shard = getShardForUser(username);
    
    const start1 = Date.now();
    const result1 = await shard.pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    const time1 = Date.now() - start1;

    console.log(`  Result: Found ${result1.rows.length} user(s)`);
    console.log(`  Shard: ${shard.name.toUpperCase()}`);
    console.log(`  Time: ${time1}ms`);
    console.log('  Shards queried: 1/3 (33%)\n');

    // Pattern 2: Scatter-Gather (Worst Case)
    console.log('\n📡 PATTERN 2: Scatter-Gather (All Shards)\n');
    console.log('Query: Count all users\n');
    console.log('⚠️  SLOW: Must query ALL shards');
    console.log('⚠️  Results must be aggregated\n');

    const start2 = Date.now();
    const results2 = await queryAllShards('SELECT COUNT(*) as count FROM users');
    const time2 = Date.now() - start2;

    let totalUsers = 0;
    results2.forEach(r => {
      if (r.data && r.data[0]) {
        totalUsers += parseInt(r.data[0].count);
        console.log(`  ${r.shard.toUpperCase()}: ${r.data[0].count} users`);
      }
    });

    console.log(`\n  Total: ${totalUsers} users`);
    console.log(`  Time: ${time2}ms`);
    console.log('  Shards queried: 3/3 (100%)\n');

    // Pattern 3: Range Query on Shard Key
    console.log('\n📊 PATTERN 3: Range Query on Shard Key\n');
    console.log('Query: Find all users starting with \'a\'\n');
    console.log('✅ GOOD: We can determine which shard(s) to query');
    console.log('✅ Only queries relevant shard(s)\n');

    const shard1 = getAllShards()[0]; // Shard 1 has A-M
    const start3 = Date.now();
    const result3 = await shard1.pool.query(
      "SELECT username FROM users WHERE username LIKE 'a%' ORDER BY username LIMIT 10"
    );
    const time3 = Date.now() - start3;

    console.log(`  Results:`);
    result3.rows.forEach((row, i) => {
      console.log(`    ${i + 1}. ${row.username}`);
    });
    console.log(`\n  Time: ${time3}ms`);
    console.log('  Shards queried: 1/3 (33%)\n');

    // Pattern 4: Join within Shard
    console.log('\n🔗 PATTERN 4: Join Within Shard\n');
    console.log('Query: Get user with their posts\n');
    console.log('✅ GOOD: Related data is co-located in same shard');
    console.log('✅ JOIN works normally within a shard\n');

    const joinUsername = 'alice_smith';
    const joinShard = getShardForUser(joinUsername);
    
    const start4 = Date.now();
    const result4 = await joinShard.pool.query(`
      SELECT u.username, COUNT(p.id) as post_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      WHERE u.username = $1
      GROUP BY u.id, u.username;
    `, [joinUsername]);
    const time4 = Date.now() - start4;

    if (result4.rows.length > 0) {
      console.log(`  User: ${result4.rows[0].username}`);
      console.log(`  Posts: ${result4.rows[0].post_count}`);
      console.log(`  Time: ${time4}ms`);
      console.log(`  Shard: ${joinShard.name.toUpperCase()}`);
      console.log('  Shards queried: 1/3 (33%)\n');
    }

    // Pattern 5: Cross-Shard Join (Bad!)
    console.log('\n❌ PATTERN 5: Cross-Shard Join (AVOID!)\n');
    console.log('Query: Find users who commented on posts by other users\n');
    console.log('❌ BAD: Would require joining data across shards');
    console.log('❌ Very expensive and complex\n');
    console.log('  Solutions:');
    console.log('    • Denormalize data (duplicate where needed)');
    console.log('    • Use application-level joins');
    console.log('    • Rethink your shard key');
    console.log('    • Use a separate service for cross-shard queries\n');

    // Pattern 6: Aggregation across shards
    console.log('\n📈 PATTERN 6: Aggregation Across Shards\n');
    console.log('Query: Get top 5 users by post count\n');
    console.log('⚠️  COMPLEX: Must aggregate from all shards\n');

    const start6 = Date.now();
    const results6 = await queryAllShards(`
      SELECT u.username, COUNT(p.id) as post_count
      FROM users u
      LEFT JOIN posts p ON u.id = p.user_id
      GROUP BY u.id, u.username
      ORDER BY post_count DESC
      LIMIT 5;
    `);
    const time6 = Date.now() - start6;

    // Merge and re-sort results from all shards
    const allResults = [];
    results6.forEach(r => {
      if (r.data) {
        allResults.push(...r.data);
      }
    });
    allResults.sort((a, b) => b.post_count - a.post_count);
    const top5 = allResults.slice(0, 5);

    console.log('  Top 5 users:');
    top5.forEach((row, i) => {
      console.log(`    ${i + 1}. ${row.username} - ${row.post_count} posts`);
    });
    console.log(`\n  Time: ${time6}ms`);
    console.log('  Shards queried: 3/3 (100%)');
    console.log('  Note: Results merged and re-sorted in application\n');

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('\n📚 Query Pattern Summary:\n');
    console.log('  ✅ FAST:  Point queries with shard key');
    console.log('  ✅ FAST:  Range queries on shard key');
    console.log('  ✅ FAST:  JOINs within same shard');
    console.log('  ⚠️  SLOW:  Scatter-gather queries');
    console.log('  ⚠️  SLOW:  Aggregations across shards');
    console.log('  ❌ AVOID: Cross-shard JOINs');
    console.log('\n💡 Key Principle: Choose shard key based on query patterns!');
    console.log('\n' + '=' .repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await closeAllShards();
  }
}

runQueryExamples();

