-- ============================================
-- 05. ISOLATION LEVEL: REPEATABLE READ
-- ============================================
-- Demonstrates consistent snapshots and phantom read prevention

-- Clean up
DROP TABLE IF EXISTS accounts CASCADE;

-- Setup
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    balance DECIMAL(10, 2)
);

INSERT INTO accounts VALUES 
    (1, 1000.00),
    (2, 2000.00),
    (3, 3000.00);

SELECT '=== Initial State ===' AS status;
SELECT * FROM accounts;

SELECT '=== REPEATABLE READ Isolation Level ===' AS info;
SELECT 'Provides consistent snapshot throughout transaction' AS info;
SELECT 'PostgreSQL also prevents phantom reads at this level' AS info;

-- Test 1: Repeatable reads (same query returns same results)
SELECT '=== Instructions for Manual Testing: Repeatable Reads ===' AS instructions;

SELECT 'Terminal 1: Transaction 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 1;  -- Sees 1000
SELECT pg_sleep(5);
SELECT balance FROM accounts WHERE id = 1;  -- Still sees 1000 (repeatable!)
COMMIT;' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Transaction 2 (run after Terminal 1 starts)' AS terminal;
SELECT 'BEGIN;
UPDATE accounts SET balance = 500 WHERE id = 1;
COMMIT;  -- Transaction 1 will NOT see this change' AS commands;

-- Test 2: Phantom read prevention
SELECT '=== Instructions for Manual Testing: Phantom Read Prevention ===' AS instructions;

SELECT 'Terminal 1: Transaction 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT COUNT(*) FROM accounts WHERE balance > 1000;  -- Returns 2
SELECT pg_sleep(5);
SELECT COUNT(*) FROM accounts WHERE balance > 1000;  -- Still returns 2 (no phantom!)
COMMIT;' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Transaction 2 (run after Terminal 1 starts)' AS terminal;
SELECT 'BEGIN;
INSERT INTO accounts VALUES (4, 5000);
COMMIT;  -- Transaction 1 will NOT see this new row' AS commands;

-- Test 3: Serialization error on concurrent updates
SELECT '=== Instructions for Manual Testing: Serialization Error ===' AS instructions;

SELECT 'Terminal 1: Transaction 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 1;
SELECT pg_sleep(5);
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;  -- This might fail with serialization error' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Transaction 2 (run after Terminal 1 starts)' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
UPDATE accounts SET balance = balance + 200 WHERE id = 1;
COMMIT;  -- One of these transactions will fail' AS commands;

