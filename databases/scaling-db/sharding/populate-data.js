import { getShardForUser, getAllShards, closeAllShards } from './shard-manager.js';

// Sample data generators
const firstNames = ['alice', 'bob', 'charlie', 'david', 'emma', 'frank', 'grace', 'henry', 
                    'isabel', 'jack', 'kate', 'liam', 'mia', 'noah', 'olivia', 'peter',
                    'quinn', 'rachel', 'sam', 'tina', 'uma', 'victor', 'wendy', 'xander',
                    'yara', 'zack'];

const lastNames = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller',
                   'davis', 'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez'];

const postTitles = [
  'Getting Started with Sharding',
  'Database Design Best Practices',
  'Understanding Distributed Systems',
  'Scaling Your Application',
  'Introduction to PostgreSQL',
  'Microservices Architecture',
  'API Design Patterns',
  'Performance Optimization Tips',
  'Cloud Computing Basics',
  'DevOps Best Practices'
];

function generateUsername(firstName, lastName, index) {
  return `${firstName}_${lastName}${index}`;
}

function generateEmail(username) {
  return `${username}@example.com`;
}

function generatePostContent(title) {
  return `This is a detailed post about "${title}". It contains valuable information and insights. Lorem ipsum dolor sit amet, consectetur adipiscing elit.`;
}

async function populateData() {
  console.log('🌱 Populating sharded databases with sample data...\n');

  const usersByShard = { shard1: 0, shard2: 0, shard3: 0 };
  const postsByShard = { shard1: 0, shard2: 0, shard3: 0 };

  try {
    // Generate and insert users
    console.log('📝 Inserting users across shards...');
    const userMap = new Map(); // username -> {shard, userId}

    let totalUsers = 0;
    for (let i = 0; i < firstNames.length; i++) {
      for (let j = 0; j < lastNames.length; j++) {
        const firstName = firstNames[i];
        const lastName = lastNames[j];
        const username = generateUsername(firstName, lastName, '');
        const email = generateEmail(username);

        // Determine which shard this user belongs to
        const shard = getShardForUser(username);

        try {
          const result = await shard.pool.query(
            'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id',
            [username, email]
          );

          const userId = result.rows[0].id;
          userMap.set(username, { shard, userId });
          usersByShard[shard.name]++;
          totalUsers++;

          if (totalUsers % 50 === 0) {
            console.log(`  ✓ Inserted ${totalUsers} users`);
          }
        } catch (error) {
          // Skip duplicates
          if (!error.message.includes('duplicate')) {
            console.error(`  ⚠️  Error inserting user ${username}:`, error.message);
          }
        }
      }
    }

    console.log(`\n📝 Inserting posts across shards...`);
    let totalPosts = 0;

    // Insert posts for each user
    for (const [username, { shard, userId }] of userMap.entries()) {
      // Each user gets 2-5 posts
      const numPosts = Math.floor(Math.random() * 4) + 2;

      for (let i = 0; i < numPosts; i++) {
        const title = postTitles[Math.floor(Math.random() * postTitles.length)];
        const content = generatePostContent(title);

        await shard.pool.query(
          'INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3)',
          [userId, `${title} by ${username}`, content]
        );

        postsByShard[shard.name]++;
        totalPosts++;

        if (totalPosts % 100 === 0) {
          console.log(`  ✓ Inserted ${totalPosts} posts`);
        }
      }
    }

    // Show distribution across shards
    console.log('\n✨ Data population complete!\n');
    console.log('=' .repeat(60));
    console.log('\n📊 Data Distribution Across Shards:\n');

    const shards = getAllShards();
    for (const shard of shards) {
      const userCount = await shard.pool.query('SELECT COUNT(*) FROM users');
      const postCount = await shard.pool.query('SELECT COUNT(*) FROM posts');
      
      console.log(`${shard.name.toUpperCase()} (port ${shard.pool.options.port}):`);
      console.log(`  • Range: ${shard.range.start.toUpperCase()}-${shard.range.end.toUpperCase()}`);
      console.log(`  • Users: ${userCount.rows[0].count}`);
      console.log(`  • Posts: ${postCount.rows[0].count}`);
      console.log('');
    }

    console.log('=' .repeat(60));
    console.log('\n💡 Notice how data is distributed based on username!');
    console.log('💡 Run: npm run demo (to see sharding in action)\n');

  } catch (error) {
    console.error('❌ Error populating data:', error.message);
    process.exit(1);
  } finally {
    await closeAllShards();
  }
}

populateData();

