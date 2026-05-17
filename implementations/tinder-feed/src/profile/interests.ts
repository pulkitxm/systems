import type { UserProfile } from "../types.js";

export function getCommonInterests(
  profile1: UserProfile,
  profile2: UserProfile
): string[] {
  const set1 = new Set(profile1.interests);
  return profile2.interests.filter((interest) => set1.has(interest));
}

export function calculateInterestScore(
  profile1: UserProfile,
  profile2: UserProfile
): number {
  const commonInterests = getCommonInterests(profile1, profile2);
  const totalUniqueInterests = new Set([
    ...profile1.interests,
    ...profile2.interests,
  ]).size;

  if (totalUniqueInterests === 0) {
    return 0;
  }

  return commonInterests.length / totalUniqueInterests;
}

export function isGenderMatch(
  profile1: UserProfile,
  profile2: UserProfile
): boolean {
  const profile1LookingForProfile2 = profile1.lookingFor.includes(
    profile2.gender
  );
  const profile2LookingForProfile1 = profile2.lookingFor.includes(
    profile1.gender
  );
  return profile1LookingForProfile2 && profile2LookingForProfile1;
}

export function calculateCompatibilityScore(
  profile1: UserProfile,
  profile2: UserProfile,
  distanceMeters: number,
  maxDistanceMeters: number
): number {
  if (!isGenderMatch(profile1, profile2)) {
    return 0;
  }

  const interestScore = calculateInterestScore(profile1, profile2);
  const distanceScore = Math.max(
    0,
    1 - distanceMeters / maxDistanceMeters
  );

  const interestWeight = 0.6;
  const distanceWeight = 0.4;

  return interestScore * interestWeight + distanceScore * distanceWeight;
}
