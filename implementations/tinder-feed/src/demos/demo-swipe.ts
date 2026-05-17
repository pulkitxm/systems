import { closeConnection } from "../connection.js";
import { profileStore } from "../profile/store.js";
import { feedDatabase } from "../feed/database.js";
import { feedGenerator } from "../feed/generator.js";
import { swipeHandler } from "../swipe/handler.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { header, subheader, formatDistance, sleep } from "../utils.js";

async function main() {
  header("Demo: Swiping Mechanics");

  const profileCount = await profileStore.countProfiles();
  if (profileCount === 0) {
    console.log("❌ No profiles found. Please run 'pnpm seed' first.");
    await closeConnection();
    return;
  }

  const demoUser = await profileStore.getProfile("demo-male");
  if (!demoUser) {
    console.log("❌ Demo user not found. Please run 'pnpm seed' first.");
    await closeConnection();
    return;
  }

  await feedDatabase.clearFeed("demo-male");
  await seenProfilesFilter.deleteFilter("demo-male");
  await seenProfilesFilter.initializeFilter("demo-male");

  subheader("1. Generating Fresh Feed");
  const feedItems = await feedGenerator.generateFeed({
    userId: "demo-male",
    count: 5,
    radiusKm: 50,
  });

  console.log(`Generated ${feedItems.length} profiles to swipe:\n`);
  for (const item of feedItems) {
    console.log(`  • ${item.candidateProfile.name}, ${item.candidateProfile.age}`);
    console.log(`    Distance: ${formatDistance(item.distance)}`);
    console.log(`    Common interests: ${item.commonInterests.join(", ") || "None"}`);
  }

  if (feedItems.length < 2) {
    console.log("\n❌ Not enough feed items to demo. Try running 'pnpm seed' again.");
    await closeConnection();
    return;
  }

  subheader("2. Swiping Left (Pass)");
  const passCandidate = feedItems[0];
  console.log(`Alex swipes LEFT on ${passCandidate.candidateProfile.name}...\n`);

  const leftResult = await swipeHandler.swipeLeft("demo-male", passCandidate.candidateId);
  await sleep(200);

  console.log(`  Result: ${leftResult.success ? "✓" : "✗"}`);
  console.log(`  Is Match: ${leftResult.isMatch ? "Yes" : "No"}`);

  const updatedPassItem = await feedDatabase.getFeedItem("demo-male", passCandidate.candidateId);
  console.log(`  Feed item updated:`);
  console.log(`    is_interested: ${updatedPassItem?.isInterested}`);
  console.log(`    swiped_at: ${updatedPassItem?.swipedAt ? new Date(updatedPassItem.swipedAt).toLocaleTimeString() : "null"}`);

  const seenAfterLeft = await seenProfilesFilter.hasSeen("demo-male", passCandidate.candidateId);
  console.log(`  Bloom filter: ${seenAfterLeft ? "Marked as seen" : "Not marked"}`);

  subheader("3. Swiping Right (Like)");
  const likeCandidate = feedItems[1];
  console.log(`Alex swipes RIGHT on ${likeCandidate.candidateProfile.name}...\n`);

  const rightResult = await swipeHandler.swipeRight("demo-male", likeCandidate.candidateId);
  await sleep(200);

  console.log(`  Result: ${rightResult.success ? "✓" : "✗"}`);
  console.log(`  Is Match: ${rightResult.isMatch ? "Yes 💕" : "No (waiting for mutual interest)"}`);

  const updatedLikeItem = await feedDatabase.getFeedItem("demo-male", likeCandidate.candidateId);
  console.log(`  Feed item updated:`);
  console.log(`    is_interested: ${updatedLikeItem?.isInterested}`);

  const seenAfterRight = await seenProfilesFilter.hasSeen("demo-male", likeCandidate.candidateId);
  console.log(`  Bloom filter: ${seenAfterRight ? "Marked as seen" : "Not marked"}`);

  subheader("4. Verifying Bloom Filter Prevents Re-showing");
  console.log("Attempting to regenerate feed...\n");

  const newFeedItems = await feedGenerator.generateFeed({
    userId: "demo-male",
    count: 5,
    radiusKm: 50,
  });

  const swipedIds = [passCandidate.candidateId, likeCandidate.candidateId];
  const reappeared = newFeedItems.filter((item) =>
    swipedIds.includes(item.candidateId)
  );

  if (reappeared.length === 0) {
    console.log("✅ Previously swiped profiles do NOT appear in new feed");
    console.log("   Bloom filter working correctly!");
  } else {
    console.log("❌ Some swiped profiles reappeared (shouldn't happen):");
    reappeared.forEach((item) =>
      console.log(`   - ${item.candidateProfile.name}`)
    );
  }

  subheader("5. Swipe History");
  const history = await swipeHandler.getSwipeHistory("demo-male");
  console.log(`Liked: ${history.liked.length} profiles`);
  console.log(`Passed: ${history.passed.length} profiles`);

  subheader("Key Takeaways");
  console.log("• Swipe updates feed database (is_interested field)");
  console.log("• Swipe adds to Bloom filter (BF.ADD)");
  console.log("• Feed generator checks Bloom filter before adding candidates");
  console.log("• Match detection checks if other user also swiped right");
  console.log("• All operations are atomic and fast");

  await closeConnection();
}

main().catch(console.error);
