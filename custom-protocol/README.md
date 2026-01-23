# Custom Protocol - Simple Key-Value Store

A demonstration of building a custom protocol over TCP, similar to Redis RESP but simpler.

## What This Demonstrates

- Building a custom text-based protocol over TCP
- How clients and servers agree on a message format
- Command parsing and response formatting
- Why you might choose custom protocols over HTTP

## Protocol Specification

### Request Format

```
COMMAND KEY [VALUE]\n
```

All commands end with a newline character (`\n`).

### Commands

1. **SET** - Store a key-value pair
   ```
   SET mykey myvalue\n
   ```
   Response: `+OK\n` or `-ERROR: message\n`

2. **GET** - Retrieve a value by key
   ```
   GET mykey\n
   ```
   Response: `$5\nmyvalue\n` (bulk string) or `-ERROR: key not found\n`

3. **DEL** - Delete a key
   ```
   DEL mykey\n
   ```
   Response: `+OK\n` or `-ERROR: key not found\n`

4. **PING** - Test connection
   ```
   PING\n
   ```
   Response: `+PONG\n`

5. **QUIT** - Close connection
   ```
   QUIT\n
   ```
   Response: `+BYE\n` then closes connection

### Response Format

- **Simple String**: `+OK\n`
- **Error**: `-ERROR: message\n`
- **Bulk String**: `$length\ndata\n`
  - Example: `$5\nhello\n` (5 bytes of "hello")
  - Null: `$-1\n`

## Setup

```bash
# Install dependencies
npm install

# Build TypeScript (compiles to dist/)
npm run build
```

## Running the Demo

### Start the Server

```bash
# Production (compiled)
npm run server

# Development (with ts-node)
npm run dev:server
```

### Connect with Client

```bash
# Terminal 2 - Production
npm run client

# Or development
npm run dev:client

# Or use telnet
telnet localhost 9999
```

### Run Automated Demo

```bash
# Production
npm run demo

# Development
npm run dev:demo
```

### Example Session

```
> SET name Alice
+OK

> GET name
$5
Alice

> SET age 25
+OK

> GET age
$2
25

> DEL name
+OK

> GET name
-ERROR: key not found

> PING
+PONG

> QUIT
+BYE
```

## Why Custom Protocols?

### Advantages

1. **Optimized for specific use case**: No HTTP overhead for simple operations
2. **Lower latency**: Direct binary or text format without HTTP headers
3. **Simpler parsing**: Purpose-built for your data structures
4. **Smaller payload**: No verbose HTTP headers on every request

### Disadvantages

1. **Custom clients needed**: Can't use standard HTTP libraries
2. **Less tooling**: No Postman, browser DevTools, etc.
3. **Documentation needed**: Protocol must be well-documented
4. **Learning curve**: Team needs to understand custom format

### When to Use Custom Protocols

- **Database systems**: Redis, MySQL, PostgreSQL all use custom protocols
- **Message queues**: Kafka, RabbitMQ have specialized protocols
- **Performance-critical services**: When HTTP overhead matters
- **Specialized communication**: Unique requirements not served by HTTP

## Comparing to HTTP

### HTTP Request/Response

```
POST /api/set HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Content-Length: 27

{"key":"name","value":"Alice"}

HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 15

{"status":"ok"}
```

**Total bytes**: ~150+ bytes for headers + data

### Custom Protocol

```
SET name Alice\n

+OK\n
```

**Total bytes**: ~20 bytes

For millions of operations per second, this difference matters.

## Files

- `server.js` - The custom protocol server
- `client.js` - Interactive client implementation
- `protocol.js` - Protocol parser and formatter
- `demo.js` - Automated demo showcasing all features
- `package.json` - Dependencies

## Learning Path

1. Read the protocol specification above
2. Examine `protocol.js` to understand parsing
3. Review `server.js` to see how TCP server works
4. Try `client.js` for interactive testing
5. Run `demo.js` to see automated examples

## Next Steps

Try extending the protocol:

- Add `KEYS` command to list all keys
- Add `EXPIRE` command for TTL
- Add `INCR`/`DECR` for atomic counters
- Add bulk operations like `MGET` and `MSET`
- Implement pipelining (multiple commands in one TCP packet)
