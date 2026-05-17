import { closeConnection } from "../connection.js";
import { locationTracker } from "../location/tracker.js";
import { header, subheader, formatDistance, sleep } from "../utils.js";

async function main() {
  header("Demo: Location Tracking with Redis Geospatial");

  subheader("1. Adding User Locations (GEOADD)");
  console.log("Simulating location updates from user devices...\n");

  const locations = [
    { id: "user-a", name: "Alice", lat: 37.7749, lng: -122.4194, desc: "Downtown SF" },
    { id: "user-b", name: "Bob", lat: 37.7849, lng: -122.4094, desc: "North Beach" },
    { id: "user-c", name: "Carol", lat: 37.7649, lng: -122.4294, desc: "Mission" },
    { id: "user-d", name: "Dave", lat: 37.3688, lng: -122.0322, desc: "San Jose" },
    { id: "user-e", name: "Eve", lat: 37.7799, lng: -122.4144, desc: "Chinatown" },
  ];

  for (const loc of locations) {
    await locationTracker.updateLocation(loc.id, {
      latitude: loc.lat,
      longitude: loc.lng,
    });
    console.log(`  📍 ${loc.name} (${loc.id}): ${loc.desc}`);
    console.log(`     Coordinates: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`);
    await sleep(100);
  }

  subheader("2. Getting User Location (GEOPOS)");
  const aliceLocation = await locationTracker.getLocation("user-a");
  if (aliceLocation) {
    console.log("Alice's location:");
    console.log(`  Latitude:  ${aliceLocation.latitude.toFixed(6)}`);
    console.log(`  Longitude: ${aliceLocation.longitude.toFixed(6)}`);
  }

  subheader("3. Finding Distance Between Users (GEODIST)");
  const distances = [
    ["user-a", "user-b", "Alice", "Bob"],
    ["user-a", "user-c", "Alice", "Carol"],
    ["user-a", "user-d", "Alice", "Dave"],
    ["user-a", "user-e", "Alice", "Eve"],
  ];

  for (const [id1, id2, name1, name2] of distances) {
    const dist = await locationTracker.getDistanceBetween(id1, id2);
    if (dist !== null) {
      console.log(`  ${name1} ↔ ${name2}: ${formatDistance(dist)}`);
    }
  }

  subheader("4. Finding Nearby Users (GEORADIUS)");

  console.log("Users within 5km of Alice:\n");
  const nearby5km = await locationTracker.getNearbyUsers("user-a", 5);
  if (nearby5km.length === 0) {
    console.log("  No users found within 5km");
  } else {
    for (const user of nearby5km) {
      const loc = locations.find((l) => l.id === user.userId);
      console.log(`  • ${loc?.name || user.userId}: ${formatDistance(user.distance)}`);
    }
  }

  console.log("\nUsers within 100km of Alice:\n");
  const nearby100km = await locationTracker.getNearbyUsers("user-a", 100);
  for (const user of nearby100km) {
    const loc = locations.find((l) => l.id === user.userId);
    console.log(`  • ${loc?.name || user.userId}: ${formatDistance(user.distance)}`);
  }

  subheader("5. Simulating Location Update");
  console.log("Bob moves closer to Alice...\n");

  const oldBobLocation = await locationTracker.getLocation("user-b");
  await locationTracker.updateLocation("user-b", {
    latitude: 37.7759,
    longitude: -122.4184,
  });
  const newBobLocation = await locationTracker.getLocation("user-b");

  console.log("Bob's location before:");
  console.log(`  ${oldBobLocation?.latitude.toFixed(4)}, ${oldBobLocation?.longitude.toFixed(4)}`);
  console.log("Bob's location after:");
  console.log(`  ${newBobLocation?.latitude.toFixed(4)}, ${newBobLocation?.longitude.toFixed(4)}`);

  const newDistance = await locationTracker.getDistanceBetween("user-a", "user-b");
  console.log(`\nNew distance Alice ↔ Bob: ${formatDistance(newDistance!)}`);

  subheader("Key Takeaways");
  console.log("• GEOADD stores lat/long with a member ID in a sorted set");
  console.log("• GEOPOS retrieves coordinates for a member");
  console.log("• GEODIST calculates distance between two members");
  console.log("• GEORADIUS finds all members within a radius");
  console.log("• Updates are O(log N) - same key = same member, coordinates updated");
  console.log("\nData size: ~12 bytes per user (userId + lat + long)");
  console.log("50M users × 12 bytes = 600 MB - Data is NOT the problem!");
  console.log("The problem is QUERY LOAD from continuous location updates.");

  for (const loc of locations) {
    await locationTracker.removeLocation(loc.id);
  }

  await closeConnection();
}

main().catch(console.error);
