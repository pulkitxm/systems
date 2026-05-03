import {
  type NotificationMessage,
  type BulkNotificationJob,
  type Priority,
  type Channel,
} from "./connection.js";
import { getTemplate, populateTemplate } from "./template.js";
import { getUser, getContactInfo } from "./users.js";
import { enqueueNotification, enqueueBulkJob } from "./queue.js";

export interface SingleNotificationRequest {
  userId: string;
  templateId: string;
  variables: Record<string, string>;
  channel: Channel;
  priority: Priority;
}

export interface BulkNotificationRequest {
  templateId: string;
  campaignId: string;
  filters: {
    city?: string;
    platform?: "android" | "ios";
  };
  variables: Record<string, string>;
  channel: Channel;
  priority: Priority;
}

export async function sendSingleNotification(
  request: SingleNotificationRequest
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  console.log(`\n📨 Control Service: Processing single notification request`);
  console.log(`  User: ${request.userId}`);
  console.log(`  Template: ${request.templateId}`);
  console.log(`  Priority: ${request.priority}`);

  const template = await getTemplate(request.templateId);
  if (!template) {
    return { success: false, error: `Template ${request.templateId} not found` };
  }

  const user = await getUser(request.userId);
  if (!user) {
    return { success: false, error: `User ${request.userId} not found` };
  }

  const body = populateTemplate(template.body, {
    ...request.variables,
    "user.name": user.name,
  });

  const subject = template.subject
    ? populateTemplate(template.subject, {
        ...request.variables,
        "user.name": user.name,
      })
    : undefined;

  const message: NotificationMessage = {
    id: `notif_${request.userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: request.userId,
    channel: request.channel,
    body,
    subject,
    contactInfo: getContactInfo(user, request.channel),
    priority: request.priority,
    createdAt: Date.now(),
  };

  const jobId = await enqueueNotification(message, request.priority);

  console.log(`  ✅ Notification enqueued with job ID: ${jobId}`);

  return { success: true, jobId };
}

export async function sendBulkNotification(
  request: BulkNotificationRequest
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  console.log(`\n📦 Control Service: Processing bulk notification request`);
  console.log(`  Campaign: ${request.campaignId}`);
  console.log(`  Template: ${request.templateId}`);
  console.log(`  Filters: ${JSON.stringify(request.filters)}`);
  console.log(`  Priority: ${request.priority}`);

  const template = await getTemplate(request.templateId);
  if (!template) {
    return { success: false, error: `Template ${request.templateId} not found` };
  }

  const bulkJob: BulkNotificationJob = {
    id: `bulk_${request.campaignId}_${Date.now()}`,
    templateId: request.templateId,
    campaignId: request.campaignId,
    filters: request.filters,
    channel: request.channel,
    variables: request.variables,
    priority: request.priority,
  };

  const jobId = await enqueueBulkJob(bulkJob);

  console.log(`  ✅ Bulk job enqueued with job ID: ${jobId}`);

  return { success: true, jobId };
}
