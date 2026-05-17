import { feedDatabase } from "../feed/database.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { matchStore } from "../match/store.js";
import type { SwipeResult, Match } from "../types.js";

export type SwipeDirection = "left" | "right";

export class SwipeHandler {
  async swipe(
    userId: string,
    candidateId: string,
    direction: SwipeDirection
  ): Promise<SwipeResult> {
    const isInterested = direction === "right";

    await feedDatabase.updateSwipe(userId, candidateId, isInterested);

    await seenProfilesFilter.markAsSeen(userId, candidateId);

    if (!isInterested) {
      return { success: true, isMatch: false };
    }

    const candidateFeedItem = await feedDatabase.getFeedItem(
      candidateId,
      userId
    );

    if (candidateFeedItem && candidateFeedItem.isInterested === true) {
      const existingMatch = await matchStore.hasMatch(userId, candidateId);
      if (!existingMatch) {
        const match = await matchStore.createMatch(userId, candidateId);
        return { success: true, isMatch: true, matchId: match.id };
      }
    }

    return { success: true, isMatch: false };
  }

  async swipeRight(userId: string, candidateId: string): Promise<SwipeResult> {
    return this.swipe(userId, candidateId, "right");
  }

  async swipeLeft(userId: string, candidateId: string): Promise<SwipeResult> {
    return this.swipe(userId, candidateId, "left");
  }

  async getSwipeHistory(
    userId: string
  ): Promise<{ liked: string[]; passed: string[] }> {
    const items = await feedDatabase.getAllFeedItems(userId);
    return {
      liked: items
        .filter((i) => i.isInterested === true)
        .map((i) => i.candidateId),
      passed: items
        .filter((i) => i.isInterested === false)
        .map((i) => i.candidateId),
    };
  }

  async getLikedBy(userId: string): Promise<string[]> {
    const allProfileIds = await import("../profile/store.js").then(
      (m) => m.profileStore.getAllProfileIds()
    );
    const likedBy: string[] = [];

    for (const profileId of allProfileIds) {
      if (profileId === userId) continue;
      const feedItem = await feedDatabase.getFeedItem(profileId, userId);
      if (feedItem && feedItem.isInterested === true) {
        likedBy.push(profileId);
      }
    }

    return likedBy;
  }

  async getMatches(userId: string): Promise<Match[]> {
    return matchStore.getMatchesForUser(userId);
  }
}

export const swipeHandler = new SwipeHandler();
