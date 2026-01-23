export interface ParsedCommand {
  command: "SET" | "GET" | "DEL" | "PING" | "QUIT";
  key?: string;
  value?: string;
  error?: string;
}

export type ResponseType = "simple" | "error" | "bulk" | "null" | "unknown";

export interface ParsedResponse {
  type: ResponseType;
  value: string | null;
}

export interface ServerStats {
  keys: number;
  uptime: number;
}
