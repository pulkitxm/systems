/**
 * Bully Algorithm Implementation
 *
 * The Bully Algorithm is one of the simplest leader election algorithms.
 * Rules:
 * 1. When a node detects leader failure, it starts an election
 * 2. It sends election messages to all nodes with HIGHER IDs
 * 3. If no higher node responds, it becomes the leader
 * 4. If a higher node responds, it takes over the election
 * 5. The node with the highest ID always wins (hence "Bully")
 *
 * Run: node bully-algorithm.js
 */

const HEARTBEAT_INTERVAL = 300;
const ELECTION_TIMEOUT = 800;
const MESSAGE_DELAY = 50;

class BullyNode {
  constructor(id, cluster) {
    this.id = id;
    this.cluster = cluster;
    this.state = "follower";
    this.alive = true;
    this.currentLeader = null;
    this.timers = {};
  }

  log(message) {
    const stateEmoji =
      this.state === "leader"
        ? "👑"
        : this.state === "candidate"
          ? "🗳️"
          : "📋";
    console.log(`[Node ${this.id} ${stateEmoji}] ${message}`);
  }

  start(asLeader = false) {
    if (asLeader) {
      this.state = "leader";
      this.currentLeader = this.id;
      this.startHeartbeat();
      this.log("Started as LEADER");
    } else {
      this.state = "follower";
      this.startElectionTimer();
      this.log("Started as follower");
    }
  }

  startHeartbeat() {
    this.clearTimer("heartbeat");
    this.timers.heartbeat = setInterval(() => {
      if (!this.alive || this.state !== "leader") return;
      this.broadcast("heartbeat", { leaderId: this.id });
    }, HEARTBEAT_INTERVAL);
  }

  startElectionTimer() {
    this.clearTimer("election");
    const timeout = ELECTION_TIMEOUT + Math.random() * 200;
    this.timers.election = setTimeout(() => {
      if (this.alive && this.state === "follower") {
        this.log("⏰ Election timeout - no heartbeat from leader");
        this.startElection();
      }
    }, timeout);
  }

  startElection() {
    this.state = "candidate";
    this.log("Starting election...");

    const higherNodes = this.cluster.nodes.filter(
      (n) => n.id > this.id && n.alive
    );

    if (higherNodes.length === 0) {
      this.log("No higher nodes alive - becoming leader");
      this.declareVictory();
      return;
    }

    this.log(`Sending ELECTION to nodes: [${higherNodes.map((n) => n.id).join(", ")}]`);

    let gotResponse = false;

    higherNodes.forEach((node) => {
      setTimeout(() => {
        if (node.alive) {
          node.receiveMessage("election", { from: this.id });
          gotResponse = true;
        }
      }, MESSAGE_DELAY);
    });

    this.clearTimer("electionWait");
    this.timers.electionWait = setTimeout(() => {
      if (this.state === "candidate" && !gotResponse) {
        this.declareVictory();
      }
    }, ELECTION_TIMEOUT);
  }

  declareVictory() {
    this.state = "leader";
    this.currentLeader = this.id;
    this.log("👑 I am the new LEADER!");

    this.broadcast("coordinator", { leaderId: this.id });
    this.startHeartbeat();
  }

  receiveMessage(type, data) {
    if (!this.alive) return;

    switch (type) {
      case "heartbeat":
        this.currentLeader = data.leaderId;
        if (this.state !== "leader") {
          this.state = "follower";
          this.startElectionTimer();
        }
        break;

      case "election":
        this.log(`Received ELECTION from Node ${data.from}`);
        setTimeout(() => {
          if (this.alive) {
            const sender = this.cluster.nodes.find((n) => n.id === data.from);
            if (sender && sender.alive) {
              sender.receiveMessage("ok", { from: this.id });
            }
          }
        }, MESSAGE_DELAY);

        if (this.state !== "leader") {
          this.startElection();
        }
        break;

      case "ok":
        this.log(`Received OK from Node ${data.from} - stepping back`);
        this.state = "follower";
        this.startElectionTimer();
        break;

      case "coordinator":
        this.log(`Node ${data.leaderId} is the new leader`);
        this.currentLeader = data.leaderId;
        this.state = "follower";
        this.clearTimer("election");
        this.clearTimer("electionWait");
        this.startElectionTimer();
        break;
    }
  }

