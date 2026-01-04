-- ============================================
-- 06. ISOLATION LEVEL: SERIALIZABLE
-- ============================================
-- Demonstrates full serializability and write skew prevention

-- Clean up
DROP TABLE IF EXISTS flights CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;

-- Setup for Test 1: Double booking prevention
CREATE TABLE flights (
    id INT PRIMARY KEY,
    flight_number VARCHAR(10),
    seats_available INT CHECK (seats_available >= 0)
);

INSERT INTO flights VALUES (1, 'AA100', 1);

SELECT '=== Initial State ===' AS status;
SELECT * FROM flights;

SELECT '=== SERIALIZABLE Isolation Level ===' AS info;
SELECT 'Strongest isolation - prevents all anomalies' AS info;
SELECT 'Transactions execute as if they ran serially' AS info;

-- Test 1: Prevent double booking
SELECT '=== Test 1: Prevent Double Booking ===' AS test;
SELECT '=== Instructions for Manual Testing ===' AS instructions;

SELECT 'Terminal 1: Transaction 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT seats_available FROM flights WHERE id = 1;  -- Sees 1 seat
SELECT pg_sleep(3);
UPDATE flights SET seats_available = seats_available - 1 WHERE id = 1;
COMMIT;  -- One will succeed' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Transaction 2 (run immediately after Terminal 1)' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT seats_available FROM flights WHERE id = 1;  -- Also sees 1 seat
UPDATE flights SET seats_available = seats_available - 1 WHERE id = 1;
COMMIT;  -- One will get serialization error' AS commands;

-- Setup for Test 2: Write skew prevention
CREATE TABLE doctors (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    on_call BOOLEAN
);

INSERT INTO doctors VALUES 
    (1, 'Dr. Smith', true),
    (2, 'Dr. Jones', true);

SELECT '=== Test 2: Prevent Write Skew ===' AS test;
SELECT 'Scenario: At least one doctor must be on call' AS scenario;
SELECT * FROM doctors;

SELECT '=== Instructions for Manual Testing ===' AS instructions;

SELECT 'Terminal 1: Dr. Smith goes off call' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT COUNT(*) FROM doctors WHERE on_call = true;  -- Sees 2
-- Thinks its safe to go off call
SELECT pg_sleep(3);
UPDATE doctors SET on_call = false WHERE id = 1;
COMMIT;  -- One will get serialization error' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Dr. Jones goes off call' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT COUNT(*) FROM doctors WHERE on_call = true;  -- Also sees 2
-- Also thinks its safe to go off call
UPDATE doctors SET on_call = false WHERE id = 2;
COMMIT;  -- One will succeed, one will fail' AS commands;

SELECT 'Without SERIALIZABLE, both would succeed and no doctor would be on call!' AS note;

