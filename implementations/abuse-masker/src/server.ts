import { createServer } from "http";
import { Server } from "socket.io";
import { ABUSE_WORDS_URL } from "./abuse-words-source.js";
import { Trie } from "./trie.js";
import { AbuseMasker } from "./masker.js";

const PORT = 3000;
const ROOM_ID = "chat-room";

interface ChatMessage {
  username: string;
  message: string;
  timestamp: number;
}

async function main() {
  const trie = new Trie();
  await trie.loadFromUrl(ABUSE_WORDS_URL);

  const masker = new AbuseMasker(trie);

  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    let username = "";

    socket.on("join", (name: string) => {
      username = name;
      socket.join(ROOM_ID);

      console.log(`${username} joined the chat`);

      socket.to(ROOM_ID).emit("user-joined", {
        username,
        timestamp: Date.now(),
      });

      socket.emit("joined", {
        username,
        room: ROOM_ID,
        timestamp: Date.now(),
      });
    });

    socket.on("message", (text: string, ack?: (msg?: ChatMessage) => void) => {
      if (!username) {
        socket.emit("error", "You must join first");
        if (typeof ack === "function") ack();
        return;
      }

      const maskedMessage = masker.mask(text);
      const chatMessage: ChatMessage = {
        username,
        message: maskedMessage,
        timestamp: Date.now(),
      };

      socket.broadcast.to(ROOM_ID).emit("message", chatMessage);
      if (typeof ack === "function") {
        ack(chatMessage);
      }

      if (maskedMessage !== text) {
        console.log(`[MASKED] ${username}: "${text}" -> "${maskedMessage}"`);
      }
    });

    socket.on("disconnect", () => {
      if (username) {
        console.log(`${username} left the chat`);
        socket.to(ROOM_ID).emit("user-left", {
          username,
          timestamp: Date.now(),
        });
      }
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`\nChat server running on http://localhost:${PORT}`);
    console.log(`Abuse masking enabled with ${trie.getWordCount()} words\n`);
  });
}

main().catch(console.error);