  broadcast(type, data) {
    this.cluster.nodes.forEach((node) => {
      if (node.id !== this.id && node.alive) {
        setTimeout(() => {
          node.receiveMessage(type, data);
        }, MESSAGE_DELAY);
      }
    });
  }

  kill() {
    this.log("☠️  KILLED");
    this.alive = false;
    this.state = "dead";
    Object.keys(this.timers).forEach((key) => this.clearTimer(key));
  }

  revive() {
    this.log("🔄 Revived - starting election");
    this.alive = true;
    this.state = "follower";

    setTimeout(() => {
      if (this.alive) {
        this.startElection();
      }
    }, 100);
  }

  clearTimer(name) {
    if (this.timers[name]) {
      clearTimeout(this.timers[name]);
      clearInterval(this.timers[name]);
      delete this.timers[name];
    }
  }

  shutdown() {
    Object.keys(this.timers).forEach((key) => this.clearTimer(key));
  }
}

class BullyCluster {
  constructor(nodeCount) {
    this.nodes = [];
    for (let i = 1; i <= nodeCount; i++) {
      this.nodes.push(new BullyNode(i, this));
    }
  }

  start(initialLeaderId) {
    console.log(`\nStarting cluster with ${this.nodes.length} nodes...`);
    console.log(`Initial leader: Node ${initialLeaderId}\n`);

    this.nodes.forEach((node) => {
      node.start(node.id === initialLeaderId);
    });
  }

  status() {
    console.log("\n┌" + "─".repeat(38) + "┐");
    console.log("│          CLUSTER STATUS              │");
    console.log("├" + "─".repeat(38) + "┤");
    this.nodes.forEach((n) => {
      const status = !n.alive
        ? "💀 DEAD    "
        : n.state === "leader"
          ? "👑 LEADER  "
          : n.state === "candidate"
            ? "🗳️ CANDIDATE"
            : "📋 FOLLOWER";
      const leader = n.currentLeader ? `(thinks ${n.currentLeader} is leader)` : "";
      console.log(`│  Node ${n.id}: ${status} ${leader.padEnd(15)}│`);
    });
    console.log("└" + "─".repeat(38) + "┘\n");
  }

  getLeader() {
    return this.nodes.find((n) => n.state === "leader" && n.alive);
  }

  shutdown() {
    this.nodes.forEach((n) => n.shutdown());
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demo() {
  console.log("═".repeat(50));
  console.log("      BULLY ALGORITHM DEMONSTRATION");
  console.log("═".repeat(50));

  const cluster = new BullyCluster(5);

  console.log("\n📌 STEP 1: Initialize cluster");
  cluster.start(5);
  await sleep(1500);
  cluster.status();

  console.log("📌 STEP 2: Kill the leader (Node 5)");
  cluster.nodes[4].kill();
  await sleep(2500);
  cluster.status();

  console.log("📌 STEP 3: Kill the new leader (Node 4)");
  const newLeader = cluster.getLeader();
  if (newLeader) newLeader.kill();
  await sleep(2500);
  cluster.status();

  console.log("📌 STEP 4: Revive Node 5 (highest ID)");
  cluster.nodes[4].revive();
  await sleep(2000);
  cluster.status();

  console.log("═".repeat(50));
  console.log("           DEMO COMPLETE");
  console.log("═".repeat(50));

  console.log("\n📖 BULLY ALGORITHM SUMMARY:");
  console.log("─".repeat(50));
  console.log("1. When a node detects leader failure:");
  console.log("   → It sends ELECTION to all nodes with HIGHER IDs");
  console.log("");
  console.log("2. If a higher node receives ELECTION:");
  console.log("   → It responds with OK");
  console.log("   → It starts its own election");
  console.log("");
  console.log("3. If no higher node responds:");
  console.log("   → The node declares itself LEADER");
  console.log("   → It broadcasts COORDINATOR to all nodes");
  console.log("");
  console.log("4. The highest alive node always wins (the 'bully')");
  console.log("─".repeat(50));
  console.log("");

  cluster.shutdown();
}

demo();
