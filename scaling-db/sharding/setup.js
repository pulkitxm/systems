import { getAllShards, closeAllShards } from './shard-manager.js';

async function setupShard(shard) {
  console.log(`\n📦 Setting up ${shard.name}...`);
  
  try {
    // Create users table
    await shard.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`  ✅ Created users table in ${shard.name}`);

    // Create posts table
    await shard.pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log(`  ✅ Created posts table in ${shard.name}`);

    // Create indexes
    await shard.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
    `);
    console.log(`  ✅ Created indexes in ${shard.name}`);

    // Add shard metadata
    await shard.pool.query(`
      CREATE TABLE IF NOT EXISTS shard_metadata (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT
      );
    `);
    
    await shard.pool.query(`
      INSERT INTO shard_metadata (key, value) 
      VALUES ('shard_id', $1), ('shard_name', $2), ('range_start', $3), ('range_end', $4)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `, [shard.id.toString(), shard.name, shard.range.start, shard.range.end]);
    
    console.log(`  ✅ Added metadata to ${shard.name}`);

  } catch (error) {
    console.error(`  ❌ Error setting up ${shard.name}:`, error.message);
    throw error;
  }
}

async function setup() {
  console.log('🚀 Setting up sharded database architecture...\n');
  console.log('=' .repeat(60));
  console.log('\nSharding Strategy:');
  console.log('  • Shard Key: First character of username');
  console.log('  • Shard 1 (port 5441): Users A-M');
  console.log('  • Shard 2 (port 5442): Users N-Z');
  console.log('  • Shard 3 (port 5443): Users starting with numbers');
  console.log('\n' + '=' .repeat(60));

  const shards = getAllShards();

  try {
    // Setup all shards
    for (const shard of shards) {
      await setupShard(shard);
    }

    console.log('\n✨ All shards setup complete!\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run populate    (to add sample data)');
    console.log('  2. Run: npm run demo         (to see sharding in action)');
    console.log('  3. Run: npm run query        (to see different query patterns)');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await closeAllShards();
  }
}

setup();

