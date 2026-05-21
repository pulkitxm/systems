-- ============================================
-- 02. CONSISTENCY AND CONSTRAINTS TEST
-- ============================================
-- Demonstrates how constraints maintain consistency

-- Clean up
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;

-- Setup with DEFERRABLE constraint
CREATE TABLE products (
    id INT PRIMARY KEY,
    name VARCHAR(50),
    stock INT CHECK (stock >= 0)
);

CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer VARCHAR(50),
    total DECIMAL(10, 2)
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT,
    product_id INT REFERENCES products(id),
    quantity INT CHECK (quantity > 0),
    -- Deferrable foreign key constraint
    CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) 
        ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);

INSERT INTO products VALUES 
    (1, 'Laptop', 10),
    (2, 'Mouse', 50);

SELECT '=== Initial State ===' AS status;
SELECT 'Products:' AS table_name;
SELECT * FROM products;
SELECT 'Orders:' AS table_name;
SELECT * FROM orders;
SELECT 'Order Items:' AS table_name;
SELECT * FROM order_items;

-- Test 1: Immediate constraint check (default)
SELECT '=== Test 1: Immediate Constraint Check ===' AS status;
BEGIN;
UPDATE products SET stock = -5 WHERE id = 1;
-- This will fail immediately
COMMIT;

SELECT * FROM products;
SELECT 'Notice: Transaction failed immediately due to constraint' AS note;

-- Test 2: Deferred constraint check (using foreign key)
SELECT '=== Test 2: Deferred Constraint Check ===' AS status;
SELECT 'Note: CHECK constraints cannot be deferred, only foreign keys and unique constraints' AS info;

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- Try to insert order_item BEFORE creating the order (normally would fail)
INSERT INTO order_items (order_id, product_id, quantity) VALUES (100, 1, 2);
SELECT 'Step 1: Inserted order_item with order_id=100 (order does not exist yet!)' AS note;

SELECT 'Current state (order_item exists but order does not):' AS status;
SELECT * FROM order_items WHERE order_id = 100;
SELECT * FROM orders WHERE id = 100;

-- Now create the order to fix the constraint violation
INSERT INTO orders VALUES (100, 'John Doe', 2000.00);
SELECT 'Step 2: Created order with id=100 to satisfy the constraint' AS note;

COMMIT;

SELECT '=== After Commit ===' AS status;
SELECT 'Orders:' AS table_name;
SELECT * FROM orders;
SELECT 'Order Items:' AS table_name;
SELECT * FROM order_items;
SELECT 'Notice: Transaction succeeded because constraint was fixed before commit' AS note;

-- Test 3: Foreign key cascade
SELECT '=== Test 3: Foreign Key Cascade ===' AS status;
INSERT INTO orders VALUES (1, 'John Doe', 1500.00);
INSERT INTO order_items (order_id, product_id, quantity) VALUES (1, 1, 2);

SELECT 'Before delete:' AS status;
SELECT * FROM order_items;

DELETE FROM orders WHERE id = 1;

SELECT 'After delete (cascaded):' AS status;
SELECT * FROM order_items;
SELECT 'Notice: Order items were automatically deleted due to CASCADE' AS note;

