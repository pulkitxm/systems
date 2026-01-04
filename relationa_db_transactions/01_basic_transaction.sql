-- ============================================
-- 01. BASIC TRANSACTION TEST
-- ============================================
-- Demonstrates atomicity: all-or-nothing execution

-- Clean up
DROP TABLE IF EXISTS accounts CASCADE;

-- Setup
CREATE TABLE accounts (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    balance DECIMAL(10, 2) CHECK (balance >= 0)
);

INSERT INTO accounts VALUES 
    (1, 'Alice', 1000.00),
    (2, 'Bob', 500.00);

SELECT '=== Initial State ===' AS status;
SELECT * FROM accounts;

-- Test 1: Successful transaction
SELECT '=== Test 1: Successful Transaction ===' AS status;
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;

SELECT * FROM accounts;

-- Test 2: Failed transaction (rollback)
SELECT '=== Test 2: Failed Transaction (Rollback) ===' AS status;
BEGIN;
UPDATE accounts SET balance = balance - 200 WHERE id = 1;
UPDATE accounts SET balance = balance + 200 WHERE id = 2;
-- Simulate error or manual rollback
ROLLBACK;

SELECT * FROM accounts;
SELECT 'Notice: Balances unchanged after ROLLBACK' AS note;

-- Test 3: Transaction with constraint violation (automatic rollback)
SELECT '=== Test 3: Constraint Violation (Automatic Rollback) ===' AS status;
BEGIN;
UPDATE accounts SET balance = balance - 200 WHERE id = 1;
-- This will fail due to CHECK constraint
UPDATE accounts SET balance = -50 WHERE id = 2;
COMMIT;

SELECT * FROM accounts;
SELECT 'Notice: Transaction automatically rolled back due to constraint violation' AS note;

