import pg from 'pg';
const { Pool } = pg;

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

// Generate random data
function generateUsername(index) {
  const adjectives = ['happy', 'clever', 'brave', 'swift', 'bright', 'calm', 'cool', 'wise'];
  const nouns = ['tiger', 'eagle', 'lion', 'wolf', 'bear', 'fox', 'hawk', 'panda'];
  return `${adjectives[index % adjectives.length]}_${nouns[Math.floor(index / adjectives.length) % nouns.length]}${index}`;
}

function generateEmail(username) {
  return `${username}@example.com`;
}

function generateTitle(index) {
  const titles = [
    'Getting Started with PostgreSQL',
    'Understanding Database Replication',
    'Scaling Your Database',
    'Best Practices for SQL',
    'Optimizing Query Performance',
  ];
  return `${titles[index % titles.length]} - Part ${Math.floor(index / titles.length) + 1}`;
}

function generateContent(title) {
  return `This is a detailed post about "${title}". It contains valuable information about database concepts and best practices.`;
}

async function populateData() {
  console.log('🌱 Populating databases with sample data...\n');

  try {
    // Insert into PRIMARY
    console.log('📝 Inserting data into PRIMARY (port 5432)...');
    const userIds = [];
    
    for (let i = 0; i < 50; i++) {
      const username = generateUsername(i);
      const email = generateEmail(username);
      
      const result = await primaryPool.query(
        'INSERT INTO users (username, email) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING id',
        [username, email]
      );
      
      if (result.rows[0]) {
        userIds.push(result.rows[0].id);
      }
    }
    console.log(`  ✅ Inserted ${userIds.length} users`);

    // Insert posts
    for (let i = 0; i < 200; i++) {
      const userId = userIds[Math.floor(Math.random() * userIds.length)];
      const title = generateTitle(i);
      const content = generateContent(title);
      const views = Math.floor(Math.random() * 1000);
      
      await primaryPool.query(
        'INSERT INTO posts (user_id, title, content, views) VALUES ($1, $2, $3, $4)',
        [userId, title, content, views]
      );
    }
    console.log(`  ✅ Inserted 200 posts`);

    // Copy data to REPLICA (simulating replication)
    console.log('\n📋 Copying data to REPLICA (port 5433)...');
    console.log('  ℹ️  In production, this happens automatically via streaming replication');
    
    // Get all users from primary
    const users = await primaryPool.query('SELECT * FROM users ORDER BY id');
    for (const user of users.rows) {
      await replicaPool.query(
        'INSERT INTO users (id, username, email, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
        [user.id, user.username, user.email, user.created_at]
      );
    }
    console.log(`  ✅ Copied ${users.rows.length} users to replica`);

    // Get all posts from primary
    const posts = await primaryPool.query('SELECT * FROM posts ORDER BY id');
    for (const post of posts.rows) {
      await replicaPool.query(
        'INSERT INTO posts (id, user_id, title, content, views, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [post.id, post.user_id, post.title, post.content, post.views, post.created_at]
      );
    }
    console.log(`  ✅ Copied ${posts.rows.length} posts to replica`);

    // Reset sequences on replica
    await replicaPool.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    await replicaPool.query(`SELECT setval('posts_id_seq', (SELECT MAX(id) FROM posts))`);

    console.log('\n✨ Data population complete!\n');
    console.log('💡 Run: npm run demo (to see read replicas in action)\n');

  } catch (error) {
    console.error('❌ Error populating data:', error.message);
    process.exit(1);
  } finally {
    await primaryPool.end();
    await replicaPool.end();
  }
}

populateData();
