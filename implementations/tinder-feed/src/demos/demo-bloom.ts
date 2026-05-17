import { closeConnection } from "../connection.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { header, subheader, sleep } from "../utils.js";

async function main() {
  header("Demo: Bloom Filter for Seen Profiles");

  const testUserId = "bloom-demo-user";

  await seenProfilesFilter.deleteFilter(testUserId);

  subheader("1. Understanding the Problem");
  console.log("Without deduplication:");
  console.log("  • User swipes profile → should never see again");
  console.log("  • Naive approach: Store (user, seen_user) pairs in DB");
  console.log("  • Problem: Storage explodes with N×M pairs");
  console.log("");
  console.log("Example math:");
  console.log("  • 50M users, each swipes 10,000 profiles");
  console.log("  • 50M × 10K = 500 billion pairs");
  console.log("  • At 8 bytes per pair = 4 TB of storage!");

  subheader("2. Bloom Filter Solution");
  console.log("Bloom filters give us:");
  console.log("  • 'Definitely NOT seen' - 100% certain");
  console.log("  • 'Might have seen' - could be false positive");
  console.log("");
  console.log("For Tinder feed:");
  console.log("  • False positive = skip a potential match (acceptable)");
  console.log("  • False negative = show already-swiped (NOT acceptable)");
  console.log("  • Bloom filters guarantee NO false negatives!");

  subheader("3. Initializing Filter");
  await seenProfilesFilter.initializeFilter(testUserId);
  console.log("Created Bloom filter for user with:");
  console.log("  • Error rate: 1%");
  console.log("  • Capacity: 10,000 items");

  const info = await seenProfilesFilter.getFilterInfo(testUserId);
  if (info) {
    console.log(`  • Size: ${info.size} bytes (~${(info.size / 1024).toFixed(1)} KB)`);
  }

  subheader("4. Adding Seen Profiles (BF.ADD)");
  const seenProfiles = [
    "profile-001",
    "profile-002",
    "profile-003",
    "profile-004",
    "profile-005",
  ];

  for (const profileId of seenProfiles) {
    await seenProfilesFilter.markAsSeen(testUserId, profileId);
    console.log(`  ✓ Marked as seen: ${profileId}`);
    await sleep(50);
  }

  subheader("5. Checking Profiles (BF.EXISTS)");
  const profilesToCheck = [
    "profile-001",
    "profile-003",
    "profile-005",
    "profile-006",
    "profile-007",
    "profile-999",
  ];

  console.log("Checking if profiles have been seen:\n");
  for (const profileId of profilesToCheck) {
    const hasSeen = await seenProfilesFilter.hasSeen(testUserId, profileId);
    const wasActuallySeen = seenProfiles.includes(profileId);
    const icon = hasSeen ? "⛔" : "✅";
    const status = hasSeen ? "SEEN (skip)" : "NOT SEEN (show)";
    const accuracy = hasSeen === wasActuallySeen ? "" : " [FALSE POSITIVE]";
    console.log(`  ${icon} ${profileId}: ${status}${accuracy}`);
  }

  subheader("6. Batch Check (BF.MEXISTS)");
  const batchProfiles = ["profile-001", "profile-006", "profile-002", "profile-008"];
  const batchResults = await seenProfilesFilter.hasSeenMany(testUserId, batchProfiles);

  console.log("Checking multiple profiles at once:\n");
  for (const [profileId, hasSeen] of batchResults) {
    const icon = hasSeen ? "⛔" : "✅";
    console.log(`  ${icon} ${profileId}: ${hasSeen ? "SEEN" : "NOT SEEN"}`);
  }

  subheader("7. Integration with Feed Generator");
  console.log("When generating feed:");
  console.log("  1. Get nearby users from GEORADIUS");
  console.log("  2. Batch check with BF.MEXISTS");
  console.log("  3. Filter out seen profiles");
  console.log("  4. Score remaining candidates");
  console.log("  5. Add to feed database");
  console.log("");
  console.log("When user swipes:");
  console.log("  1. Update feed database (is_interested)");
  console.log("  2. BF.ADD to mark as seen");
  console.log("  → Profile will never appear in feed again");

  subheader("8. Storage Comparison");
  const updatedInfo = await seenProfilesFilter.getFilterInfo(testUserId);
  console.log("Bloom filter (10K capacity, 1% error rate):");
  console.log(`  • Size: ${updatedInfo?.size || 0} bytes`);
  console.log("");
  console.log("Naive approach (storing pairs):");
  console.log("  • 10K profiles × 8 bytes = 80 KB per user");
  console.log("");
  console.log("At scale (50M users):");
  console.log("  • Bloom: 50M × ~12KB = 600 GB");
  console.log("  • Naive: 50M × 80KB = 4 TB");
  console.log("  → 6.5x storage reduction!");

  subheader("Key Takeaways");
  console.log("• Bloom filters trade accuracy for space efficiency");
  console.log("• No false negatives = already-swiped never shown again");
  console.log("• False positives = skip some unseen profiles (OK for Tinder)");
  console.log("• Redis BF.* commands are atomic and fast");
  console.log("• Can be sharded by user ID for horizontal scaling");

  await seenProfilesFilter.deleteFilter(testUserId);
  await closeConnection();
}

main().catch(console.error);
