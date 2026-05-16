import { io } from "socket.io-client";
import * as readline from "readline";

const SERVER_URL = "http://localhost:3000";

interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
}

const socket = io(SERVER_URL);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const tty = process.stdout.isTTY;
const ansi = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  gray: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[92m",
  blue: "\x1b[94m",
};

function paint(text: string, ...codes: string[]): string {
  if (!tty) return text;
  return `${codes.join("")}${text}${ansi.reset}`;
}

let myUsername = "";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clearLine() {
  process.stdout.write("\r\x1b[K");
}

function printBanner() {
  const line = paint("═", ansi.dim).repeat(46);
  console.log(`\n${line}`);
  console.log(
    `  ${paint("Real-time Abuse Masker Chat", ansi.bold)}`,
  );
  console.log(`${line}\n`);
}

function printChatLine(data: {
  username: string;
  message: string;
  timestamp: number;
}) {
  const isSelf = data.username === myUsername;
  const label = isSelf ? "You" : data.username;
  const namePaint = isSelf ? ansi.green + ansi.bold : ansi.cyan + ansi.bold;
  const time = paint(`[${formatTime(data.timestamp)}]`, ansi.dim);
  const name = paint(label, namePaint);
  console.log(`${time} ${name}  ${data.message}`);
}

function prompt() {
  const p = tty ? `${paint("›", ansi.blue + ansi.bold)} ` : "> ";
  rl.question(p, (input) => {
    const text = input.trim();
    if (text.length === 0) {
      prompt();
      return;
    }

    socket.emit("message", text, (data?: ChatMessage) => {
      if (tty) process.stdout.write("\x1b[1A\x1b[K");
      if (data) printChatLine(data);
      prompt();
    });
  });
}

socket.on("connect", () => {
  printBanner();

  rl.question(`${paint("Username", ansi.dim)}: `, (username) => {
    if (!username.trim()) {
      console.log("Username cannot be empty");
      process.exit(1);
    }

    myUsername = username.trim();
    socket.emit("join", myUsername);
  });
});

socket.on("joined", (data: { username: string; room: string }) => {
  console.log(
    `${paint("●", ansi.green)} Connected as ${paint(data.username, ansi.bold)}`,
  );
  console.log(
    paint("  Others only see masked text; abuses never leave the server as plain words.", ansi.dim),
  );
  console.log(paint("─".repeat(50), ansi.dim), "\n");
  prompt();
});

socket.on("message", (data: ChatMessage) => {
  clearLine();
  printChatLine(data);
});

socket.on("user-joined", (data: { username: string }) => {
  clearLine();
  console.log(
    `${paint("→", ansi.dim)} ${paint(data.username, ansi.bold)} joined`,
  );
});

socket.on("user-left", (data: { username: string }) => {
  clearLine();
  console.log(
    `${paint("←", ansi.dim)} ${paint(data.username, ansi.bold)} left`,
  );
});

socket.on("error", (message: string) => {
  console.error(`${paint("Error", ansi.bold)}: ${message}`);
});

socket.on("disconnect", () => {
  console.log(`\n${paint("Disconnected", ansi.dim)}`);
  process.exit(0);
});

socket.on("connect_error", () => {
  console.error("Failed to connect to server. Is it running?");
  process.exit(1);
});

process.on("SIGINT", () => {
  console.log(`\n${paint("Goodbye", ansi.dim)}`);
  socket.disconnect();
  rl.close();
  process.exit(0);
});
