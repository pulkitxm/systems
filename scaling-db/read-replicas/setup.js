import pg from 'pg';
const { Pool } = pg;

// Connection to primary database
const primaryPool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'admin',
  password: 'admin123',
  database: 'scalingdb',
});

// Connection to replica database
const replicaPool = new Pool({
  host: 'localhost',
  port: 5433,
  user: 'admin',
  password: 'admin123',
  database: 'scalingdb',
});

async function setup() {
  console.log('🚀 Setting up database schema...\n');

  try {
    // Create schema on PRIMARY
    console.log('📦 Setting up PRIMARY database (port 5432)...');
    await primaryPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  ✅ Created users table on primary');

    await primaryPool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        content TEXT,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  ✅ Created posts table on primary');

    // Create same schema on REPLICA
    console.log('\n📦 Setting up REPLICA database (port 5433)...');
    await replicaPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  ✅ Created users table on replica');

    await replicaPool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        content TEXT,
        views INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  ✅ Created posts table on replica');

    console.log('\n✨ Database setup complete!\n');
    console.log('📝 Note: This is a simplified demo. In production:');
    console.log('   • Use actual PostgreSQL replication (streaming/logical)');
    console.log('   • Replicas would be read-only');
    console.log('   • Data syncs automatically from primary to replica\n');
    console.log('Next steps:');
    console.log('  1. Run: npm run populate    (to add sample data)');
    console.log('  2. Run: npm run demo         (to see read replicas in action)');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await primaryPool.end();
    await replicaPool.end();
  }
}

setup();
