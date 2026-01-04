-- ============================================
-- 10. WRITE-AHEAD LOG (WAL) AND DURABILITY
-- ============================================
-- Demonstrates WAL configuration and monitoring

-- Clean up
DROP TABLE IF EXISTS test_durability CASCADE;

-- Setup
CREATE TABLE test_durability (
    id SERIAL PRIMARY KEY,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT '=== WAL AND DURABILITY ===' AS info;
SELECT 'Write-Ahead Log ensures durability' AS info;

-- Check current WAL settings
SELECT '=== Current WAL Settings ===' AS status;
SELECT 
    name,
    setting,
    unit,
    short_desc
FROM pg_settings 
WHERE name IN (
    'wal_level',
    'fsync',
    'synchronous_commit',
    'wal_sync_method',
    'wal_buffers',
    'checkpoint_timeout',
    'max_wal_size'
)
ORDER BY name;

-- Check WAL location and status
SELECT '=== WAL Status ===' AS status;
SELECT 
    pg_current_wal_lsn() AS current_wal_location,
    pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0') / 1024 / 1024 AS wal_mb_written;

-- Insert data and watch WAL grow
SELECT '=== Before Inserts ===' AS status;
SELECT pg_current_wal_lsn() AS wal_location;

BEGIN;
INSERT INTO test_durability (data) 
SELECT 'Test data ' || generate_series(1, 1000);
COMMIT;

SELECT '=== After Inserts ===' AS status;
SELECT pg_current_wal_lsn() AS wal_location;

-- Check WAL files
SELECT '=== WAL Files ===' AS status;
SELECT 
    name,
    pg_size_pretty(size) AS size,
    modification AS last_modified
FROM pg_ls_waldir()
ORDER BY modification DESC
LIMIT 5;

-- Monitor WAL activity
SELECT '=== WAL Statistics ===' AS status;
SELECT 
    checkpoints_timed,
    checkpoints_req,
    checkpoint_write_time,
    checkpoint_sync_time,
    buffers_checkpoint,
    buffers_clean,
    buffers_backend,
    stats_reset
FROM pg_stat_bgwriter;

-- Test synchronous vs asynchronous commit
SELECT '=== Test Synchronous Commit ===' AS test;

-- Synchronous (default) - waits for WAL flush
BEGIN;
SET LOCAL synchronous_commit = on;
INSERT INTO test_durability (data) VALUES ('Synchronous commit');
COMMIT;
SELECT 'Synchronous commit: COMMIT waits for WAL flush to disk' AS note;

-- Asynchronous - doesn't wait for WAL flush
BEGIN;
SET LOCAL synchronous_commit = off;
INSERT INTO test_durability (data) VALUES ('Asynchronous commit');
COMMIT;
SELECT 'Asynchronous commit: COMMIT returns before WAL flush (faster but less durable)' AS note;

-- Show transaction commit timestamps (if enabled)
SELECT '=== Recent Transactions ===' AS status;
SELECT 
    xmin,
    data,
    created_at
FROM test_durability
ORDER BY id DESC
LIMIT 5;

-- Checkpoint information
SELECT '=== Force Checkpoint ===' AS status;
CHECKPOINT;
SELECT 'Checkpoint completed - all dirty buffers written to disk' AS note;

-- Show archiving status (if enabled)
SELECT '=== WAL Archiving Status ===' AS status;
SELECT 
    archived_count,
    last_archived_wal,
    last_archived_time,
    failed_count,
    last_failed_wal,
    last_failed_time,
    stats_reset
FROM pg_stat_archiver;

-- Durability guarantees
SELECT '=== Durability Guarantees ===' AS info;
SELECT 'fsync=on: WAL is flushed to physical disk' AS guarantee
UNION ALL
SELECT 'synchronous_commit=on: COMMIT waits for WAL flush' AS guarantee
UNION ALL
SELECT 'full_page_writes=on: First modification after checkpoint writes full page' AS guarantee
UNION ALL
SELECT 'wal_level=replica: Enough WAL for replication' AS guarantee;

-- Simulate crash recovery (informational)
SELECT '=== Crash Recovery Process ===' AS info;
SELECT '1. Database starts and reads last checkpoint location from pg_control' AS step
UNION ALL
SELECT '2. Replays WAL records from checkpoint to end of WAL' AS step
UNION ALL
SELECT '3. Applies committed transactions (redo)' AS step
UNION ALL
SELECT '4. Removes effects of uncommitted transactions (undo)' AS step
UNION ALL
SELECT '5. Database is ready to accept connections' AS step;

