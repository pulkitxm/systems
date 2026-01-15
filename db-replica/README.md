# PostgreSQL Streaming Replication Demo

A hands-on demo for understanding database replication and failover. This project sets up a complete PostgreSQL streaming replication environment with a primary database and a read-only replica.

## TL;DR - How It Works

1. **Primary starts** → Creates `replicator` user → Configures `pg_hba.conf` for replication access
2. **Replica starts** → Runs `pg_basebackup -R` to copy all data from primary
3. **`-R` flag** creates `standby.signal` file → PostgreSQL sees this → Enters **read-only standby mode**
4. **Replica streams WAL** from primary → Applies changes → Stays in sync (async, ~ms lag)
5. **Replica is read-only** by design (writes blocked during recovery mode)
6. **To make replica writable** → `SELECT pg_promote()` removes standby mode

## What You'll Learn

- How PostgreSQL streaming replication works
- The difference between primary and standby databases
- How Write-Ahead Log (WAL) enables replication
- Replication lag and how to monitor it
- Manual failover process (promoting a replica)
- Why replicas are read-only by default

## Prerequisites

- Docker & Docker Compose
- Node.js 18+
- pnpm/npm
- Basic understanding of PostgreSQL

## Quick Start

```bash
# Start PostgreSQL primary and replica
docker compose up -d

# Wait ~10 seconds for initialization
sleep 10

# Install dependencies
pnpm install

# Run the replication demo
pnpm run demo
```

## What's Running

| Container    | Port | Role                        |
| ------------ | ---- | --------------------------- |
| pg_primary   | 5432 | Primary (accepts writes)    |
| pg_replica   | 5433 | Replica (read-only standby) |

## Project Structure

```
db-replica/
├── docker-compose.yml          # Defines primary and replica containers
├── primary-init/               # Scripts that run on primary startup
│   ├── 00-pg-hba.sh           # Configures replication access rules
│   └── 01-setup-replication.sql # Creates the replicator user
├── demo.js                     # Basic replication demonstration
├── failover-demo.js            # Disaster recovery simulation
└── package.json                # Node.js dependencies
```

## Demo Scripts

### 1. Basic Replication Demo (`pnpm run demo`)

Shows:
- Replication status check
- Writing to primary
- Reading from replica
- Verifying data sync

### 2. Failover Demo (`pnpm run failover`)

Demonstrates:
- Stopping the primary
- Testing connections
- Promoting replica to primary
- Writing to the promoted replica

## Manual Exploration

Connect to primary:
```bash
docker exec -it pg_primary psql -U postgres -d testdb
```

Connect to replica:
```bash
docker exec -it pg_replica psql -U postgres -d testdb
```

Check replication status (on primary):
```sql
SELECT client_addr, state, sent_lsn, replay_lsn, replay_lag
FROM pg_stat_replication;
```

