import { locationTracker } from "../location/tracker.js";
import { profileStore } from "../profile/store.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { feedDatabase } from "./database.js";
import {
  getCommonInterests,
  calculateCompatibilityScore,
  isGenderMatch,
} from "../profile/interests.js";
import type { FeedItem, FeedGenerationRequest, UserProfile } from "../types.js";

interface CandidateScore {
  profile: UserProfile;
  distance: number;
  score: number;
  commonInterests: string[];
}

export class FeedGenerator {
  async generateFeed(request: FeedGenerationRequest): Promise<FeedItem[]> {
    const { userId, count, radiusKm } = request;

    const userProfile = await profileStore.getProfile(userId);
    if (!userProfile) {
      throw new Error(`User profile not found: ${userId}`);
    }

    const nearbyUsers = await locationTracker.getNearbyUsers(
      userId,
      radiusKm,
      count * 3
    );

    if (nearbyUsers.length === 0) {
      return [];
    }

    const candidateIds = nearbyUsers.map((u) => u.userId);
    const seenStatus = await seenProfilesFilter.hasSeenMany(userId, candidateIds);

    const unseenCandidateIds = candidateIds.filter(
      (id) => !seenStatus.get(id)
    );

    if (unseenCandidateIds.length === 0) {
      return [];
    }

    const profiles = await profileStore.getProfiles(unseenCandidateIds);
    const maxDistanceMeters = radiusKm * 1000;

    const candidates: CandidateScore[] = [];

    for (const nearbyUser of nearbyUsers) {
      if (seenStatus.get(nearbyUser.userId)) {
        continue;
      }

      const profile = profiles.get(nearbyUser.userId);
      if (!profile) {
        continue;
      }

      if (!isGenderMatch(userProfile, profile)) {
        continue;
      }

      const feedItemExists = await feedDatabase.feedItemExists(
        userId,
        nearbyUser.userId
      );
      if (feedItemExists) {
        continue;
      }

      const commonInterests = getCommonInterests(userProfile, profile);
      const score = calculateCompatibilityScore(
        userProfile,
        profile,
        nearbyUser.distance,
        maxDistanceMeters
      );

      candidates.push({
        profile,
        distance: nearbyUser.distance,
        score,
        commonInterests,
      });
    }

    candidates.sort((a, b) => b.score - a.score);

    const topCandidates = candidates.slice(0, count);
    const feedItems: FeedItem[] = [];

    for (const candidate of topCandidates) {
      const feedItem = await feedDatabase.addFeedItem(
        userId,
        candidate.profile,
        candidate.score,
        candidate.distance,
        candidate.commonInterests
      );
      feedItems.push(feedItem);
    }

    return feedItems;
  }

  async getOrGenerateFeed(
    userId: string,
    count: number = 10,
    radiusKm: number = 50
  ): Promise<FeedItem[]> {
    const existingItems = await feedDatabase.getUnswipedFeedItems(userId, count);

    if (existingItems.length >= count) {
      return existingItems.slice(0, count);
    }

    const needed = count - existingItems.length;
    const newItems = await this.generateFeed({
      userId,
      count: needed,
      radiusKm,
    });

    return [...existingItems, ...newItems];
  }
}

export const feedGenerator = new FeedGenerator();
