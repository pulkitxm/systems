-- ============================================
-- 07. MVCC (Multi-Version Concurrency Control)
-- ============================================
-- Demonstrates how PostgreSQL maintains multiple row versions

-- Clean up
DROP TABLE IF EXISTS accounts CASCADE;

-- Setup
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    balance DECIMAL(10, 2)
);

INSERT INTO accounts VALUES (1, 'Alice', 1000.00);

SELECT '=== MVCC Demonstration ===' AS info;
SELECT 'PostgreSQL stores transaction IDs with each row version' AS info;

-- Show hidden system columns
SELECT '=== Initial Row with System Columns ===' AS status;
SELECT 
    xmin,  -- Transaction ID that created this row
    xmax,  -- Transaction ID that deleted/updated this row (0 if current)
    id, 
    name, 
    balance 
FROM accounts;

-- Update the row
UPDATE accounts SET balance = 1500.00 WHERE id = 1;

SELECT '=== After Update ===' AS status;
SELECT 
    xmin,  -- New transaction ID
    xmax,  -- Still 0 (current version)
    id, 
    name, 
    balance 
FROM accounts;

SELECT 'Notice: xmin changed to a new transaction ID' AS note;

-- Multiple updates to see version changes
UPDATE accounts SET balance = 2000.00 WHERE id = 1;
UPDATE accounts SET balance = 2500.00 WHERE id = 1;

SELECT '=== After Multiple Updates ===' AS status;
SELECT 
    xmin,  -- Latest transaction ID
    xmax,
    id, 
    name, 
    balance 
FROM accounts;

-- Demonstrate concurrent visibility
SELECT '=== Instructions for Manual Testing: Concurrent Visibility ===' AS instructions;

SELECT 'Terminal 1: Long-running transaction with REPEATABLE READ' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT xmin, xmax, * FROM accounts;
-- Note the xmin value (e.g., 879)
SELECT pg_sleep(10);
SELECT xmin, xmax, * FROM accounts;
-- xmin will be the SAME (snapshot isolation prevents seeing new versions)
COMMIT;' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Update while Terminal 1 is sleeping' AS terminal;
SELECT 'BEGIN;
UPDATE accounts SET balance = 3000.00 WHERE id = 1;
COMMIT;
-- Terminal 1 will NOT see this change (xmin stays the same)!
-- This is because REPEATABLE READ creates a snapshot at BEGIN time' AS commands;

-- Check table bloat from old versions
SELECT '=== Check Table Bloat ===' AS status;
SELECT 
    schemaname,
    relname AS tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows
FROM pg_stat_user_tables
WHERE relname = 'accounts';

SELECT 'Dead rows are old versions waiting for VACUUM' AS note;

-- VACUUM to clean up old versions
VACUUM VERBOSE accounts;

SELECT '=== After VACUUM ===' AS status;
SELECT 
    schemaname,
    relname AS tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows
FROM pg_stat_user_tables
WHERE relname = 'accounts';

