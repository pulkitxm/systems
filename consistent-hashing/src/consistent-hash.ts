import { createHash } from "crypto";

interface RingNode {
  slot: number;
  nodeId: string;
}

export class ConsistentHash {
  private ring: RingNode[] = [];
  private ringSize: number;
  private virtualNodes: number;

  constructor(ringSize: number = 1_000_000, virtualNodes: number = 100) {
    this.ringSize = ringSize;
    this.virtualNodes = virtualNodes;
  }

  private hash(key: string): number {
    const hsh = createHash("sha256");
    hsh.update(key);
    const hexDigest = hsh.digest("hex");
    return parseInt(hexDigest.slice(0, 8), 16) % this.ringSize;
  }

  addNode(nodeId: string): void {
    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualKey = `${nodeId}_vnode_${i}`;
      const slot = this.hash(virtualKey);
      this.ring.push({ slot, nodeId });
    }
    this.ring.sort((a, b) => a.slot - b.slot);
  }

  removeNode(nodeId: string): void {
    this.ring = this.ring.filter((n) => n.nodeId !== nodeId);
  }

  getNode(key: string): string | null {
    if (this.ring.length === 0) return null;

    const slot = this.hash(key);

    let left = 0;
    let right = this.ring.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.ring[mid].slot < slot) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    if (this.ring[left].slot >= slot) {
      return this.ring[left].nodeId;
    }

    return this.ring[0].nodeId;
  }

  getNodes(): string[] {
    const uniqueNodes = new Set<string>();
    for (const node of this.ring) {
      uniqueNodes.add(node.nodeId);
    }
    return Array.from(uniqueNodes);
  }

  getRingSize(): number {
    return this.ring.length;
  }

  getKeyDistribution(keys: string[]): Map<string, string[]> {
    const distribution = new Map<string, string[]>();

    for (const key of keys) {
      const node = this.getNode(key);
      if (node) {
        if (!distribution.has(node)) {
          distribution.set(node, []);
        }
        distribution.get(node)!.push(key);
      }
    }

    return distribution;
  }
}

export class SimpleHash {
  private nodes: string[] = [];

  addNode(nodeId: string): void {
    this.nodes.push(nodeId);
  }

  removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter((n) => n !== nodeId);
  }

  getNode(key: string): string | null {
    if (this.nodes.length === 0) return null;

    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }

    return this.nodes[hash % this.nodes.length];
  }

  getNodes(): string[] {
    return [...this.nodes];
  }

  getKeyDistribution(keys: string[]): Map<string, string[]> {
    const distribution = new Map<string, string[]>();

    for (const key of keys) {
      const node = this.getNode(key);
      if (node) {
        if (!distribution.has(node)) {
          distribution.set(node, []);
        }
        distribution.get(node)!.push(key);
      }
    }

    return distribution;
  }
}
