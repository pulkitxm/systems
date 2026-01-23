import * as net from "net";
import * as readline from "readline";
import { Protocol } from "./protocol";
import { ParsedResponse } from "./types";

export class CustomProtocolClient {
  private port: number;
  private host: string;
  private client: net.Socket | null;
  private connected: boolean;

  constructor(port: number = 9999, host: string = "127.0.0.1") {
    this.port = port;
    this.host = host;
    this.client = null;
    this.connected = false;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = net.createConnection(
        { port: this.port, host: this.host },
        () => {
          this.connected = true;
          console.log(`✅ Connected to ${this.host}:${this.port}\n`);
          resolve();
        }
      );

      this.client.on("error", (err: Error) => {
        console.error("❌ Connection error:", err.message);
        this.connected = false;
        reject(err);
      });

      this.client.on("end", () => {
        this.connected = false;
        console.log("\n👋 Disconnected from server");
      });
    });
  }

  sendCommand(command: string): Promise<ParsedResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.client) {
        reject(new Error("Not connected to server"));
        return;
      }

      this.client.write(`${command}\n`);

      this.client.once("data", (data: Buffer) => {
        const response = Protocol.parseResponse(data.toString());
        resolve(response);
      });
    });
  }

  close(): void {
    if (this.client) {
      this.client.end();
    }
  }
}

async function interactiveMode(): Promise<void> {
  const client = new CustomProtocolClient();

  try {
    await client.connect();
  } catch (err) {
    console.error("Failed to connect. Is the server running?");
    console.error("Start it with: npm run server");
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "> ",
  });

  console.log("📝 Available commands:");
  console.log("   SET key value  - Store a key-value pair");
  console.log("   GET key        - Retrieve value by key");
  console.log("   DEL key        - Delete a key");
  console.log("   PING           - Test connection");
  console.log("   QUIT           - Close connection\n");

  rl.prompt();

  rl.on("line", async (line: string) => {
    const command = line.trim();

    if (!command) {
      rl.prompt();
      return;
    }

    try {
      const response = await client.sendCommand(command);

      if (response.type === "error") {
        console.log(`❌ ${response.value}`);
      } else if (response.type === "simple") {
        console.log(`✅ ${response.value}`);
      } else if (response.type === "bulk") {
        console.log(`📦 ${response.value}`);
      } else if (response.type === "null") {
        console.log(`∅ (null)`);
      }

      if (command.toUpperCase() === "QUIT") {
        client.close();
        rl.close();
        process.exit(0);
      }
    } catch (err) {
      console.error("❌ Error:", (err as Error).message);
    }

    rl.prompt();
  });

  rl.on("SIGINT", () => {
    console.log("\n\nClosing connection...");
    client.sendCommand("QUIT").then(() => {
      client.close();
      process.exit(0);
    });
  });
}

if (require.main === module) {
  interactiveMode();
}
