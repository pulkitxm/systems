import { CustomProtocolServer } from "./server";
import { CustomProtocolClient } from "./client";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const testClient = new CustomProtocolClient();
    testClient
      .connect()
      .then(() => {
        testClient.close();
        resolve(true);
      })
      .catch(() => {
        resolve(false);
      });
  });
}

interface Command {
  cmd: string;
  desc: string;
}

async function runDemo(): Promise<void> {
  console.log("🎬 Custom Protocol Demo\n");
  console.log("This demonstrates a custom TCP protocol for a key-value store");
  console.log("Similar to Redis RESP but simpler for learning\n");

  const serverAlreadyRunning = await checkServerRunning();

  let server: CustomProtocolServer | null = null;
  if (serverAlreadyRunning) {
    console.log("✅ Detected server already running on port 9999");
    console.log("   Using existing server for demo\n");
  } else {
    console.log("🚀 Starting new server on port 9999\n");
    server = new CustomProtocolServer();
    server.start();
    await sleep(1000);
  }

  const client = new CustomProtocolClient();
  await client.connect();

  console.log("\n" + "=".repeat(60));
  console.log("Demo: Testing all commands");
  console.log("=".repeat(60) + "\n");

  const commands: Command[] = [
    { cmd: "PING", desc: "Test connection" },
    { cmd: "SET name Alice", desc: "Store a string" },
    { cmd: "GET name", desc: "Retrieve the value" },
    { cmd: "SET age 25", desc: "Store a number as string" },
    { cmd: "GET age", desc: "Get the age" },
    {
      cmd: "SET bio Software engineer who loves system design",
      desc: "Store multi-word value",
    },
    { cmd: "GET bio", desc: "Get the bio" },
    { cmd: "DEL age", desc: "Delete a key" },
    { cmd: "GET age", desc: "Try to get deleted key (should fail)" },
    { cmd: "GET nonexistent", desc: "Get non-existent key (should fail)" },
  ];

  for (const { cmd, desc } of commands) {
    console.log(`📤 Command: ${cmd}`);
    console.log(`   Purpose: ${desc}`);

    const response = await client.sendCommand(cmd);

    if (response.type === "error") {
      console.log(`❌ Response: ${response.value}`);
    } else if (response.type === "simple") {
      console.log(`✅ Response: ${response.value}`);
    } else if (response.type === "bulk") {
      console.log(`📦 Response: ${response.value}`);
    } else if (response.type === "null") {
      console.log(`∅ Response: (null)`);
    }

    console.log();
    await sleep(800);
  }

  console.log("=".repeat(60));
  console.log("Demo: Error Handling");
  console.log("=".repeat(60) + "\n");

  const errorCases: Command[] = [
    { cmd: "INVALID", desc: "Unknown command" },
    { cmd: "SET", desc: "Missing arguments" },
    { cmd: "GET", desc: "Missing key argument" },
  ];

  for (const { cmd, desc } of errorCases) {
    console.log(`📤 Command: ${cmd}`);
    console.log(`   Testing: ${desc}`);

    const response = await client.sendCommand(cmd);
    console.log(`❌ Response: ${response.value}\n`);

    await sleep(800);
  }

  console.log("=".repeat(60));
  console.log("Demo: Performance Comparison");
  console.log("=".repeat(60) + "\n");

  console.log("Custom Protocol vs HTTP overhead comparison:\n");

  const httpOverhead = `POST /api/set HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Content-Length: 27

{"key":"name","value":"Alice"}`;

  const customProtocol = `SET name Alice`;

  console.log("HTTP Request:");
  console.log(httpOverhead);
  console.log(`\nBytes: ${Buffer.byteLength(httpOverhead)} bytes\n`);

  console.log("-".repeat(40));

  console.log("\nCustom Protocol Request:");
  console.log(customProtocol);
  console.log(`\nBytes: ${Buffer.byteLength(customProtocol)} bytes\n`);

  const reduction =
    ((Buffer.byteLength(httpOverhead) - Buffer.byteLength(customProtocol)) /
      Buffer.byteLength(httpOverhead)) *
    100;
  console.log(
    `💡 Custom protocol is ${reduction.toFixed(1)}% smaller for this operation!\n`
  );

  console.log("=".repeat(60));
  console.log("Demo Complete!");
  console.log("=".repeat(60) + "\n");

  console.log("📚 Key Takeaways:");
  console.log("1. Custom protocols can be much more efficient than HTTP");
  console.log("2. Protocol design is about choosing the right abstractions");
  console.log("3. Text-based protocols are easier to debug than binary");
  console.log("4. Redis, PostgreSQL, MySQL all use custom protocols");
  console.log(
    "5. HTTP is great for general use, custom protocols for specialized needs\n"
  );

  await client.sendCommand("QUIT");
  client.close();

  await sleep(500);

  if (server) {
    console.log("\n🛑 Stopping demo server...");
    server.stop();
  } else {
    console.log(
      "\n💡 Server is still running. Stop it with Ctrl+C in its terminal."
    );
  }

  process.exit(0);
}

if (require.main === module) {
  runDemo().catch((err) => {
    console.error("Demo failed:", err);
    process.exit(1);
  });
}
