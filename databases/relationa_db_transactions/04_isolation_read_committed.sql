-- ============================================
-- 04. ISOLATION LEVEL: READ COMMITTED
-- ============================================
-- Demonstrates non-repeatable reads

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

SELECT '=== READ COMMITTED Isolation Level ===' AS info;
SELECT 'Default isolation level in PostgreSQL' AS info;
SELECT 'Prevents dirty reads but allows non-repeatable reads' AS info;

-- Single session demonstration
SELECT '=== Demonstration (Single Session) ===' AS demo;

BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM accounts WHERE id = 1;
-- In a concurrent session, if another transaction updates and commits,
-- the next SELECT in this transaction will see the new value
SELECT 'This is a non-repeatable read' AS note;
COMMIT;

SELECT '=== Instructions for Manual Testing (Two Terminals) ===' AS instructions;

SELECT 'Terminal 1: Transaction 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT balance FROM accounts WHERE id = 1;  -- Sees 1000
-- Wait here, do not commit yet
SELECT pg_sleep(5);
SELECT balance FROM accounts WHERE id = 1;  -- Will see 500 (non-repeatable read!)
COMMIT;' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Transaction 2 (run after Terminal 1 starts)' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
UPDATE accounts SET balance = 500 WHERE id = 1;
COMMIT;  -- This makes the change visible to Transaction 1' AS commands;

