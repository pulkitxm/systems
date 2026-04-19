# Leader Election Demo

This demo simulates leader election on a single machine without needing distributed infrastructure. Each "node" is simulated using JavaScript timers to mimic independent processes.

## What is Leader Election?

In distributed systems, **leader election** is a mechanism where nodes in a cluster automatically select one of themselves to be the leader. When the leader fails, the remaining nodes elect a new one.

### Why Do We Need It?

Consider this scenario:
- You have servers behind a load balancer
- An **orchestrator** monitors these servers and replaces failed ones
- But who monitors the orchestrator?
- You need an orchestrator for the orchestrator...
- This creates infinite recursion!

**Leader election is the base case** that stops this recursion. Instead of external monitoring, the system monitors itself and self-heals.

```
Without leader election:          With leader election:
  A monitors B                      Leader monitors workers
  C monitors A                      Workers monitor each other
  D monitors C                      If leader dies → elect new one
  ... (infinite)                    System self-heals ✓
```

## The Bully Algorithm

This demo implements the **Bully Algorithm**, one of the simplest leader election algorithms.

### How It Works

1. **Each node has a unique ID** (higher ID = higher priority)

2. **Leader sends heartbeats** to all followers periodically

3. **Followers monitor heartbeats** - if no heartbeat received within timeout, assume leader is dead

4. **Election process**:
   - Node sends `ELECTION` message to all nodes with **higher IDs**
   - If a higher node responds with `OK`, it takes over the election
   - If **no higher node responds**, the node declares itself leader
   - New leader broadcasts `COORDINATOR` message to all nodes

5. **Highest alive node always wins** (hence "Bully" - it bullies its way to leadership)

### Visual Example

```
Initial state: Node 5 is leader
┌─────────────────────────────────┐
│  Node 1  Node 2  Node 3  Node 4 │  Node 5
│    📋      📋      📋      📋   │    👑
│                                 │  LEADER
└─────────────────────────────────┘
              ▲ heartbeats ▲

Node 5 dies:
┌─────────────────────────────────┐
│  Node 1  Node 2  Node 3  Node 4 │  Node 5
│    📋      📋      📋      📋   │    💀
│                                 │   DEAD
└─────────────────────────────────┘
       ⏰ timeout - no heartbeat!

Election starts:
┌─────────────────────────────────┐
│  Node 3 sends ELECTION to 4    │
│  Node 4 responds OK             │
│  Node 4 sends ELECTION to 5     │
│  Node 5 is dead - no response   │
│  Node 4 becomes leader!         │
└─────────────────────────────────┘

New state:
┌─────────────────────────────────┐
│  Node 1  Node 2  Node 3  Node 4 │  Node 5
│    📋      📋      📋      👑   │    💀
│                          LEADER │   DEAD
└─────────────────────────────────┘
```

## Running the Demos

```bash
# Simple demo - shows leader election in action
node demo.js

# Detailed Bully algorithm implementation
node bully-algorithm.js
```

## Demo Output

