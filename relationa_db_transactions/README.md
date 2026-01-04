# Database Transaction Tests

Test scripts for learning database transaction internals (ACID, isolation levels, MVCC, deadlocks, etc.)

## Quick Start

**1. Start database:**
```bash
docker-compose up -d
```

**2. Run any test:**
```bash
docker exec -i transactions_db psql -U admin -d transactions_db < 01_basic_transaction.sql
```

**3. Or connect interactively:**
```bash
docker exec -it transactions_db psql -U admin -d transactions_db
```

## Test Files

| File | Topic | Terminals |
|------|-------|-----------|
| `01_basic_transaction.sql` | ACID basics, atomicity | 1 |
| `02_consistency_constraints.sql` | Constraints, deferred checks | 1 |
| `03_isolation_read_uncommitted.sql` | Read Uncommitted | 2 |
| `04_isolation_read_committed.sql` | Read Committed, non-repeatable reads | 2 |
| `05_isolation_repeatable_read.sql` | Repeatable Read, snapshots | 2 |
| `06_isolation_serializable.sql` | Serializable, write skew | 2 |
| `07_mvcc_demonstration.sql` | MVCC internals, xmin/xmax | 1 |
| `08_deadlock_demonstration.sql` | Deadlocks, lock ordering | 2 |
| `09_savepoints.sql` | Partial rollback | 1 |
| `10_wal_and_durability.sql` | Write-Ahead Log | 1 |
| `11_performance_and_monitoring.sql` | Performance monitoring | 1 |
| `12_retry_logic_example.sql` | Retry logic for serialization errors | 1 |

**Note:** Tests marked "2 terminals" need concurrent sessions. Open two terminals and follow instructions in the script.

## Examples

**Run a single test:**
```bash
docker exec -i transactions_db psql -U admin -d transactions_db < 07_mvcc_demonstration.sql
```

**Two-terminal test (e.g., deadlock demo):**

Terminal 1:
```bash
docker exec -it transactions_db psql -U admin -d transactions_db
# Then follow instructions in 08_deadlock_demonstration.sql
```

Terminal 2:
```bash
docker exec -it transactions_db psql -U admin -d transactions_db
# Then follow instructions in 08_deadlock_demonstration.sql
```

## Stop Database

```bash
docker-compose down -v
```

