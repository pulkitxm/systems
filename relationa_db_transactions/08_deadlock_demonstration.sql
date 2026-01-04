-- ============================================
-- 08. DEADLOCK DEMONSTRATION
-- ============================================
-- Shows how deadlocks occur and how to prevent them

-- Clean up
DROP TABLE IF EXISTS accounts CASCADE;

-- Setup
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    balance DECIMAL(10, 2)
);

INSERT INTO accounts VALUES 
    (1, 'Alice', 1000.00),
    (2, 'Bob', 1000.00),
    (3, 'Charlie', 1000.00);

SELECT '=== Initial State ===' AS status;
SELECT * FROM accounts;

SELECT '=== DEADLOCK DEMONSTRATION ===' AS info;
SELECT 'Deadlocks occur when transactions wait for each other''s locks' AS info;

-- Test 1: Classic deadlock scenario
SELECT '=== Test 1: Classic Deadlock ===' AS test;
SELECT '=== Instructions for Manual Testing ===' AS instructions;

SELECT '
=== TERMINAL 1: Copy and paste this entire block ===

BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
SELECT pg_sleep(3);
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

' AS terminal_1_commands;

SELECT '
=== TERMINAL 2: Copy and paste this entire block (run immediately after Terminal 1) ===

BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;
SELECT pg_sleep(3);
UPDATE accounts SET balance = balance + 50 WHERE id = 1;
COMMIT;

' AS terminal_2_commands;

SELECT 'PostgreSQL will detect the deadlock and abort one transaction' AS note;

-- Test 2: Preventing deadlocks with lock ordering
SELECT '=== Test 2: Prevent Deadlock with Lock Ordering ===' AS test;
SELECT 'Always acquire locks in the same order (e.g., by ID)' AS solution;

SELECT '
=== TERMINAL 1: Copy and paste this entire block ===

BEGIN;
-- Lock in order: id 1, then id 2
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

' AS terminal_1_commands;

SELECT '
=== TERMINAL 2: Copy and paste this entire block ===

BEGIN;
-- Also lock in order: id 1, then id 2
UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
COMMIT;

' AS terminal_2_commands;

SELECT 'No deadlock! Transaction 2 waits for Transaction 1 to complete' AS note;

-- Test 3: Explicit locking with FOR UPDATE
SELECT '=== Test 3: Explicit Locking with FOR UPDATE ===' AS test;

SELECT '
=== TERMINAL 1: Copy and paste this entire block ===

BEGIN;
-- Explicitly lock rows in order
SELECT * FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

' AS terminal_1_commands;

-- View current locks
SELECT '=== View Current Locks ===' AS status;
SELECT 'Run this in a separate terminal while transactions are active:' AS instruction;
SELECT 'SELECT 
    locktype,
    relation::regclass,
    mode,
    granted,
    pid,
    pg_blocking_pids(pid) as blocked_by
FROM pg_locks
WHERE relation = ''accounts''::regclass;' AS query;

-- Check for deadlocks in logs
SELECT '=== Check Deadlock History ===' AS status;
SELECT 'Deadlocks are logged in PostgreSQL logs' AS note;
SELECT 'Check: /var/log/postgresql/postgresql-*.log' AS location;

