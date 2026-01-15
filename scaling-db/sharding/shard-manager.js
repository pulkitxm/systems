import pg from 'pg';
const { Pool } = pg;

// Shard configuration
const SHARDS = [
  {
    id: 1,
    name: 'shard1',
    pool: new Pool({
      host: 'localhost',
      port: 5441,
      user: 'admin',
      password: 'admin123',
      database: 'shard1_db',
    }),
    range: { start: 'a', end: 'm' } // Users A-M
  },
  {
    id: 2,
    name: 'shard2',
    pool: new Pool({
      host: 'localhost',
      port: 5442,
      user: 'admin',
      password: 'admin123',
      database: 'shard2_db',
    }),
    range: { start: 'n', end: 'z' } // Users N-Z
  },
  {
    id: 3,
    name: 'shard3',
    pool: new Pool({
      host: 'localhost',
      port: 5443,
      user: 'admin',
      password: 'admin123',
      database: 'shard3_db',
    }),
    range: { start: '0', end: '9' } // Users starting with numbers
  }
];

/**
 * Determine which shard a user belongs to based on username
 * Shard key: First character of username
 */
export function getShardForUser(username) {
  const firstChar = username[0].toLowerCase();
  
  // Check if it's a letter
  if (firstChar >= 'a' && firstChar <= 'm') {
    return SHARDS[0]; // Shard 1
  } else if (firstChar >= 'n' && firstChar <= 'z') {
    return SHARDS[1]; // Shard 2
  } else {
    return SHARDS[2]; // Shard 3 (numbers and special chars)
  }
}

/**
 * Get all shards
 */
export function getAllShards() {
  return SHARDS;
}

/**
 * Get a specific shard by ID
 */
export function getShardById(shardId) {
  return SHARDS.find(s => s.id === shardId);
}

/**
 * Close all shard connections
 */
export async function closeAllShards() {
  await Promise.all(SHARDS.map(shard => shard.pool.end()));
}

/**
 * Execute query on a specific shard
 */
export async function queryOnShard(shard, query, params = []) {
  return await shard.pool.query(query, params);
}

/**
 * Execute query across all shards (scatter-gather)
 */
export async function queryAllShards(query, params = []) {
  const results = await Promise.all(
    SHARDS.map(async (shard) => {
      try {
        const result = await shard.pool.query(query, params);
        return { shard: shard.name, data: result.rows };
      } catch (error) {
        return { shard: shard.name, error: error.message };
      }
    })
  );
  return results;
}

/**
 * Get user by username (single shard lookup)
 */
export async function getUserByUsername(username) {
  const shard = getShardForUser(username);
  const result = await shard.pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );
  return result.rows[0];
}

/**
 * Create user (routes to correct shard)
 */
export async function createUser(username, email) {
  const shard = getShardForUser(username);
  const result = await shard.pool.query(
    'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
    [username, email]
  );
  return { shard: shard.name, user: result.rows[0] };
}

/**
 * Get all users (requires querying all shards)
 */
export async function getAllUsers() {
  const results = await queryAllShards('SELECT * FROM users ORDER BY username');
  
  // Merge results from all shards
  const allUsers = [];
  results.forEach(result => {
    if (result.data) {
      allUsers.push(...result.data);
    }
  });
  
  // Sort merged results
  allUsers.sort((a, b) => a.username.localeCompare(b.username));
  return allUsers;
}

/**
 * Get user count across all shards
 */
export async function getTotalUserCount() {
  const results = await queryAllShards('SELECT COUNT(*) as count FROM users');
  
  let total = 0;
  results.forEach(result => {
    if (result.data && result.data[0]) {
      total += parseInt(result.data[0].count);
    }
  });
  
  return total;
}

