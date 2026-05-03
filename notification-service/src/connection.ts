import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
});

export type Channel = "email" | "sms" | "push_android" | "push_ios";
export type Priority = "P1" | "P2" | "P3";

export interface NotificationTemplate {
  id: string;
  channel: Channel;
  subject?: string;
  body: string;
  variables: string[];
}

export interface NotificationMessage {
  id: string;
  userId: string;
  channel: Channel;
  body: string;
  subject?: string;
  contactInfo: string;
  campaignId?: string;
  priority: Priority;
  createdAt: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  deviceToken?: string;
  city?: string;
  platform?: "android" | "ios";
}

export interface BulkNotificationJob {
  id: string;
  templateId: string;
  campaignId: string;
  filters: {
    city?: string;
    platform?: "android" | "ios";
  };
  channel: Channel;
  variables: Record<string, string>;
  priority: Priority;
}

export async function cleanup() {
  await redis.quit();
}
