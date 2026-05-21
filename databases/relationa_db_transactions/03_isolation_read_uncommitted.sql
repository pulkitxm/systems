-- ============================================
-- 03. ISOLATION LEVEL: READ UNCOMMITTED
-- ============================================
-- Demonstrates dirty reads (not supported in PostgreSQL)
-- PostgreSQL treats READ UNCOMMITTED as READ COMMITTED

-- Clean up
DROP TABLE IF EXISTS accounts CASCADE;

-- Setup
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    balance DECIMAL(10, 2)
);

INSERT INTO accounts VALUES (1, 1000.00);

SELECT '=== Initial State ===' AS status;
SELECT * FROM accounts;

SELECT '=== Note: PostgreSQL does not support READ UNCOMMITTED ===' AS info;
SELECT 'It treats READ UNCOMMITTED as READ COMMITTED' AS info;
SELECT 'Dirty reads are NOT possible in PostgreSQL' AS info;

-- To test this properly, you would need to:
-- 1. Open two terminal windows
-- 2. Run Transaction 1 in terminal 1
-- 3. Run Transaction 2 in terminal 2 before committing Transaction 1

SELECT '=== Instructions for Manual Testing ===' AS instructions;
SELECT 'Terminal 1: Run this' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
UPDATE accounts SET balance = 500 WHERE id = 1;
-- Do NOT commit yet
SELECT pg_sleep(10);
COMMIT;' AS commands;

SELECT 'Terminal 2: Run this immediately after Terminal 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SELECT * FROM accounts WHERE id = 1;
-- In PostgreSQL, you will see 1000 (original value)
-- In MySQL with READ UNCOMMITTED, you would see 500 (dirty read)
COMMIT;' AS commands;

