import { closeConnection } from "../connection.js";
import { profileStore } from "../profile/store.js";
import { feedDatabase } from "../feed/database.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { swipeHandler } from "../swipe/handler.js";
import { matchStore } from "../match/store.js";
import { header, subheader, sleep } from "../utils.js";
import type { UserProfile } from "../types.js";

async function main() {
  header("Demo: Match Detection");

  const demoMale = await profileStore.getProfile("demo-male");
  const demoFemale = await profileStore.getProfile("demo-female");

  if (!demoMale || !demoFemale) {
    console.log("❌ Demo users not found. Please run 'pnpm seed' first.");
    await closeConnection();
    return;
  }

  subheader("1. Setup: Two Demo Users");
  console.log("Alex (demo-male):");
  console.log(`  Interests: ${demoMale.interests.join(", ")}`);
  console.log(`  Looking for: ${demoMale.lookingFor.join(", ")}`);
  console.log("");
  console.log("Sarah (demo-female):");
  console.log(`  Interests: ${demoFemale.interests.join(", ")}`);
  console.log(`  Looking for: ${demoFemale.lookingFor.join(", ")}`);

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

  subheader("2. Adding Users to Each Other's Feed");

  await feedDatabase.addFeedItem(
    "demo-male",
    demoFemale,
    0.85,
    1500,
    ["Music", "Travel"]
  );
  console.log("✓ Sarah added to Alex's feed");

  await feedDatabase.addFeedItem(
    "demo-female",
    demoMale,
    0.85,
    1500,
    ["Music", "Travel"]
  );
  console.log("✓ Alex added to Sarah's feed");

  subheader("3. Alex Swipes Right on Sarah");
  console.log("Alex sees Sarah's profile and swipes RIGHT...\n");
  await sleep(500);

  const alexSwipe = await swipeHandler.swipeRight("demo-male", "demo-female");

  console.log(`  Swipe recorded: ✓`);
  console.log(`  Is match: ${alexSwipe.isMatch ? "Yes 💕" : "No"}`);

  if (!alexSwipe.isMatch) {
    console.log("\n  Why no match yet?");
    console.log("  → Sarah hasn't swiped on Alex yet!");
    console.log("  → Match only happens when BOTH swipe right");
  }

  const alexFeedItem = await feedDatabase.getFeedItem("demo-male", "demo-female");
  console.log(`\n  Alex's feed entry for Sarah:`);
  console.log(`    is_interested: ${alexFeedItem?.isInterested}`);

  subheader("4. Sarah Swipes Right on Alex");
  console.log("Sarah sees Alex's profile and swipes RIGHT...\n");
  await sleep(500);

  const sarahSwipe = await swipeHandler.swipeRight("demo-female", "demo-male");

  console.log(`  Swipe recorded: ✓`);
  console.log(`  Is match: ${sarahSwipe.isMatch ? "Yes 💕" : "No"}`);

  if (sarahSwipe.isMatch) {
    console.log(`\n  🎉 IT'S A MATCH! 🎉`);
    console.log(`  Match ID: ${sarahSwipe.matchId}`);
  }

  subheader("5. Match Details");
  if (sarahSwipe.matchId) {
    const match = await matchStore.getMatch(sarahSwipe.matchId);
    if (match) {
      console.log(`Match ID: ${match.id}`);
      console.log(`User A: ${match.userA}`);
      console.log(`User B: ${match.userB}`);
      console.log(`Created: ${new Date(match.createdAt).toLocaleString()}`);
      console.log("");
      console.log("This match ID can be used for:");
      console.log("  • Starting a chat conversation");
      console.log("  • Sending super likes / gifts");
      console.log("  • Scheduling a date");
    }
  }

  subheader("6. User Match Lists");
  const alexMatches = await matchStore.getMatchesForUser("demo-male");
  const sarahMatches = await matchStore.getMatchesForUser("demo-female");

  console.log(`Alex's matches: ${alexMatches.length}`);
  for (const match of alexMatches) {
    const otherId = match.userA === "demo-male" ? match.userB : match.userA;
    const otherProfile = await profileStore.getProfile(otherId);
    console.log(`  • ${otherProfile?.name || otherId}`);
  }

  console.log(`\nSarah's matches: ${sarahMatches.length}`);
  for (const match of sarahMatches) {
    const otherId = match.userA === "demo-female" ? match.userB : match.userA;
    const otherProfile = await profileStore.getProfile(otherId);
    console.log(`  • ${otherProfile?.name || otherId}`);
  }

  subheader("7. Match Flow Diagram");
  console.log(`
  ┌─────────┐                              ┌─────────┐
  │  Alex   │                              │  Sarah  │
  └────┬────┘                              └────┬────┘
       │                                        │
       │ Swipe RIGHT on Sarah                   │
       ├───────────────────────────────────────▶│
       │                                        │
       │ Check: Does Sarah like Alex?           │
       │ → No entry or is_interested=null       │
       │ → No match yet                         │
       │                                        │
       │                     Swipe RIGHT on Alex│
       │◀───────────────────────────────────────┤
       │                                        │
       │          Check: Does Alex like Sarah?  │
       │          → is_interested=true ✓        │
       │          → CREATE MATCH! 💕            │
       │                                        │
       │◀──────── Match Notification ──────────▶│
       │                                        │
`);

  subheader("Key Takeaways");
  console.log("• Match happens when BOTH users swipe right on each other");
  console.log("• Order doesn't matter - whoever swipes second triggers the match");
  console.log("• Match check is just a feed DB lookup (is_interested field)");
  console.log("• Match ID is unique identifier for the pair");
  console.log("• Match can be used to initialize chat, send gifts, etc.");

  await closeConnection();
}

main().catch(console.error);
