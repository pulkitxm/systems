import * as net from "net";
import { Protocol } from "./protocol";
import { ServerStats } from "./types";

export class CustomProtocolServer {
  private port: number;
  private host: string;
  private store: Map<string, string>;
  private server: net.Server | null;
  private startTime: number;

  constructor(port: number = 9999, host: string = "127.0.0.1") {
    this.port = port;
    this.host = host;
    this.store = new Map<string, string>();
    this.server = null;
    this.startTime = Date.now();
  }

  start(): void {
    this.server = net.createServer((socket: net.Socket) => {
      console.log(
        `[${new Date().toISOString()}] Client connected: ${socket.remoteAddress}:${socket.remotePort}`
      );

      socket.on("data", (data: Buffer) => {
        this.handleCommand(socket, data);
      });

      socket.on("end", () => {
        console.log(
          `[${new Date().toISOString()}] Client disconnected: ${socket.remoteAddress}:${socket.remotePort}`
        );
      });

      socket.on("error", (err: Error) => {
        console.error(
          `[${new Date().toISOString()}] Socket error:`,
          err.message
        );
      });
    });

    this.server.listen(this.port, this.host, () => {
      console.log(`\n🚀 Custom Protocol Server`);
      console.log(`   Listening on ${this.host}:${this.port}`);
      console.log(`   Store: In-memory key-value store`);
      console.log(`\n📝 Supported Commands:`);
      console.log(`   SET key value  - Store a key-value pair`);
      console.log(`   GET key        - Retrieve value by key`);
      console.log(`   DEL key        - Delete a key`);
      console.log(`   PING           - Test connection`);
      console.log(`   QUIT           - Close connection`);
      console.log(`\n💡 Connect with: telnet localhost ${this.port}`);
      console.log(`   Or use: npm run client\n`);
    });

    this.server.on("error", (err: Error) => {
      console.error("Server error:", err);
    });
  }

  private handleCommand(socket: net.Socket, data: Buffer): void {
    const parsed = Protocol.parseCommand(data);

    if (parsed.error) {
      console.log(`[${new Date().toISOString()}] ERROR: ${parsed.error}`);
      socket.write(Protocol.formatError(parsed.error));
      return;
    }

    const { command, key, value } = parsed;
    console.log(
      `[${new Date().toISOString()}] Command: ${command}${key ? ` ${key}` : ""}`
    );

    switch (command) {
      case "SET":
        if (key && value) {
          this.store.set(key, value);
          console.log(`   Stored: ${key} = ${value}`);
          socket.write(Protocol.formatSimpleString("OK"));
        }
        break;

      case "GET":
        if (key) {
          if (this.store.has(key)) {
            const val = this.store.get(key)!;
            console.log(`   Retrieved: ${key} = ${val}`);
            socket.write(Protocol.formatBulkString(val));
          } else {
            console.log(`   Key not found: ${key}`);
            socket.write(Protocol.formatError("key not found"));
          }
        }
        break;

      case "DEL":
        if (key) {
          if (this.store.has(key)) {
            this.store.delete(key);
            console.log(`   Deleted: ${key}`);
            socket.write(Protocol.formatSimpleString("OK"));
          } else {
            console.log(`   Key not found: ${key}`);
            socket.write(Protocol.formatError("key not found"));
          }
        }
        break;

      case "PING":
        console.log(`   Responding: PONG`);
        socket.write(Protocol.formatSimpleString("PONG"));
        break;

      case "QUIT":
        console.log(`   Closing connection`);
        socket.write(Protocol.formatSimpleString("BYE"));
        socket.end();
        break;
    }
  }

  stop(): void {
    if (this.server) {
      this.server.close(() => {
        console.log("\n👋 Server shut down");
      });
    }
  }

  getStats(): ServerStats {
    return {
      keys: this.store.size,
      uptime: (Date.now() - this.startTime) / 1000,
    };
  }
}

if (require.main === module) {
  const server = new CustomProtocolServer();
  server.start();

  process.on("SIGINT", () => {
    console.log("\n\nReceived SIGINT, shutting down...");
    server.stop();
    process.exit(0);
  });
}
