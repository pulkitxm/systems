import { 
  getShardForUser, 
  getAllShards, 
  getUserByUsername,
  createUser,
  getAllUsers,
  getTotalUserCount,
  queryAllShards,
  closeAllShards 
} from './shard-manager.js';

async function demonstrateSharding() {
  console.log('🎯 Database Sharding Demo\n');
  console.log('=' .repeat(60));
  console.log('\nSharding distributes data across multiple databases');
  console.log('Each shard holds a subset of the data\n');
  console.log('=' .repeat(60));
  console.log('');

  try {
    // 1. Show shard routing
    console.log('📍 DEMO 1: Shard Routing\n');
    console.log('Let\'s see which shard different usernames go to:\n');

    const testUsernames = ['alice_smith', 'nathan_jones', 'zack_brown', '123user'];
    for (const username of testUsernames) {
      const shard = getShardForUser(username);
      console.log(`  • "${username}" → ${shard.name.toUpperCase()} (port ${shard.pool.options.port})`);
      console.log(`    Range: ${shard.range.start.toUpperCase()}-${shard.range.end.toUpperCase()}`);
    }

    // 2. Single shard query (fast)
    console.log('\n\n📖 DEMO 2: Single Shard Query (FAST)\n');
    console.log('Looking up a specific user by username...\n');

    const username = 'alice_smith';
    const startTime = Date.now();
    const user = await getUserByUsername(username);
    const queryTime = Date.now() - startTime;

    if (user) {
      console.log(`  ✅ Found user: ${user.username}`);
      console.log(`  • Email: ${user.email}`);
      console.log(`  • Created: ${user.created_at}`);
      console.log(`  ⏱️  Query time: ${queryTime}ms`);
      console.log('\n  💡 This query only hit ONE shard (fast!)');
    } else {
      console.log('  ⚠️  User not found');
    }

    // 3. Cross-shard query (slower)
    console.log('\n\n📊 DEMO 3: Cross-Shard Query (SLOWER)\n');
    console.log('Getting total user count across ALL shards...\n');

    const countStart = Date.now();
    const totalCount = await getTotalUserCount();
    const countTime = Date.now() - countStart;

    console.log(`  ✅ Total users across all shards: ${totalCount}`);
    console.log(`  ⏱️  Query time: ${countTime}ms`);
    console.log('\n  💡 This query hit ALL shards (scatter-gather pattern)');

    // 4. Show data distribution
    console.log('\n\n📈 DEMO 4: Data Distribution\n');
    console.log('Let\'s see how data is distributed:\n');

    const shards = getAllShards();
    for (const shard of shards) {
      const userCount = await shard.pool.query('SELECT COUNT(*) FROM users');
      const postCount = await shard.pool.query('SELECT COUNT(*) FROM posts');
      
      console.log(`  ${shard.name.toUpperCase()}:`);
      console.log(`    • Users: ${userCount.rows[0].count}`);
      console.log(`    • Posts: ${postCount.rows[0].count}`);
    }

    // 5. Create new user (shows routing)
    console.log('\n\n✍️  DEMO 5: Creating New User\n');
    console.log('Creating a new user and routing to correct shard...\n');

    const newUsername = `demo_user_${Date.now()}`;
    const newEmail = `${newUsername}@example.com`;
    
    const targetShard = getShardForUser(newUsername);
    console.log(`  📍 Username "${newUsername}" will go to: ${targetShard.name.toUpperCase()}`);
    
    const createStart = Date.now();
    const result = await createUser(newUsername, newEmail);
    const createTime = Date.now() - createStart;

    console.log(`  ✅ User created in ${result.shard.toUpperCase()}`);
    console.log(`  • ID: ${result.user.id}`);
    console.log(`  • Username: ${result.user.username}`);
    console.log(`  ⏱️  Write time: ${createTime}ms`);

    // 6. Show posts for a specific user
    console.log('\n\n📝 DEMO 6: User\'s Posts (Single Shard)\n');
    console.log('Getting all posts for a specific user...\n');

    const postUsername = 'alice_smith';
    const userShard = getShardForUser(postUsername);
    
    const postsResult = await userShard.pool.query(`
      SELECT p.title, p.created_at
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE u.username = $1
      ORDER BY p.created_at DESC
      LIMIT 5;
    `, [postUsername]);

    console.log(`  User: ${postUsername}`);
    console.log(`  Shard: ${userShard.name.toUpperCase()}`);
    console.log(`  Posts found: ${postsResult.rows.length}\n`);
    
    postsResult.rows.forEach((post, i) => {
      console.log(`    ${i + 1}. ${post.title}`);
    });

    console.log('\n  💡 All user data is in ONE shard (data locality)');

    // Summary
    console.log('\n\n' + '=' .repeat(60));
    console.log('\n🎓 Key Takeaways:\n');
    console.log('  ✅ Single-shard queries are FAST (only one DB hit)');
    console.log('  ⚠️  Cross-shard queries are SLOWER (multiple DB hits)');
    console.log('  📍 Shard key (username) determines data placement');
    console.log('  🎯 Related data stays together (user + their posts)');
    console.log('  📈 Each shard can scale independently');
    console.log('\n' + '=' .repeat(60));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await closeAllShards();
  }
}

demonstrateSharding();

