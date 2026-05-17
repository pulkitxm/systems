import { closeConnection } from "../connection.js";
import { profileStore } from "../profile/store.js";
import { locationTracker } from "../location/tracker.js";
import { feedGenerator } from "../feed/generator.js";
import { feedDatabase } from "../feed/database.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { swipeHandler } from "../swipe/handler.js";
import { matchStore } from "../match/store.js";
import { header, subheader, formatDistance, sleep } from "../utils.js";

async function main() {
  header("Tinder Feed System - Complete Walkthrough");

  console.log("This demo walks through the entire Tinder feed system:");
  console.log("  1. Location tracking with Redis geospatial");
  console.log("  2. Profile storage and interest matching");
  console.log("  3. Feed generation based on proximity + interests");
  console.log("  4. Bloom filter for seen profiles");
  console.log("  5. Swiping mechanics");
  console.log("  6. Match detection");
  await sleep(1000);

  const profileCount = await profileStore.countProfiles();
  if (profileCount === 0) {
    console.log("\n❌ No profiles found. Please run:");
    console.log("   pnpm seed");
    await closeConnection();
    return;
  }

  subheader("Step 1: Location Tracking");
  console.log("Users continuously emit location to our backend...\n");

  const locationCount = await locationTracker.countUsers();
  console.log(`  📍 ${locationCount} users with tracked locations`);

  const demoLocation = await locationTracker.getLocation("demo-male");
  if (demoLocation) {
    console.log(`  Demo user location: ${demoLocation.latitude.toFixed(4)}, ${demoLocation.longitude.toFixed(4)}`);
  }

  const nearbyUsers = await locationTracker.getNearbyUsers("demo-male", 50, 5);
  console.log(`  Found ${nearbyUsers.length} users within 50km`);

  subheader("Step 2: Profile & Interest Storage");

  const demoMale = await profileStore.getProfile("demo-male");
  const demoFemale = await profileStore.getProfile("demo-female");

  if (!demoMale || !demoFemale) {
    console.log("❌ Demo users not found. Please run 'pnpm seed'.");
    await closeConnection();
    return;
  }

  console.log("Demo users:\n");
  console.log(`  Alex (demo-male):`);
  console.log(`    Interests: ${demoMale.interests.join(", ")}`);
  console.log(`    Looking for: ${demoMale.lookingFor.join(", ")}`);
  console.log(`\n  Sarah (demo-female):`);
  console.log(`    Interests: ${demoFemale.interests.join(", ")}`);
  console.log(`    Looking for: ${demoFemale.lookingFor.join(", ")}`);

  const commonInterests = demoMale.interests.filter((i) =>
    demoFemale.interests.includes(i)
  );
  console.log(`\n  Common interests: ${commonInterests.join(", ")}`);

  subheader("Step 3: Feed Generation");
  console.log("Clearing old feed and generating fresh one...\n");

  await feedDatabase.clearFeed("demo-male");
  await seenProfilesFilter.deleteFilter("demo-male");
  await seenProfilesFilter.initializeFilter("demo-male");

  const feedItems = await feedGenerator.generateFeed({
    userId: "demo-male",
    count: 5,
    radiusKm: 50,
  });

  console.log(`Generated ${feedItems.length} candidates for Alex's feed:\n`);

  for (let i = 0; i < Math.min(3, feedItems.length); i++) {
    const item = feedItems[i];
    console.log(`  ${i + 1}. ${item.candidateProfile.name}, ${item.candidateProfile.age}`);
    console.log(`     Distance: ${formatDistance(item.distance)}`);
    console.log(`     Common interests: ${item.commonInterests.join(", ") || "None"}`);
    console.log(`     Score: ${(item.score * 100).toFixed(1)}%`);
  }

  subheader("Step 4: Bloom Filter Demo");
  console.log("Bloom filter tracks which profiles user has seen...\n");

  const bloomInfo = await seenProfilesFilter.getFilterInfo("demo-male");
  if (bloomInfo) {
    console.log(`  Filter size: ${bloomInfo.size} bytes`);
    console.log(`  Capacity: ${bloomInfo.capacity} items`);
  }

  if (feedItems.length > 0) {
    const testCandidate = feedItems[0].candidateId;
    const beforeSeen = await seenProfilesFilter.hasSeen("demo-male", testCandidate);
    console.log(`\n  Before marking: ${beforeSeen ? "seen" : "not seen"}`);

    await seenProfilesFilter.markAsSeen("demo-male", testCandidate);
    const afterSeen = await seenProfilesFilter.hasSeen("demo-male", testCandidate);
    console.log(`  After marking:  ${afterSeen ? "seen" : "not seen"}`);
  }

  subheader("Step 5: Swiping Demo");
  console.log("Setting up mutual swipe scenario...\n");

  await feedDatabase.clearFeed("demo-male");
  await feedDatabase.clearFeed("demo-female");
  await seenProfilesFilter.deleteFilter("demo-male");
  await seenProfilesFilter.deleteFilter("demo-female");
  await seenProfilesFilter.initializeFilter("demo-male");
  await seenProfilesFilter.initializeFilter("demo-female");

  const existingMatch = await matchStore.getMatchBetweenUsers("demo-male", "demo-female");
  if (existingMatch) {
    await matchStore.deleteMatch(existingMatch.id);
  }

  await feedDatabase.addFeedItem("demo-male", demoFemale, 0.85, 1500, commonInterests);
  await feedDatabase.addFeedItem("demo-female", demoMale, 0.85, 1500, commonInterests);

  console.log("  Alex swipes RIGHT on Sarah...");
  const result1 = await swipeHandler.swipeRight("demo-male", "demo-female");
  console.log(`    Match: ${result1.isMatch ? "Yes" : "No (waiting for Sarah)"}`);
  await sleep(300);

  console.log("\n  Sarah swipes RIGHT on Alex...");
  const result2 = await swipeHandler.swipeRight("demo-female", "demo-male");
  console.log(`    Match: ${result2.isMatch ? "Yes 💕" : "No"}`);

  subheader("Step 6: Match Created");

  if (result2.matchId) {
    const match = await matchStore.getMatch(result2.matchId);
    console.log(`  🎉 IT'S A MATCH! 🎉\n`);
    console.log(`  Match ID: ${match?.id}`);
    console.log(`  Between: ${match?.userA} ↔ ${match?.userB}`);
    console.log(`  Created: ${new Date(match?.createdAt || 0).toLocaleString()}`);
    console.log("\n  This match ID can now be used for:");
    console.log("    • Opening a chat conversation");
    console.log("    • Sending super likes / gifts");
    console.log("    • Any post-match features");
  }

  header("System Summary");

  console.log("Components used:\n");
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log("  │                     TINDER FEED SYSTEM                  │");
  console.log("  └─────────────────────────────────────────────────────────┘");
  console.log("");
  console.log("  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐");
  console.log("  │   Location   │    │   Profile    │    │    Bloom     │");
  console.log("  │   Tracker    │    │    Store     │    │   Filter     │");
  console.log("  │  (Redis GEO) │    │ (Redis JSON) │    │ (RedisBloom) │");
  console.log("  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘");
  console.log("         │                   │                   │");
  console.log("         └───────────────────┼───────────────────┘");
  console.log("                             │");
  console.log("                             ▼");
  console.log("                   ┌──────────────────┐");
  console.log("                   │  Feed Generator  │");
  console.log("                   │  (Async Queue)   │");
  console.log("                   └────────┬─────────┘");
  console.log("                            │");
  console.log("                            ▼");
  console.log("                   ┌──────────────────┐");
  console.log("                   │  Feed Database   │");
  console.log("                   │ (Redis Sorted)   │");
  console.log("                   └────────┬─────────┘");
  console.log("                            │");
  console.log("                            ▼");
  console.log("                   ┌──────────────────┐");
  console.log("                   │ Swipe Handler    │");
  console.log("                   │ + Match Store    │");
  console.log("                   └──────────────────┘");

  console.log("\n\nKey learnings:\n");
  console.log("  1. Data size is NOT the problem (600MB for 50M users)");
  console.log("     → Query load is the problem → need sharding");
  console.log("");
  console.log("  2. Bloom filters for 'definitely not seen'");
  console.log("     → False positives OK (skip some matches)");
  console.log("     → False negatives NOT OK (show swiped profiles)");
  console.log("");
  console.log("  3. Feed items stored separately, not as a list");
  console.log("     → Avoids document size limits");
  console.log("     → Easy to shard by user_id");
  console.log("");
  console.log("  4. Async feed generation via queue");
  console.log("     → Non-blocking for user");
  console.log("     → Scalable with more workers");
  console.log("");
  console.log("  5. Match = bidirectional interest check");
  console.log("     → Simple feed DB lookup");
  console.log("     → Match ID for messaging service");

  await closeConnection();
}

main().catch(console.error);
