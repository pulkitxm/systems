-- ============================================
-- 11. TRANSACTION PERFORMANCE AND MONITORING
-- ============================================
-- Tools for monitoring and optimizing transactions

-- Clean up
DROP TABLE IF EXISTS performance_test CASCADE;

-- Setup
CREATE TABLE performance_test (
    id SERIAL PRIMARY KEY,
    user_id INT,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_id ON performance_test(user_id);

SELECT '=== TRANSACTION PERFORMANCE MONITORING ===' AS info;

-- Check active transactions
SELECT '=== Active Transactions ===' AS status;
SELECT 
    pid,
    usename,
    application_name,
    state,
    query_start,
    state_change,
    wait_event_type,
    wait_event,
    LEFT(query, 50) AS query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Check long-running transactions
SELECT '=== Long-Running Transactions ===' AS status;
SELECT 
    pid,
    usename,
    application_name,
    state,
    NOW() - query_start AS duration,
    LEFT(query, 50) AS query
FROM pg_stat_activity
WHERE state != 'idle'
    AND NOW() - query_start > INTERVAL '1 second'
ORDER BY duration DESC;

-- Check blocked queries
SELECT '=== Blocked Queries ===' AS status;
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- Test transaction performance
SELECT '=== Performance Test: Individual Inserts ===' AS test;
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    FOR i IN 1..100 LOOP
        BEGIN
            INSERT INTO performance_test (user_id, data) 
            VALUES (i, 'Test data ' || i);
            COMMIT;
        END;
    END LOOP;
    
    end_time := clock_timestamp();
    RAISE NOTICE 'Individual transactions: % ms', 
        EXTRACT(MILLISECONDS FROM (end_time - start_time));
END $$;

TRUNCATE performance_test;

SELECT '=== Performance Test: Batch Insert ===' AS test;
DO $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    start_time := clock_timestamp();
    
    BEGIN
        FOR i IN 1..100 LOOP
            INSERT INTO performance_test (user_id, data) 
            VALUES (i, 'Test data ' || i);
        END LOOP;
        COMMIT;
    END;
    
    end_time := clock_timestamp();
    RAISE NOTICE 'Batch transaction: % ms', 
        EXTRACT(MILLISECONDS FROM (end_time - start_time));
END $$;

SELECT 'Notice: Batch transactions are much faster!' AS note;

-- Check table bloat
SELECT '=== Table Bloat ===' AS status;
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE tablename = 'performance_test';

-- Update rows to create dead tuples
UPDATE performance_test SET data = 'Updated ' || data;

SELECT '=== After Updates (Creates Dead Tuples) ===' AS status;
SELECT 
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent
FROM pg_stat_user_tables
WHERE tablename = 'performance_test';

-- Transaction ID wraparound monitoring
SELECT '=== Transaction ID Wraparound Status ===' AS status;
SELECT 
    datname,
    age(datfrozenxid) AS xid_age,
    2147483647 - age(datfrozenxid) AS xids_remaining,
    ROUND(100.0 * age(datfrozenxid) / 2147483647, 2) AS percent_used
FROM pg_database
ORDER BY age(datfrozenxid) DESC;

-- Lock monitoring
SELECT '=== Current Locks ===' AS status;
SELECT 
    locktype,
    relation::regclass AS table,
    mode,
    granted,
    pid
FROM pg_locks
WHERE relation IS NOT NULL
ORDER BY relation;

-- Transaction statistics
SELECT '=== Transaction Statistics ===' AS status;
SELECT 
    xact_commit AS commits,
    xact_rollback AS rollbacks,
    ROUND(100.0 * xact_commit / NULLIF(xact_commit + xact_rollback, 0), 2) AS commit_ratio,
    blks_read AS blocks_read,
    blks_hit AS blocks_hit,
    ROUND(100.0 * blks_hit / NULLIF(blks_read + blks_hit, 0), 2) AS cache_hit_ratio,
    tup_returned AS rows_returned,
    tup_fetched AS rows_fetched,
    tup_inserted AS rows_inserted,
    tup_updated AS rows_updated,
    tup_deleted AS rows_deleted
FROM pg_stat_database
WHERE datname = current_database();

-- Best practices summary
SELECT '=== Transaction Best Practices ===' AS info;
SELECT '1. Keep transactions as short as possible' AS practice
UNION ALL
SELECT '2. Avoid long-running transactions (causes bloat)' AS practice
UNION ALL
SELECT '3. Use appropriate isolation level (READ COMMITTED is usually enough)' AS practice
UNION ALL
SELECT '4. Batch operations when possible' AS practice
UNION ALL
SELECT '5. Monitor for blocked queries and deadlocks' AS practice
UNION ALL
SELECT '6. Regular VACUUM to prevent bloat' AS practice
UNION ALL
SELECT '7. Monitor transaction ID age to prevent wraparound' AS practice
UNION ALL
SELECT '8. Use connection pooling to reduce overhead' AS practice;

