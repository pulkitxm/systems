/**
 * Leader Election Simulation using Worker Threads
 *
 * This demo simulates leader election without needing multiple machines.
 * Each "node" is simulated using setTimeout/setInterval to mimic independent processes.
 *
 * Run: node demo.js
 */

class Node {
  constructor(id, cluster) {
    this.id = id;
    this.cluster = cluster;
    this.isLeader = false;
    this.isAlive = true;
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = null;
    this.electionTimeout = null;
  }

  start() {
    if (this.isLeader) {
      this.startAsLeader();
    } else {
      this.startAsFollower();
    }
  }

  startAsLeader() {
    console.log(`[Node ${this.id}] 👑 Starting as LEADER`);
    this.heartbeatInterval = setInterval(() => {
      if (!this.isAlive) return;
      this.sendHeartbeats();
    }, 500);
  }

  startAsFollower() {
    console.log(`[Node ${this.id}] Starting as follower`);
    this.resetElectionTimeout();
  }

  sendHeartbeats() {
    const followers = this.cluster.nodes.filter(
      (n) => n.id !== this.id && n.isAlive
    );
    followers.forEach((follower) => {
      follower.receiveHeartbeat(this.id);
    });
  }

  receiveHeartbeat(leaderId) {
    if (!this.isAlive) return;
    this.lastHeartbeat = Date.now();
    this.resetElectionTimeout();
  }

  resetElectionTimeout() {
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }
    const timeout = 1000 + Math.random() * 500;
    this.electionTimeout = setTimeout(() => {
      if (this.isAlive && !this.isLeader) {
        this.startElection();
      }
    }, timeout);
  }

  startElection() {
    console.log(`\n[Node ${this.id}] ⚠️  No heartbeat received. Starting election!`);

    const higherNodes = this.cluster.nodes.filter(
      (n) => n.id > this.id && n.isAlive
    );

    if (higherNodes.length === 0) {
      this.becomeLeader();
    } else {
      console.log(
        `[Node ${this.id}] Sending election message to nodes: ${higherNodes.map((n) => n.id).join(", ")}`
      );

      let receivedResponse = false;
      higherNodes.forEach((node) => {
        if (node.isAlive) {
          receivedResponse = true;
          node.respondToElection(this.id);
        }
      });

      if (!receivedResponse) {
        this.becomeLeader();
      } else {
        this.resetElectionTimeout();
      }
    }
  }

  respondToElection(callerId) {
    if (!this.isAlive) return;
    console.log(`[Node ${this.id}] Responding to election from Node ${callerId}`);
    this.startElection();
  }

  becomeLeader() {
    console.log(`\n[Node ${this.id}] 👑 I am the new LEADER!\n`);
    this.isLeader = true;

    this.cluster.nodes.forEach((n) => {
      if (n.id !== this.id) {
        n.isLeader = false;
      }
    });

    this.startAsLeader();
  }

  kill() {
    console.log(`\n[Node ${this.id}] ☠️  KILLED!\n`);
    this.isAlive = false;
    this.isLeader = false;
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
  }

  revive() {
    console.log(`[Node ${this.id}] 🔄 Revived!`);
    this.isAlive = true;
    this.isLeader = false;
    this.startAsFollower();
  }
}

class Cluster {
  constructor(nodeCount) {
    this.nodes = [];
    for (let i = 1; i <= nodeCount; i++) {
      this.nodes.push(new Node(i, this));
    }
  }

  start(initialLeaderId) {
    const leader = this.nodes.find((n) => n.id === initialLeaderId);
    if (leader) {
      leader.isLeader = true;
    }
    this.nodes.forEach((node) => node.start());
  }

  getLeader() {
    return this.nodes.find((n) => n.isLeader && n.isAlive);
  }

  getAliveNodes() {
    return this.nodes.filter((n) => n.isAlive);
  }

  status() {
    console.log("\n" + "─".repeat(40));
    console.log("Cluster Status:");
    this.nodes.forEach((n) => {
      const status = !n.isAlive ? "💀 DEAD" : n.isLeader ? "👑 LEADER" : "📋 Follower";
      console.log(`  Node ${n.id}: ${status}`);
    });
    console.log("─".repeat(40) + "\n");
  }

  shutdown() {
    this.nodes.forEach((n) => {
      if (n.heartbeatInterval) clearInterval(n.heartbeatInterval);
      if (n.electionTimeout) clearTimeout(n.electionTimeout);
    });
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function demo() {
  console.log("═".repeat(50));
  console.log("    LEADER ELECTION SIMULATION");
  console.log("    Using Bully Algorithm (simplified)");
  console.log("═".repeat(50));

  const cluster = new Cluster(5);

  console.log("\n1. Starting cluster with Node 5 as initial leader...\n");
  cluster.start(5);

  await sleep(2000);
  cluster.status();

  console.log("2. Killing the leader (Node 5)...");
  const leader = cluster.getLeader();
  if (leader) {
    leader.kill();
  }

  console.log("   Waiting for election to complete...\n");
  await sleep(3000);
  cluster.status();

  console.log("3. Killing the new leader...");
  const newLeader = cluster.getLeader();
  if (newLeader) {
    newLeader.kill();
  }

  await sleep(3000);
  cluster.status();

  console.log("4. Reviving Node 5 (original leader)...");
  cluster.nodes[4].revive();

  await sleep(3000);
  cluster.status();

  console.log("═".repeat(50));
  console.log("    DEMO COMPLETE");
  console.log("═".repeat(50));
  console.log("\nKey observations:");
  console.log("- When leader dies, followers detect missing heartbeats");
  console.log("- Election starts automatically (no human intervention)");
  console.log("- Highest ID node becomes the new leader (Bully algorithm)");
  console.log("- System continues functioning after leader failure\n");

  cluster.shutdown();
}

demo();
