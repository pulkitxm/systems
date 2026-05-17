import { redis, KEYS } from "../connection.js";
import type { UserProfile } from "../types.js";

export class ProfileStore {
  async createProfile(profile: UserProfile): Promise<void> {
    await redis.set(KEYS.PROFILE(profile.id), JSON.stringify(profile));
    await redis.sadd(KEYS.PROFILES_INDEX, profile.id);
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const data = await redis.get(KEYS.PROFILE(userId));
    if (!data) {
      return null;
    }
    return JSON.parse(data) as UserProfile;
  }

  async updateProfile(
    userId: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    const existing = await this.getProfile(userId);
    if (!existing) {
      throw new Error(`Profile not found: ${userId}`);
    }
    const updated = { ...existing, ...updates };
    await redis.set(KEYS.PROFILE(userId), JSON.stringify(updated));
  }

  async deleteProfile(userId: string): Promise<void> {
    await redis.del(KEYS.PROFILE(userId));
    await redis.srem(KEYS.PROFILES_INDEX, userId);
  }

  async getAllProfileIds(): Promise<string[]> {
    return redis.smembers(KEYS.PROFILES_INDEX);
  }

  async getProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    const profiles = new Map<string, UserProfile>();
    if (userIds.length === 0) {
      return profiles;
    }

    const pipeline = redis.pipeline();
    for (const userId of userIds) {
      pipeline.get(KEYS.PROFILE(userId));
    }
    const results = await pipeline.exec();

    if (results) {
      for (let i = 0; i < userIds.length; i++) {
        const [err, data] = results[i];
        if (!err && data) {
          profiles.set(userIds[i], JSON.parse(data as string) as UserProfile);
        }
      }
    }

    return profiles;
  }

  async countProfiles(): Promise<number> {
    return redis.scard(KEYS.PROFILES_INDEX);
  }

  async profileExists(userId: string): Promise<boolean> {
    const exists = await redis.exists(KEYS.PROFILE(userId));
    return exists === 1;
  }
}

export const profileStore = new ProfileStore();
