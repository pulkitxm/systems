import { closeConnection } from "../connection.js";
import { profileStore } from "../profile/store.js";
import { locationTracker } from "../location/tracker.js";
import { feedGenerator } from "../feed/generator.js";
import { feedDatabase } from "../feed/database.js";
import { feedAPI } from "../feed/api.js";
import { header, subheader, formatDistance } from "../utils.js";

async function main() {
  header("Demo: Feed Generation");

  const profileCount = await profileStore.countProfiles();
  if (profileCount === 0) {
    console.log("❌ No profiles found. Please run 'pnpm seed' first.");
    await closeConnection();
    return;
  }

  console.log(`Found ${profileCount} profiles in database\n`);

  const demoUser = await profileStore.getProfile("demo-male");
  if (!demoUser) {
    console.log("❌ Demo user not found. Please run 'pnpm seed' first.");
    await closeConnection();
    return;
  }

  subheader("1. Demo User Profile");
  console.log(`Name: ${demoUser.name}`);
  console.log(`Age: ${demoUser.age}`);
  console.log(`Gender: ${demoUser.gender}`);
  console.log(`Looking for: ${demoUser.lookingFor.join(", ")}`);
  console.log(`Interests: ${demoUser.interests.join(", ")}`);

  const location = await locationTracker.getLocation("demo-male");
  if (location) {
    console.log(`Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
  }

  subheader("2. Finding Nearby Users");
  const radiusKm = 50;
  const nearbyUsers = await locationTracker.getNearbyUsers("demo-male", radiusKm, 10);
  console.log(`Found ${nearbyUsers.length} users within ${radiusKm}km\n`);

  for (const nearby of nearbyUsers.slice(0, 5)) {
    const profile = await profileStore.getProfile(nearby.userId);
    if (profile) {
      console.log(`  • ${profile.name}, ${profile.age} (${profile.gender})`);
      console.log(`    Distance: ${formatDistance(nearby.distance)}`);
      console.log(`    Interests: ${profile.interests.slice(0, 3).join(", ")}...`);
    }
  }

  subheader("3. Generating Feed");
  console.log("Feed generation considers:");
  console.log("  1. Proximity (closer = higher score)");
  console.log("  2. Common interests (more = higher score)");
  console.log("  3. Gender preferences (must match)");
  console.log("  4. Bloom filter (not seen before)\n");

  await feedDatabase.clearFeed("demo-male");

  const feedItems = await feedGenerator.generateFeed({
    userId: "demo-male",
    count: 5,
    radiusKm: 50,
  });

  console.log(`Generated ${feedItems.length} feed items:\n`);

  for (const item of feedItems) {
    const profile = item.candidateProfile;
    console.log(`  ${profile.name}, ${profile.age}`);
    console.log(`    Distance: ${formatDistance(item.distance)}`);
    console.log(`    Common interests: ${item.commonInterests.join(", ") || "None"}`);
    console.log(`    Compatibility score: ${(item.score * 100).toFixed(1)}%`);
    console.log("");
  }

  subheader("4. Feed API - Get Next Profile");
  const nextProfile = await feedAPI.getNextProfile("demo-male");
  if (nextProfile) {
    console.log("Next profile to show:");
    console.log(`  ${nextProfile.candidateProfile.name}, ${nextProfile.candidateProfile.age}`);
    console.log(`  Bio: ${nextProfile.candidateProfile.bio}`);
  }

  subheader("5. Feed Stats");
  const stats = await feedAPI.getFeedStats("demo-male");
  console.log(`Total in feed: ${stats.total}`);
  console.log(`Unswiped: ${stats.unswiped}`);
  console.log(`Liked: ${stats.liked}`);
  console.log(`Passed: ${stats.passed}`);

  subheader("Key Takeaways");
  console.log("• Feed is generated on-demand when user's feed is exhausted");
  console.log("• Candidates are scored by: 60% interest match + 40% proximity");
  console.log("• Bloom filter prevents showing already-swiped profiles");
  console.log("• Feed items stored separately (not as a list) for scalability");
  console.log("• Each feed item: ~500 bytes (with embedded profile)");

  await closeConnection();
}

main().catch(console.error);
