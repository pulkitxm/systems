import type { User } from "./connection.js";

const MOCK_USERS: User[] = [
  { id: "user_001", name: "Alice Chen", email: "alice@example.com", phone: "+1234567001", deviceToken: "fcm_alice_token_abc123", city: "San Francisco", platform: "ios" },
  { id: "user_002", name: "Bob Smith", email: "bob@example.com", phone: "+1234567002", deviceToken: "fcm_bob_token_def456", city: "New York", platform: "android" },
  { id: "user_003", name: "Carol Davis", email: "carol@example.com", phone: "+1234567003", deviceToken: "fcm_carol_token_ghi789", city: "San Francisco", platform: "android" },
  { id: "user_004", name: "David Wilson", email: "david@example.com", phone: "+1234567004", deviceToken: "fcm_david_token_jkl012", city: "Chicago", platform: "ios" },
  { id: "user_005", name: "Eve Martinez", email: "eve@example.com", phone: "+1234567005", deviceToken: "fcm_eve_token_mno345", city: "New York", platform: "android" },
  { id: "user_006", name: "Frank Brown", email: "frank@example.com", phone: "+1234567006", deviceToken: "fcm_frank_token_pqr678", city: "Los Angeles", platform: "ios" },
  { id: "user_007", name: "Grace Lee", email: "grace@example.com", phone: "+1234567007", deviceToken: "fcm_grace_token_stu901", city: "San Francisco", platform: "android" },
  { id: "user_008", name: "Henry Taylor", email: "henry@example.com", phone: "+1234567008", deviceToken: "fcm_henry_token_vwx234", city: "Chicago", platform: "ios" },
  { id: "user_009", name: "Ivy Anderson", email: "ivy@example.com", phone: "+1234567009", deviceToken: "fcm_ivy_token_yza567", city: "New York", platform: "android" },
  { id: "user_010", name: "Jack Thomas", email: "jack@example.com", phone: "+1234567010", deviceToken: "fcm_jack_token_bcd890", city: "Los Angeles", platform: "ios" },
];

export function generateUsers(count: number): User[] {
  const cities = ["San Francisco", "New York", "Chicago", "Los Angeles", "Seattle", "Austin", "Boston", "Denver"];
  const platforms: ("android" | "ios")[] = ["android", "ios"];
  const firstNames = ["Alex", "Blake", "Casey", "Dana", "Ellis", "Finn", "Gray", "Harper", "Indigo", "Jordan"];
  const lastNames = ["Adams", "Baker", "Clark", "Dixon", "Evans", "Foster", "Garcia", "Harris", "Irving", "Jones"];

  const users: User[] = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const id = `user_${String(i + 1).padStart(6, "0")}`;

    users.push({
      id,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      phone: `+1${String(1000000000 + i)}`,
      deviceToken: `fcm_token_${id}_${Math.random().toString(36).slice(2, 10)}`,
      city: cities[i % cities.length],
      platform: platforms[i % platforms.length],
    });
  }

  return users;
}

export async function getUser(id: string): Promise<User | null> {
  return MOCK_USERS.find((u) => u.id === id) ?? null;
}

export async function getUsers(filters?: {
  city?: string;
  platform?: "android" | "ios";
}): Promise<User[]> {
  let result = [...MOCK_USERS];

  if (filters?.city) {
    result = result.filter((u) => u.city === filters.city);
  }
  if (filters?.platform) {
    result = result.filter((u) => u.platform === filters.platform);
  }

  return result;
}

export async function getUsersFromReplica(
  filters?: { city?: string; platform?: "android" | "ios" },
  count?: number
): Promise<User[]> {
  console.log("  📖 Reading from users database replica...");

  const baseUsers = count && count > MOCK_USERS.length
    ? generateUsers(count)
    : MOCK_USERS;

  let result = [...baseUsers];

  if (filters?.city) {
    result = result.filter((u) => u.city === filters.city);
  }
  if (filters?.platform) {
    result = result.filter((u) => u.platform === filters.platform);
  }

  return result;
}

export function getContactInfo(user: User, channel: string): string {
  switch (channel) {
    case "email":
      return user.email;
    case "sms":
      return user.phone;
    case "push_android":
    case "push_ios":
      return user.deviceToken ?? "";
    default:
      return user.email;
  }
}
