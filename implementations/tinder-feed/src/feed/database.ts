import { redis, KEYS } from "../connection.js";
import type { FeedItem, UserProfile } from "../types.js";

export class FeedDatabase {
  async addFeedItem(
    userId: string,
    candidateProfile: UserProfile,
    score: number,
    distance: number,
    commonInterests: string[]
  ): Promise<FeedItem> {
    const feedItem: FeedItem = {
      userId,
      candidateId: candidateProfile.id,
      candidateProfile,
      score,
      distance,
      commonInterests,
      createdAt: Date.now(),
      isInterested: null,
      swipedAt: null,
    };

    const feedKey = KEYS.FEED(userId);
    const itemKey = KEYS.FEED_ITEM(userId, candidateProfile.id);

    await redis.set(itemKey, JSON.stringify(feedItem));

    await redis.zadd(feedKey, feedItem.createdAt, candidateProfile.id);

    return feedItem;
  }

  async getFeedItem(
    userId: string,
    candidateId: string
  ): Promise<FeedItem | null> {
    const itemKey = KEYS.FEED_ITEM(userId, candidateId);
    const data = await redis.get(itemKey);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as FeedItem;
  }

  async getUnswipedFeedItems(
    userId: string,
    count: number = 10
  ): Promise<FeedItem[]> {
    const feedKey = KEYS.FEED(userId);
    const candidateIds = await redis.zrange(feedKey, 0, -1);

    const items: FeedItem[] = [];
    for (const candidateId of candidateIds) {
      if (items.length >= count) break;

      const item = await this.getFeedItem(userId, candidateId);
      if (item && item.isInterested === null) {
        items.push(item);
      }
    }

    return items;
  }

  async getAllFeedItems(userId: string): Promise<FeedItem[]> {
    const feedKey = KEYS.FEED(userId);
    const candidateIds = await redis.zrange(feedKey, 0, -1);

    const items: FeedItem[] = [];
    for (const candidateId of candidateIds) {
      const item = await this.getFeedItem(userId, candidateId);
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  async updateSwipe(
    userId: string,
    candidateId: string,
    isInterested: boolean
  ): Promise<FeedItem | null> {
    const item = await this.getFeedItem(userId, candidateId);
    if (!item) {
      return null;
    }

    item.isInterested = isInterested;
    item.swipedAt = Date.now();

    const itemKey = KEYS.FEED_ITEM(userId, candidateId);
    await redis.set(itemKey, JSON.stringify(item));

    return item;
  }

  async feedItemExists(userId: string, candidateId: string): Promise<boolean> {
    const itemKey = KEYS.FEED_ITEM(userId, candidateId);
    const exists = await redis.exists(itemKey);
    return exists === 1;
  }

  async getFeedSize(userId: string): Promise<number> {
    const feedKey = KEYS.FEED(userId);
    return redis.zcard(feedKey);
  }

  async getUnswipedCount(userId: string): Promise<number> {
    const items = await this.getAllFeedItems(userId);
    return items.filter((item) => item.isInterested === null).length;
  }

  async deleteFeedItem(userId: string, candidateId: string): Promise<void> {
    const feedKey = KEYS.FEED(userId);
    const itemKey = KEYS.FEED_ITEM(userId, candidateId);
    await redis.zrem(feedKey, candidateId);
    await redis.del(itemKey);
  }

  async clearFeed(userId: string): Promise<void> {
    const feedKey = KEYS.FEED(userId);
    const candidateIds = await redis.zrange(feedKey, 0, -1);

    for (const candidateId of candidateIds) {
      const itemKey = KEYS.FEED_ITEM(userId, candidateId);
      await redis.del(itemKey);
    }

    await redis.del(feedKey);
  }
}

export const feedDatabase = new FeedDatabase();
