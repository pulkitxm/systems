-- ============================================
-- 09. SAVEPOINTS (Partial Rollback)
-- ============================================
-- Demonstrates how to rollback part of a transaction

-- Clean up
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Setup
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    price DECIMAL(10, 2),
    stock INT CHECK (stock >= 0)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer VARCHAR(50),
    total DECIMAL(10, 2),
    status VARCHAR(20)
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    product_id INT REFERENCES products(id),
    quantity INT CHECK (quantity > 0),
    price DECIMAL(10, 2)
);

INSERT INTO products VALUES 
    (1, 'Laptop', 1000.00, 5),
    (2, 'Mouse', 25.00, 50),
    (3, 'Keyboard', 75.00, 30);

SELECT '=== Initial State ===' AS status;
SELECT * FROM products;

-- Test 1: Basic savepoint usage
SELECT '=== Test 1: Basic Savepoint ===' AS test;

BEGIN;

-- Create order
INSERT INTO orders VALUES (1, 'John Doe', 0, 'pending');
SELECT 'Order created' AS status;

-- Savepoint before adding items
SAVEPOINT before_items;

-- Add first item (success)
INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (1, 1, 1, 1000.00);
SELECT 'Added laptop' AS status;

-- Add second item (success)
INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (1, 2, 2, 25.00);
SELECT 'Added mice' AS status;

-- Try to add invalid item (will fail)
-- INSERT INTO order_items (order_id, product_id, quantity, price) 
-- VALUES (1, 999, 1, 100.00);  -- Foreign key violation

-- Simulate error and rollback to savepoint
ROLLBACK TO SAVEPOINT before_items;
SELECT 'Rolled back to savepoint - items removed but order remains' AS status;

SELECT * FROM orders;
SELECT * FROM order_items;

COMMIT;

SELECT '=== After Commit ===' AS status;
SELECT * FROM orders;
SELECT * FROM order_items;
SELECT 'Notice: Order exists but has no items' AS note;

-- Test 2: Multiple savepoints
SELECT '=== Test 2: Multiple Savepoints ===' AS test;

BEGIN;

INSERT INTO orders VALUES (2, 'Jane Smith', 0, 'pending');
SAVEPOINT order_created;

INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (2, 1, 1, 1000.00);
SAVEPOINT item1_added;

INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (2, 2, 1, 25.00);
SAVEPOINT item2_added;

INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (2, 3, 1, 75.00);
SAVEPOINT item3_added;

SELECT 'All items added' AS status;
SELECT * FROM order_items WHERE order_id = 2;

-- Rollback last item only
ROLLBACK TO SAVEPOINT item2_added;
SELECT 'Rolled back to item2_added - keyboard removed' AS status;
SELECT * FROM order_items WHERE order_id = 2;

COMMIT;

SELECT '=== After Commit ===' AS status;
SELECT * FROM order_items WHERE order_id = 2;

-- Test 3: Savepoint with error handling
SELECT '=== Test 3: Savepoint with Error Handling ===' AS test;

BEGIN;

INSERT INTO orders VALUES (3, 'Bob Wilson', 0, 'pending');
SAVEPOINT order_created;

-- Try to add items, handle errors gracefully
INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (3, 1, 1, 1000.00);

SAVEPOINT before_problem_item;

-- This would cause an error (negative quantity not allowed by CHECK constraint)
-- INSERT INTO order_items (order_id, product_id, quantity, price) 
-- VALUES (3, 2, -5, 25.00);

-- In real application, you would catch this error and:
-- ROLLBACK TO SAVEPOINT before_problem_item;

-- Continue with valid items
INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (3, 3, 1, 75.00);

-- Update order total
UPDATE orders SET total = (
    SELECT SUM(price * quantity) 
    FROM order_items 
    WHERE order_id = 3
) WHERE id = 3;

COMMIT;

SELECT '=== Final State ===' AS status;
SELECT * FROM orders WHERE id = 3;
SELECT * FROM order_items WHERE order_id = 3;

-- Test 4: Releasing savepoints
SELECT '=== Test 4: Releasing Savepoints ===' AS test;

BEGIN;

INSERT INTO orders VALUES (4, 'Alice Brown', 0, 'pending');
SAVEPOINT sp1;

INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (4, 1, 1, 1000.00);
SAVEPOINT sp2;

INSERT INTO order_items (order_id, product_id, quantity, price) 
VALUES (4, 2, 1, 25.00);

-- Release sp2 (can no longer rollback to it)
RELEASE SAVEPOINT sp2;
SELECT 'Released sp2 - can no longer rollback to it' AS status;

-- Can still rollback to sp1
ROLLBACK TO SAVEPOINT sp1;
SELECT 'Rolled back to sp1 - all items removed' AS status;

COMMIT;

SELECT '=== After Commit ===' AS status;
SELECT * FROM orders WHERE id = 4;
SELECT * FROM order_items WHERE order_id = 4;

