import { redis, type NotificationTemplate, type Channel } from "./connection.js";

const TEMPLATE_PREFIX = "template:";

export async function createTemplate(
  channel: Channel,
  subject: string | undefined,
  body: string,
  variables: string[]
): Promise<NotificationTemplate> {
  const id = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const template: NotificationTemplate = { id, channel, subject, body, variables };

  await redis.set(`${TEMPLATE_PREFIX}${id}`, JSON.stringify(template));

  return template;
}

export async function getTemplate(id: string): Promise<NotificationTemplate | null> {
  const data = await redis.get(`${TEMPLATE_PREFIX}${id}`);
  if (!data) return null;
  return JSON.parse(data) as NotificationTemplate;
}

export function populateTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return result;
}

export async function listTemplates(): Promise<NotificationTemplate[]> {
  const keys = await redis.keys(`${TEMPLATE_PREFIX}*`);
  if (keys.length === 0) return [];

  const values = await redis.mget(keys);
  return values
    .filter((v): v is string => v !== null)
    .map((v) => JSON.parse(v) as NotificationTemplate);
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const result = await redis.del(`${TEMPLATE_PREFIX}${id}`);
  return result > 0;
}
