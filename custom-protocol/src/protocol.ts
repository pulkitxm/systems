import { ParsedCommand, ParsedResponse } from "./types";

export class Protocol {
  static parseCommand(buffer: Buffer): ParsedCommand {
    const message = buffer.toString().trim();
    const parts = message.split(" ");
    const command = parts[0].toUpperCase();

    switch (command) {
      case "SET":
        if (parts.length < 3) {
          return { command: "SET", error: "SET requires key and value" };
        }
        return {
          command: "SET",
          key: parts[1],
          value: parts.slice(2).join(" "),
        };

      case "GET":
        if (parts.length !== 2) {
          return { command: "GET", error: "GET requires exactly one key" };
        }
        return {
          command: "GET",
          key: parts[1],
        };

      case "DEL":
        if (parts.length !== 2) {
          return { command: "DEL", error: "DEL requires exactly one key" };
        }
        return {
          command: "DEL",
          key: parts[1],
        };

      case "PING":
        return { command: "PING" };

      case "QUIT":
        return { command: "QUIT" };

      default:
        return {
          command: "PING",
          error: `Unknown command: ${command}`,
        };
    }
  }

  static formatSimpleString(str: string): string {
    return `+${str}\n`;
  }

  static formatError(message: string): string {
    return `-ERROR: ${message}\n`;
  }

  static formatBulkString(str: string | null | undefined): string {
    if (str === null || str === undefined) {
      return "$-1\n";
    }
    const bytes = Buffer.byteLength(str, "utf8");
    return `$${bytes}\n${str}\n`;
  }

  static parseResponse(response: string): ParsedResponse {
    const firstChar = response[0];

    if (firstChar === "+") {
      return { type: "simple", value: response.slice(1).trim() };
    }

    if (firstChar === "-") {
      return { type: "error", value: response.slice(1).trim() };
    }

    if (firstChar === "$") {
      const lines = response.split("\n");
      const length = parseInt(lines[0].slice(1));

      if (length === -1) {
        return { type: "null", value: null };
      }

      return { type: "bulk", value: lines[1] };
    }

    return { type: "unknown", value: response };
  }
}
