export interface Location {
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  id: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  photos: string[];
  gender: "male" | "female" | "other";
  lookingFor: ("male" | "female" | "other")[];
  lastActive: number;
  createdAt: number;
}

export interface FeedItem {
  userId: string;
  candidateId: string;
  candidateProfile: UserProfile;
  score: number;
  distance: number;
  commonInterests: string[];
  createdAt: number;
  isInterested: boolean | null;
  swipedAt: number | null;
}

export interface Match {
  id: string;
  userA: string;
  userB: string;
  createdAt: number;
}

export interface FeedGenerationRequest {
  userId: string;
  count: number;
  radiusKm: number;
}

export interface SwipeResult {
  success: boolean;
  isMatch: boolean;
  matchId?: string;
}

export interface NearbyUser {
  userId: string;
  distance: number;
}

export const INTEREST_CATEGORIES = [
  "Music",
  "Movies",
  "Sports",
  "Travel",
  "Food",
  "Art",
  "Photography",
  "Gaming",
  "Fitness",
  "Reading",
  "Dancing",
  "Cooking",
  "Hiking",
  "Yoga",
  "Coffee",
  "Wine",
  "Dogs",
  "Cats",
  "Beach",
  "Mountains",
] as const;

export type Interest = (typeof INTEREST_CATEGORIES)[number];