```
══════════════════════════════════════════════════
    LEADER ELECTION SIMULATION
    Using Bully Algorithm (simplified)
══════════════════════════════════════════════════

1. Starting cluster with Node 5 as initial leader...

[Node 1] Starting as follower
[Node 2] Starting as follower
[Node 3] Starting as follower
[Node 4] Starting as follower
[Node 5] 👑 Starting as LEADER

────────────────────────────────────────
Cluster Status:
  Node 1: 📋 Follower
  Node 2: 📋 Follower
  Node 3: 📋 Follower
  Node 4: 📋 Follower
  Node 5: 👑 LEADER
────────────────────────────────────────

2. Killing the leader (Node 5)...

[Node 5] ☠️  KILLED!

   Waiting for election to complete...


[Node 2] ⚠️  No heartbeat received. Starting election!
[Node 2] Sending election message to nodes: 3, 4
[Node 3] Responding to election from Node 2

[Node 3] ⚠️  No heartbeat received. Starting election!
[Node 3] Sending election message to nodes: 4
[Node 4] Responding to election from Node 3

[Node 4] ⚠️  No heartbeat received. Starting election!

[Node 4] 👑 I am the new LEADER!

[Node 4] 👑 Starting as LEADER
[Node 4] Responding to election from Node 2

[Node 4] ⚠️  No heartbeat received. Starting election!

[Node 4] 👑 I am the new LEADER!

[Node 4] 👑 Starting as LEADER

[Node 1] ⚠️  No heartbeat received. Starting election!
[Node 1] Sending election message to nodes: 2, 3, 4
[Node 2] Responding to election from Node 1

[Node 2] ⚠️  No heartbeat received. Starting election!
[Node 2] Sending election message to nodes: 3, 4
[Node 3] Responding to election from Node 2

[Node 3] ⚠️  No heartbeat received. Starting election!
[Node 3] Sending election message to nodes: 4
[Node 4] Responding to election from Node 3

[Node 4] ⚠️  No heartbeat received. Starting election!

[Node 4] 👑 I am the new LEADER!

[Node 4] 👑 Starting as LEADER
[Node 4] Responding to election from Node 2

[Node 4] ⚠️  No heartbeat received. Starting election!

[Node 4] 👑 I am the new LEADER!

[Node 4] 👑 Starting as LEADER
[Node 3] Responding to election from Node 1

[Node 3] ⚠️  No heartbeat received. Starting election!
[Node 3] Sending election message to nodes: 4
[Node 4] Responding to election from Node 3

[Node 4] ⚠️  No heartbeat received. Starting election!

[Node 4] 👑 I am the new LEADER!

[Node 4] 👑 Starting as LEADER
[Node 4] Responding to election from Node 1

[Node 4] ⚠️  No heartbeat received. Starting election!

[Node 4] 👑 I am the new LEADER!

[Node 4] 👑 Starting as LEADER

────────────────────────────────────────
Cluster Status:
  Node 1: 📋 Follower
  Node 2: 📋 Follower
  Node 3: 📋 Follower
  Node 4: 👑 LEADER
  Node 5: 💀 DEAD
────────────────────────────────────────

3. Killing the new leader...

[Node 4] ☠️  KILLED!


[Node 2] ⚠️  No heartbeat received. Starting election!
[Node 2] Sending election message to nodes: 3
[Node 3] Responding to election from Node 2

[Node 3] ⚠️  No heartbeat received. Starting election!

[Node 3] 👑 I am the new LEADER!

[Node 3] 👑 Starting as LEADER

[Node 1] ⚠️  No heartbeat received. Starting election!
[Node 1] Sending election message to nodes: 2, 3
[Node 2] Responding to election from Node 1

[Node 2] ⚠️  No heartbeat received. Starting election!
[Node 2] Sending election message to nodes: 3
[Node 3] Responding to election from Node 2

[Node 3] ⚠️  No heartbeat received. Starting election!

[Node 3] 👑 I am the new LEADER!

[Node 3] 👑 Starting as LEADER
[Node 3] Responding to election from Node 1

[Node 3] ⚠️  No heartbeat received. Starting election!

[Node 3] 👑 I am the new LEADER!

[Node 3] 👑 Starting as LEADER

────────────────────────────────────────
Cluster Status:
  Node 1: 📋 Follower
  Node 2: 📋 Follower
  Node 3: 👑 LEADER
  Node 4: 💀 DEAD
  Node 5: 💀 DEAD
────────────────────────────────────────

4. Reviving Node 5 (original leader)...
[Node 5] 🔄 Revived!
[Node 5] Starting as follower

────────────────────────────────────────
Cluster Status:
  Node 1: 📋 Follower
  Node 2: 📋 Follower
  Node 3: 👑 LEADER
  Node 4: 💀 DEAD
  Node 5: 📋 Follower
────────────────────────────────────────

══════════════════════════════════════════════════
    DEMO COMPLETE
══════════════════════════════════════════════════

Key observations:
- When leader dies, followers detect missing heartbeats
- Election starts automatically (no human intervention)
- Highest ID node becomes the new leader (Bully algorithm)
- System continues functioning after leader failure
```

## Code Structure

### `demo.js`
A simplified simulation focusing on the core concepts:
- Heartbeat mechanism
- Election timeout
- Leader promotion

### `bully-algorithm.js`
A more complete implementation with:
- Proper message types (`ELECTION`, `OK`, `COORDINATOR`)
- Message delays to simulate network
- State machine (`follower`, `candidate`, `leader`)
- Detailed logging

## Key Concepts

### Heartbeats
The leader periodically sends "I'm alive" messages to all followers. If followers don't receive heartbeats within a timeout, they assume the leader is dead.

```javascript
startHeartbeat() {
  setInterval(() => {
    this.broadcast("heartbeat", { leaderId: this.id });
  }, 300);
}
```

### Election Timeout
Each follower has a randomized timeout. This randomization prevents all nodes from starting elections simultaneously (which would cause conflicts).

```javascript
const timeout = 1000 + Math.random() * 500; // 1000-1500ms
```

### The "Bully" Part
When a node starts an election, it only contacts nodes with **higher IDs**. If any respond, they take over. The highest ID always wins:

```javascript
startElection() {
  const higherNodes = this.cluster.nodes.filter(
    (n) => n.id > this.id && n.alive
  );

  if (higherNodes.length === 0) {
    this.becomeLeader(); // No one higher? I win!
  } else {
    higherNodes.forEach((n) => n.receiveElection(this.id));
  }
}
```

## Other Leader Election Algorithms

### Raft
- More sophisticated than Bully
- Uses **terms** (epochs) and **voting**
- Candidate requests votes from peers
- Needs majority to become leader
- Used by: etcd, Consul

### Paxos
- Theoretically elegant but complex
- Proves consensus is possible in async systems
- Basis for many distributed systems

### Ring Algorithm
- Nodes arranged in logical ring
- Election message passes around ring
- Collects all alive node IDs
- Highest ID in the ring wins

## Real-World Usage

Leader election is used in many production systems:

| System | Algorithm | Purpose |
|--------|-----------|---------|
| Kubernetes (etcd) | Raft | Control plane HA |
| Kafka | ZooKeeper/KRaft | Controller election |
| PostgreSQL + Patroni | Consensus | Automatic failover |
| Redis Sentinel | Custom | Failover coordination |
| Consul | Raft | Server leader election |

## Exercise Ideas

1. **Modify the timeout**: What happens with very short/long timeouts?
2. **Add network delays**: Simulate slow networks
3. **Implement Ring algorithm**: Compare with Bully
4. **Add split-brain detection**: What if network partitions?
5. **Visualize elections**: Build a UI to watch elections happen

## Related

- Blog post: [High Availability](https://pulkitxm.com/series/system-design/high-availability) (replication, failover, leader election)
