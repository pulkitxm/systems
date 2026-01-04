-- ============================================
-- 12. RETRY LOGIC FOR SERIALIZATION FAILURES
-- ============================================
-- Demonstrates handling serialization errors with retries

-- Clean up
DROP TABLE IF EXISTS inventory CASCADE;

-- Setup
CREATE TABLE inventory (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(50),
    quantity INT CHECK (quantity >= 0)
);

INSERT INTO inventory VALUES 
    (1, 'Laptop', 10),
    (2, 'Mouse', 50),
    (3, 'Keyboard', 30);

SELECT '=== Initial State ===' AS status;
SELECT * FROM inventory;

SELECT '=== SERIALIZATION FAILURE HANDLING ===' AS info;
SELECT 'When using REPEATABLE READ or SERIALIZABLE, you must handle serialization errors' AS info;

-- Create a function that implements retry logic
CREATE OR REPLACE FUNCTION transfer_inventory_with_retry(
    from_product INT,
    to_product INT,
    amount INT,
    max_retries INT DEFAULT 3
) RETURNS TEXT AS $$
DECLARE
    retry_count INT := 0;
    error_code TEXT;
    error_message TEXT;
BEGIN
    LOOP
        BEGIN
            -- Start transaction with SERIALIZABLE isolation
            -- Note: This function is called within a transaction
            
            -- Check source has enough quantity
            IF (SELECT quantity FROM inventory WHERE product_id = from_product) < amount THEN
                RETURN 'ERROR: Insufficient quantity';
            END IF;
            
            -- Perform transfer
            UPDATE inventory 
            SET quantity = quantity - amount 
            WHERE product_id = from_product;
            
            UPDATE inventory 
            SET quantity = quantity + amount 
            WHERE product_id = to_product;
            
            RETURN 'SUCCESS: Transfer completed on attempt ' || (retry_count + 1);
            
        EXCEPTION
            WHEN serialization_failure THEN
                retry_count := retry_count + 1;
                
                IF retry_count >= max_retries THEN
                    RETURN 'ERROR: Max retries exceeded due to serialization failures';
                END IF;
                
                -- Log retry attempt
                RAISE NOTICE 'Serialization failure, retry % of %', retry_count, max_retries;
                
                -- Small delay before retry (in real app, use exponential backoff)
                PERFORM pg_sleep(0.1 * retry_count);
                
            WHEN OTHERS THEN
                GET STACKED DIAGNOSTICS 
                    error_code = RETURNED_SQLSTATE,
                    error_message = MESSAGE_TEXT;
                RETURN 'ERROR: ' || error_code || ' - ' || error_message;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Test the retry function
SELECT '=== Test 1: Successful Transfer ===' AS test;
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT transfer_inventory_with_retry(1, 2, 2);
COMMIT;

SELECT * FROM inventory;

-- Demonstrate manual retry pattern
SELECT '=== Test 2: Manual Retry Pattern ===' AS test;
SELECT 'This shows the pattern you would implement in application code' AS note;

DO $$
DECLARE
    max_retries INT := 3;
    retry_count INT := 0;
    success BOOLEAN := false;
BEGIN
    WHILE retry_count < max_retries AND NOT success LOOP
        BEGIN
            -- Simulate transaction
            RAISE NOTICE 'Attempt % of %', retry_count + 1, max_retries;
            
            -- Your transaction logic here
            UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 1;
            UPDATE inventory SET quantity = quantity + 1 WHERE product_id = 2;
            
            success := true;
            RAISE NOTICE 'Transaction succeeded';
            
        EXCEPTION
            WHEN serialization_failure THEN
                retry_count := retry_count + 1;
                RAISE NOTICE 'Serialization failure, retrying...';
                
                IF retry_count >= max_retries THEN
                    RAISE NOTICE 'Max retries exceeded';
                    RAISE;
                END IF;
                
                -- Exponential backoff
                PERFORM pg_sleep(0.1 * POWER(2, retry_count - 1));
        END;
    END LOOP;
END $$;

-- Instructions for concurrent testing
SELECT '=== Instructions for Manual Testing ===' AS instructions;
SELECT 'To test serialization failures and retries:' AS instruction;

SELECT 'Terminal 1: Run this' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT * FROM inventory WHERE product_id = 1;
SELECT pg_sleep(5);
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 1;
COMMIT;' AS commands;

SELECT '' AS separator;

SELECT 'Terminal 2: Run this immediately after Terminal 1' AS terminal;
SELECT 'BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
SELECT * FROM inventory WHERE product_id = 1;
UPDATE inventory SET quantity = quantity - 1 WHERE product_id = 1;
COMMIT;  -- This will fail with serialization error' AS commands;

-- Error codes reference
SELECT '=== Common Error Codes ===' AS reference;
SELECT '40001' AS code, 'serialization_failure' AS name, 'Retry the transaction' AS action
UNION ALL
SELECT '40P01' AS code, 'deadlock_detected' AS name, 'Retry with lock ordering' AS action
UNION ALL
SELECT '23505' AS code, 'unique_violation' AS name, 'Handle duplicate key' AS action
UNION ALL
SELECT '23503' AS code, 'foreign_key_violation' AS name, 'Check referential integrity' AS action
UNION ALL
SELECT '23514' AS code, 'check_violation' AS name, 'Validate input data' AS action;

-- Retry strategy recommendations
SELECT '=== Retry Strategy Recommendations ===' AS recommendations;
SELECT '1. Use exponential backoff: 100ms, 200ms, 400ms, etc.' AS recommendation
UNION ALL
SELECT '2. Add jitter to prevent thundering herd' AS recommendation
UNION ALL
SELECT '3. Set maximum retry limit (3-5 retries)' AS recommendation
UNION ALL
SELECT '4. Log retry attempts for monitoring' AS recommendation
UNION ALL
SELECT '5. Only retry on transient errors (serialization, deadlock)' AS recommendation
UNION ALL
SELECT '6. Don''t retry on permanent errors (constraint violations)' AS recommendation;

-- Clean up
DROP FUNCTION IF EXISTS transfer_inventory_with_retry;

