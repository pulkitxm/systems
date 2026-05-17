import { feedGenerator } from "./generator.js";
import { feedDatabase } from "./database.js";
import type { FeedItem } from "../types.js";

export interface GetFeedOptions {
  count?: number;
  radiusKm?: number;
}

export class FeedAPI {
  async getFeed(
    userId: string,
    options: GetFeedOptions = {}
  ): Promise<FeedItem[]> {
    const { count = 10, radiusKm = 50 } = options;
    return feedGenerator.getOrGenerateFeed(userId, count, radiusKm);
  }

  async getNextProfile(userId: string): Promise<FeedItem | null> {
    const items = await feedDatabase.getUnswipedFeedItems(userId, 1);
    if (items.length > 0) {
      return items[0];
    }

    const newItems = await feedGenerator.generateFeed({
      userId,
      count: 10,
      radiusKm: 50,
    });

    return newItems.length > 0 ? newItems[0] : null;
  }

  async getFeedStats(userId: string): Promise<{
    total: number;
    unswiped: number;
    liked: number;
    passed: number;
  }> {
    const items = await feedDatabase.getAllFeedItems(userId);
    return {
      total: items.length,
      unswiped: items.filter((i) => i.isInterested === null).length,
      liked: items.filter((i) => i.isInterested === true).length,
      passed: items.filter((i) => i.isInterested === false).length,
    };
  }
}

export const feedAPI = new FeedAPI();
