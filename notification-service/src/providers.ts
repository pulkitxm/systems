import type { Channel } from "./connection.js";

export interface SendResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
  latencyMs: number;
}

function simulateLatency(): Promise<number> {
  const latency = 50 + Math.random() * 150;
  return new Promise((resolve) => setTimeout(() => resolve(latency), latency));
}

function simulateFailure(failRate = 0.05): boolean {
  return Math.random() < failRate;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  const latency = await simulateLatency();

  if (simulateFailure()) {
    return {
      success: false,
      provider: "resend",
      error: "Temporary provider error",
      latencyMs: latency,
    };
  }

  console.log(`  📧 [Resend] Sending email to ${to}`);
  console.log(`     Subject: ${subject}`);
  console.log(`     Body: ${body.slice(0, 50)}${body.length > 50 ? "..." : ""}`);

  return {
    success: true,
    provider: "resend",
    messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    latencyMs: latency,
  };
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const latency = await simulateLatency();

  if (simulateFailure()) {
    return {
      success: false,
      provider: "twilio",
      error: "Temporary provider error",
      latencyMs: latency,
    };
  }

  console.log(`  📱 [Twilio] Sending SMS to ${to}`);
  console.log(`     Body: ${body.slice(0, 50)}${body.length > 50 ? "..." : ""}`);

  return {
    success: true,
    provider: "twilio",
    messageId: `SM${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
    latencyMs: latency,
  };
}

export async function sendPushAndroid(deviceToken: string, body: string): Promise<SendResult> {
  const latency = await simulateLatency();

  if (simulateFailure()) {
    return {
      success: false,
      provider: "firebase",
      error: "Invalid device token",
      latencyMs: latency,
    };
  }

  console.log(`  🤖 [Firebase] Sending Android push to ${deviceToken.slice(0, 20)}...`);
  console.log(`     Body: ${body.slice(0, 50)}${body.length > 50 ? "..." : ""}`);

  return {
    success: true,
    provider: "firebase",
    messageId: `fcm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    latencyMs: latency,
  };
}

export async function sendPushIos(deviceToken: string, body: string): Promise<SendResult> {
  const latency = await simulateLatency();

  if (simulateFailure()) {
    return {
      success: false,
      provider: "apns",
      error: "Device not registered",
      latencyMs: latency,
    };
  }

  console.log(`  🍎 [APNS] Sending iOS push to ${deviceToken.slice(0, 20)}...`);
  console.log(`     Body: ${body.slice(0, 50)}${body.length > 50 ? "..." : ""}`);

  return {
    success: true,
    provider: "apns",
    messageId: `apns_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    latencyMs: latency,
  };
}

export async function sendViaProvider(
  channel: Channel,
  contactInfo: string,
  body: string,
  subject?: string
): Promise<SendResult> {
  switch (channel) {
    case "email":
      return sendEmail(contactInfo, subject ?? "Notification", body);
    case "sms":
      return sendSms(contactInfo, body);
    case "push_android":
      return sendPushAndroid(contactInfo, body);
    case "push_ios":
      return sendPushIos(contactInfo, body);
    default:
      return {
        success: false,
        provider: "unknown",
        error: `Unknown channel: ${channel}`,
        latencyMs: 0,
      };
  }
}