Try writing to replica (will fail - it's read-only):
```sql
INSERT INTO users (name, email) VALUES ('test', 'test@test.com');
-- ERROR: cannot execute INSERT in a read-only transaction
```

## Complete Setup Flow

When you run `docker compose up -d`, here's exactly what happens step by step:

### Step 1: Primary Database Starts

```
┌─────────────────────────────────────────────────────────────────┐
│  PRIMARY CONTAINER (pg_primary)                                 │
├─────────────────────────────────────────────────────────────────┤
│  1. PostgreSQL starts with these key settings:                  │
│     - wal_level=replica     (enables replication WAL format)    │
│     - max_wal_senders=3     (allows up to 3 replicas)           │
│     - wal_keep_size=1GB     (keeps WAL for slow replicas)       │
│     - hot_standby=on        (allows read queries on standby)    │
│                                                                 │
│  2. Init scripts run (from /docker-entrypoint-initdb.d/):       │
│     a) 00-pg-hba.sh:                                            │
│        Adds: "host replication replicator all md5"              │
│        → Allows replication connections from any host           │
│                                                                 │
│     b) 01-setup-replication.sql:                                │
│        CREATE USER replicator WITH REPLICATION ...              │
│        → Creates user that can ONLY do replication              │
│                                                                 │
│  3. Health check passes (pg_isready succeeds)                   │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Replica Waits, Then Initializes

```
┌─────────────────────────────────────────────────────────────────┐
│  REPLICA CONTAINER (pg_replica)                                 │
├─────────────────────────────────────────────────────────────────┤
│  1. depends_on: primary (service_healthy)                       │
│     → Waits until primary health check passes                   │
│                                                                 │
│  2. Custom entrypoint runs:                                     │
│     IF data directory is empty:                                 │
│       → Run pg_basebackup to copy all data from primary         │
│       → -R flag creates standby.signal file                     │
│       → This file makes replica READ-ONLY automatically         │
│                                                                 │
│  3. PostgreSQL starts in STANDBY MODE:                          │
│     → Sees standby.signal → enters recovery mode                │
│     → Connects to primary using replicator credentials          │
│     → Begins streaming WAL records                              │
│     → All writes are BLOCKED (read-only by design)              │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Continuous Replication

```
┌──────────────┐                          ┌──────────────┐
│   PRIMARY    │                          │   REPLICA    │
│  (port 5432) │                          │  (port 5433) │
├──────────────┤                          ├──────────────┤
│              │    WAL Stream (TCP)      │              │
│  Client      │  ─────────────────────►  │  Applies     │
│  writes data │                          │  WAL records │
│              │                          │              │
│  WAL record  │    "I have new WAL"      │  Data files  │
│  created     │  ◄─────────────────────  │  updated     │
│              │    (acknowledgment)      │              │
└──────────────┘                          └──────────────┘
```

### File Structure After Setup

```
Primary (/var/lib/postgresql/data/):
├── pg_hba.conf           ← Modified by 00-pg-hba.sh
├── postgresql.conf       ← Default + command line overrides
├── pg_wal/              ← Write-Ahead Log files
└── base/                ← Actual data files

Replica (/var/lib/postgresql/data/):
├── standby.signal        ← Created by -R flag (makes it read-only!)
├── postgresql.auto.conf  ← Contains primary_conninfo
├── pg_wal/              ← Received WAL files
└── base/                ← Data files (copy of primary)
```

## How Replication Works

### The Write-Ahead Log (WAL)

PostgreSQL uses a Write-Ahead Log to ensure durability and enable replication:

1. **Every change is logged first**: Before modifying actual data files, PostgreSQL writes the change to WAL
2. **Sequential writes**: WAL is append-only, making it extremely fast
3. **Crash recovery**: If the database crashes, it replays WAL to recover
4. **Replication source**: Replicas consume the same WAL to stay in sync

### Streaming Replication Process

```
┌─────────────────────────────────────────────────────────┐
│                    PRIMARY DATABASE                      │
│                                                          │
│  1. Client writes data                                   │
│  2. Write to WAL first                                   │
│  3. Update data files                                    │
│  4. Stream WAL to replicas ──────────────┐              │
│  5. Respond to client                    │              │
└──────────────────────────────────────────┼──────────────┘
                                           │
                                           │ WAL Stream
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────┐
│                    REPLICA DATABASE                      │
│                                                          │
│  1. Receive WAL records                                  │
│  2. Apply changes to local data                          │
│  3. Stay in "hot standby" mode (read-only)              │
│  4. Serve read queries                                   │
└─────────────────────────────────────────────────────────┘
```

### How Streaming Actually Works

When the replica starts, it establishes a **persistent TCP connection** to the primary. Here's the detailed flow:

#### Connection Establishment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REPLICA STARTUP                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Replica reads postgresql.auto.conf (created by pg_basebackup -R):       │
│     primary_conninfo = 'host=primary user=replicator password=...'          │
│                                                                             │
│  2. Replica connects to primary on port 5432                                │
│     → Uses the special "replication" protocol (not normal SQL)              │
│     → Authenticates as 'replicator' user                                    │
│                                                                             │
│  3. Replica tells primary: "I have WAL up to position X/YYYYYYYY"           │
│     → This is the LSN (Log Sequence Number) from last sync                  │
│                                                                             │
│  4. Primary responds: "OK, I'll stream WAL from that position"              │
│     → Connection stays open for continuous streaming                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The WAL Sender / WAL Receiver Process

```
PRIMARY SERVER                              REPLICA SERVER
─────────────────                           ─────────────────

┌─────────────────┐                         ┌─────────────────┐
│  Main Process   │                         │  Main Process   │
│  (postmaster)   │                         │  (postmaster)   │
└────────┬────────┘                         └────────┬────────┘
         │                                           │
         │ forks                                     │ forks
         ▼                                           ▼
┌─────────────────┐    TCP Connection       ┌─────────────────┐
│   WAL Sender    │◄───────────────────────►│  WAL Receiver   │
│    Process      │    (persistent)         │    Process      │
└────────┬────────┘                         └────────┬────────┘
         │                                           │
         │ reads                                     │ writes
         ▼                                           ▼
┌─────────────────┐                         ┌─────────────────┐
│    pg_wal/      │                         │    pg_wal/      │
│  (WAL files)    │                         │  (WAL files)    │
└─────────────────┘                         └─────────────────┘
                                                     │
                                                     │ replays
                                                     ▼
                                            ┌─────────────────┐
                                            │   Startup       │
                                            │   Process       │
                                            │ (applies WAL)   │
                                            └─────────────────┘
```

**WAL Sender** (on primary):
- One process per connected replica
- Reads WAL from disk (or memory if recent)
- Sends WAL records over TCP as they're generated
- Tracks what each replica has received/applied

**WAL Receiver** (on replica):
- Receives WAL records from primary
- Writes them to local pg_wal/ directory
- Notifies the startup process

**Startup Process** (on replica):
- Reads WAL from local pg_wal/
- Applies changes to data files
- This is the same process used for crash recovery

#### What Gets Streamed

Every change in PostgreSQL generates WAL records. Here's what a single INSERT looks like:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Generates WAL records:                                                     │
│                                                                             │
│  1. HEAP INSERT record                                                      │
│     - Table OID: 16384 (users table)                                        │
│     - Block number: 0                                                       │
│     - Offset: 1                                                             │
│     - Tuple data: {id=1, name='Alice', email='alice@example.com', ...}      │
│                                                                             │
│  2. BTREE INSERT record (for primary key index)                             │
│     - Index OID: 16390                                                      │
│     - Key: 1                                                                │
│     - Pointer to heap tuple                                                 │
│                                                                             │
│  3. COMMIT record                                                           │
│     - Transaction ID: 1234                                                  │
│     - Timestamp: 2024-01-15 10:30:00                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

The replica receives these exact bytes and replays them, resulting in identical data.

#### Real-Time Streaming Flow

```
Time
 │
 │   PRIMARY                                    REPLICA
 │   ════════                                   ═══════
 │
 ▼   Client: INSERT INTO users...
     ┌──────────────────────┐
 T1  │ 1. Write to WAL      │
     │ 2. Update data files │
     │ 3. Return to client  │
     └──────────┬───────────┘
               │
               │ WAL Sender sees new WAL
               │
 T2            └──────────────────────────────► WAL Receiver gets record
                                                ┌──────────────────────┐
 T3                                             │ 1. Write to pg_wal/  │
                                                │ 2. Notify startup    │
                                                └──────────┬───────────┘
                                                           │
 T4                                             Startup process reads WAL
                                                ┌──────────────────────┐
 T5                                             │ Apply to data files  │
                                                └──────────────────────┘
                                                           │
 T6                                             Data visible to queries ✓

     ◄──────────────────────────────────────────►
              Replication Lag (T6 - T1)
              Typically: 1-100 milliseconds
```

#### Keeping Track: LSN (Log Sequence Number)

PostgreSQL uses LSN to track positions in the WAL:

```sql
-- On PRIMARY: See what's been sent vs applied
SELECT 
  client_addr,
  sent_lsn,      -- "I've sent up to here"
  write_lsn,     -- "Replica wrote to disk up to here"
  flush_lsn,     -- "Replica flushed to disk up to here"  
  replay_lsn     -- "Replica applied up to here"
FROM pg_stat_replication;

-- Example output:
-- client_addr | sent_lsn    | write_lsn   | flush_lsn   | replay_lsn
-- 172.18.0.3  | 0/3000A60   | 0/3000A60   | 0/3000A60   | 0/3000A60
--               ▲             ▲             ▲             ▲
--               │             │             │             └── Applied to data files
--               │             │             └── Safely on replica's disk
--               │             └── Written to replica's memory/disk
--               └── Sent over network
```

When all four LSNs match, the replica is fully caught up.

#### What Happens During Network Issues

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NETWORK INTERRUPTION                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Connection drops                                                        │
│     → WAL Sender on primary notices (TCP keepalive or send failure)         │
│     → WAL Receiver on replica notices                                       │
│                                                                             │
│  2. Primary continues accepting writes                                      │
│     → WAL accumulates in pg_wal/ (up to wal_keep_size = 1GB)               │
│     → If replica is down too long, old WAL may be deleted                   │
│                                                                             │
│  3. Replica keeps serving reads (with stale data)                           │
│     → Still in recovery mode, still read-only                               │
│     → Startup process waits for new WAL                                     │
│                                                                             │
│  4. When connection restores:                                               │
│     → Replica reconnects automatically                                      │
│     → Tells primary: "Last LSN I have is X/YYYYYYYY"                       │
│     → Primary streams all WAL since that position                           │
│     → Replica catches up (may take seconds to minutes)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Asynchronous vs Synchronous

This demo uses **asynchronous replication** (the default):

- **Primary commits immediately**: Doesn't wait for replica acknowledgment
- **Faster writes**: No network round-trip delay
- **Slight lag**: Replica might be a few milliseconds behind
- **Small risk**: If primary crashes before replica receives WAL, recent writes are lost

**Synchronous replication** (not in this demo):
- Primary waits for replica acknowledgment before committing
- Slower writes, but zero data loss
- Used for critical financial systems

### Key PostgreSQL Configuration Parameters

The primary is configured with these critical settings (in docker-compose.yml):

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `wal_level` | `replica` | Enables WAL format suitable for replication (includes enough info to reconstruct data) |
| `max_wal_senders` | `3` | Maximum number of concurrent replication connections |
| `wal_keep_size` | `1GB` | How much WAL to retain for slow replicas (prevents "requested WAL segment has already been removed" errors) |
| `hot_standby` | `on` | Allows read queries on the standby while it's replicating |

### Replication User Setup

The primary creates a special `replicator` user with `REPLICATION` privilege:

```sql
CREATE USER replicator WITH REPLICATION ENCRYPTED PASSWORD 'replicator_password';
```

This user can:
- Connect to the primary for replication purposes
- Stream WAL records
- Cannot read or write regular data (not a normal database user)

### pg_hba.conf Configuration

The primary's `pg_hba.conf` is updated to allow replication connections:

```
host replication replicator all md5
```

This line means:
- `host`: TCP/IP connection (not local socket)
- `replication`: Special replication connection (not regular database)
- `replicator`: Only this user can connect for replication
- `all`: From any IP address (in production, restrict this)
- `md5`: Password authentication required

### Initial Replica Setup

The replica uses `pg_basebackup` to create an initial copy:

```bash
pg_basebackup -h primary -D /var/lib/postgresql/data -U replicator -Fp -Xs -P -R
```

Breaking down the flags:
- `-h primary`: Connect to the primary server
- `-D /var/lib/postgresql/data`: Where to store the replica's data
- `-U replicator`: Connect as the replication user
- `-Fp`: Plain format (copy files as-is)
- `-Xs`: Stream WAL during backup (ensures consistency)
- `-P`: Show progress (useful for large databases)
- `-R`: Create `standby.signal` and configure replication automatically

After `pg_basebackup` completes:
1. Replica has a complete copy of the primary's data
2. `standby.signal` file tells PostgreSQL to run in standby mode
3. `postgresql.auto.conf` contains connection info to follow the primary
4. Replica starts and begins streaming WAL

### Why is the Replica Read-Only?

The replica is automatically read-only because of the **`-R` flag** in `pg_basebackup`. This flag creates a `standby.signal` file in the data directory. When PostgreSQL sees this file on startup:

1. It enters **standby/recovery mode** automatically
2. The database becomes **read-only by design** - any write attempts fail with:
   ```
   ERROR: cannot execute INSERT in a read-only transaction
   ```
3. It continuously receives and applies WAL records from the primary

**No explicit read-only configuration is needed** (like `default_transaction_read_only=on`). The standby mode inherently makes the database read-only because:
- The replica is in constant recovery mode, replaying WAL from the primary
- PostgreSQL doesn't allow writes during recovery to maintain data consistency

This is a core PostgreSQL feature - replicas are read-only by design until promoted to become a new primary using `SELECT pg_promote()`.

### Hot Standby Mode

The replica runs in "hot standby" mode:
- **Read-only**: Can serve SELECT queries
- **Cannot write**: INSERT/UPDATE/DELETE will fail
- **Continuously applying WAL**: Stays in sync with primary
- **No transaction conflicts**: Read queries see consistent snapshots

### Monitoring Replication

On the **primary**, check connected replicas:

```sql
SELECT 
  client_addr,           -- Replica's IP address
  state,                 -- streaming, catchup, or startup
  sent_lsn,             -- Last WAL position sent
  replay_lsn,           -- Last WAL position applied by replica
  replay_lag            -- How far behind (in bytes)
FROM pg_stat_replication;
```

On the **replica**, check replication status:

```sql
SELECT 
  pg_is_in_recovery(),                    -- Should be 't' (true)
  pg_last_wal_receive_lsn(),             -- Last WAL received
  pg_last_wal_replay_lsn(),              -- Last WAL applied
  pg_last_wal_replay_lsn() = pg_last_wal_receive_lsn() AS caught_up;
```

## Architecture

```
┌─────────────┐         WAL Stream         ┌─────────────┐
│   Primary   │ ───────────────────────▶   │   Replica   │
│  (port 5432)│                            │  (port 5433)│
│             │                            │             │
│  - Writes ✓ │                            │  - Writes ✗ │
│  - Reads ✓  │                            │  - Reads ✓  │
└─────────────┘                            └─────────────┘
```

## Cleanup

```bash
docker compose down -v
```

The `-v` flag removes the volumes, giving you a clean slate.

## Understanding the Demo Scripts

### demo.js - Basic Replication

This script demonstrates the core replication workflow:

1. **Creates a table on primary**: The `users` table is created on port 5432
2. **Checks replication status**: Queries `pg_stat_replication` to verify replica is connected
3. **Writes to primary**: Inserts users (Alice, Bob, Charlie) on port 5432
4. **Reads from replica**: Queries the same data from port 5433
5. **Tests replication lag**: Rapidly inserts 100 records and compares counts

**What you'll observe:**
- Data written to primary appears on replica within milliseconds
- Replica count might lag slightly behind primary during rapid writes
- The `pg_stat_replication` view shows the replica's connection state

### failover-demo.js - Disaster Recovery

This script simulates a primary failure and manual failover:

1. **Verifies both servers**: Confirms primary (5432) and replica (5433) are running
2. **Stops the primary**: Simulates a catastrophic failure
3. **Tests connections**: Shows primary is unreachable, replica still serves reads
4. **Promotes replica**: Uses `pg_promote()` to make replica accept writes
5. **Tests writes**: Verifies the promoted replica can now handle INSERT/UPDATE/DELETE

**What you'll observe:**
- Replica continues serving reads even when primary is down
- After promotion, replica becomes a full read-write database
- In production, you'd update DNS/load balancers to point to the new primary

## Common Issues & Troubleshooting

### Port Already in Use

If you see "port is already allocated":

```bash
# Check what's using the port
lsof -i :5432
lsof -i :5433

# Stop any existing PostgreSQL containers
docker ps | grep postgres
docker stop <container_id>
```

### Replica Not Connecting

Check the primary logs:

```bash
docker logs pg_primary
```

Common issues:
- `pg_hba.conf` not configured correctly
- Replication user doesn't exist
- Network connectivity between containers

Verify replication user exists:

```bash
docker exec -it pg_primary psql -U postgres -c "\du replicator"
```

### Replication Lag Growing

If replica falls behind:

```sql
-- On primary, check lag
SELECT 
  client_addr,
  state,
  pg_wal_lsn_diff(sent_lsn, replay_lsn) AS lag_bytes,
  replay_lag
FROM pg_stat_replication;
```

Causes:
- Replica hardware is slower than primary
- Network bandwidth issues
- Replica is serving too many read queries (CPU bound)
- Large transactions on primary

### Replica Shows Old Data

Remember: asynchronous replication has a small lag (typically <100ms). If you need immediate consistency, use synchronous replication or read from the primary.

## Production Considerations

This demo is for learning. In production:

### Security

- **Restrict pg_hba.conf**: Don't use `all` for IP addresses
  ```
  host replication replicator 10.0.1.0/24 md5
  ```
- **Use SSL**: Encrypt replication traffic
  ```
  hostssl replication replicator all md5
  ```
- **Strong passwords**: Don't use `replicator_password`
- **Network isolation**: Replicas should be on a private network

### Monitoring

Set up alerts for:
- Replica disconnection
- Replication lag > threshold (e.g., 1GB or 10 seconds)
- Replica disk space
- WAL accumulation on primary (if replica is down)

### Automatic Failover

This demo uses manual failover. In production, use:
- **Patroni**: Automatic failover with etcd/Consul
- **repmgr**: Replication manager with automatic promotion
- **Cloud solutions**: AWS RDS Multi-AZ, Google Cloud SQL HA

### Multiple Replicas

You can add more replicas:

```yaml
replica2:
  image: postgres:16
  container_name: pg_replica2
  # ... same config as replica, different port
  ports:
    - "5434:5432"
```

Each replica independently streams from the primary.

### Cascading Replication

To reduce primary load, replicas can follow other replicas:

```
Primary → Replica 1 → Replica 2
                   → Replica 3
```

Replica 1 streams from primary, Replicas 2 & 3 stream from Replica 1.

## Key Learnings

1. **Replica is read-only** - You cannot write to a standby replica (by design, for data safety)
2. **Replication lag exists** - There's always some delay with async replication (usually milliseconds)
3. **Failover requires promotion** - Use `SELECT pg_promote()` to make replica writable
4. **Connection strings must change** - After failover, apps need to connect to the new primary
5. **WAL is the magic** - Everything flows through the Write-Ahead Log
6. **Replicas reduce read load** - Distribute SELECT queries across replicas
7. **Replicas don't prevent data loss** - They protect against hardware failure, not user errors (use backups for that)

## Further Reading

- [PostgreSQL Replication Documentation](https://www.postgresql.org/docs/current/high-availability.html)
- [Understanding WAL](https://www.postgresql.org/docs/current/wal-intro.html)
- [Monitoring Replication](https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-REPLICATION-VIEW)
- Blog post: [Fault Tolerance: Redundancy and Automatic Failover](https://pulkitxm.com/blogs/system-design/fault-tolerance)
