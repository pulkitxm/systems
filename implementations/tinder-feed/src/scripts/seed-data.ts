import { v4 as uuidv4 } from "uuid";
import { closeConnection } from "../connection.js";
import { profileStore } from "../profile/store.js";
import { locationTracker } from "../location/tracker.js";
import { seenProfilesFilter } from "../bloom/seen.js";
import { header, subheader, randomElements, randomInt } from "../utils.js";
import { INTEREST_CATEGORIES, type UserProfile, type Location } from "../types.js";

const SF_CENTER = { lat: 37.7749, lng: -122.4194 };
const RADIUS_KM = 25;

const FIRST_NAMES_MALE = [
  "James", "Michael", "David", "John", "Robert", "William", "Richard", "Joseph",
  "Thomas", "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Steven",
  "Andrew", "Paul", "Joshua", "Kevin", "Brian", "Ryan", "Justin", "Brandon",
  "Tyler", "Jason", "Aaron", "Adam", "Nathan", "Eric", "Kyle",
];

const FIRST_NAMES_FEMALE = [
  "Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Charlotte", "Amelia",
  "Harper", "Evelyn", "Abigail", "Emily", "Elizabeth", "Sofia", "Avery",
  "Ella", "Scarlett", "Grace", "Victoria", "Riley", "Aria", "Lily", "Chloe",
  "Zoey", "Hannah", "Layla", "Natalie", "Luna", "Savannah", "Brooklyn",
];

const BIOS = [
  "Love exploring new coffee shops and hiking trails ☕🏔️",
  "Software engineer by day, musician by night 🎸",
  "Foodie | Travel enthusiast | Dog parent 🐕",
  "Looking for someone to share adventures with",
  "Just moved here! Show me around? 🌉",
  "Gym, brunch, repeat 💪🥞",
  "Book lover | Wine enthusiast | Cat person 🐱📚",
  "Work hard, travel harder ✈️",
  "Passionate about photography and good conversations",
  "Let's grab coffee and see where it goes ☕",
  "Music festival veteran 🎶",
  "Weekend warrior | Sports fan | Craft beer lover 🍺",
  "Looking for my partner in crime",
  "Yoga, meditation, and good vibes only 🧘",
  "Tech startup life | Always learning something new",
];

function generateRandomLocation(
  center: { lat: number; lng: number },
  radiusKm: number
): Location {
  const radiusInDegrees = radiusKm / 111;
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.sqrt(Math.random()) * radiusInDegrees;

  return {
    latitude: center.lat + distance * Math.cos(angle),
    longitude: center.lng + distance * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180),
  };
}

function generateProfile(
  id: string,
  gender: "male" | "female"
): UserProfile {
  const names = gender === "male" ? FIRST_NAMES_MALE : FIRST_NAMES_FEMALE;
  const name = names[randomInt(0, names.length - 1)];
  const age = randomInt(22, 45);
  const interests = randomElements([...INTEREST_CATEGORIES], randomInt(3, 7));
  const bio = BIOS[randomInt(0, BIOS.length - 1)];

  const lookingFor: ("male" | "female" | "other")[] = [];
  if (Math.random() > 0.15) {
    lookingFor.push(gender === "male" ? "female" : "male");
  }
  if (Math.random() > 0.85) {
    lookingFor.push(gender);
  }
  if (lookingFor.length === 0) {
    lookingFor.push(gender === "male" ? "female" : "male");
  }

  return {
    id,
    name,
    age,
    bio,
    interests,
    photos: [`https://randomuser.me/api/portraits/${gender === "male" ? "men" : "women"}/${randomInt(1, 99)}.jpg`],
    gender,
    lookingFor,
    lastActive: Date.now() - randomInt(0, 24 * 60 * 60 * 1000),
    createdAt: Date.now() - randomInt(1, 365) * 24 * 60 * 60 * 1000,
  };
}

async function main() {
  header("Tinder Feed - Seed Data");

  const existingCount = await profileStore.countProfiles();
  if (existingCount > 0) {
    console.log(`Found ${existingCount} existing profiles.`);
    console.log("Run 'pnpm reset' first if you want to start fresh.\n");
  }

  subheader("Creating Sample Users");

  const userCount = 50;
  const maleCount = Math.floor(userCount * 0.5);
  const femaleCount = userCount - maleCount;

  const users: { profile: UserProfile; location: Location }[] = [];

  console.log(`Creating ${maleCount} male profiles...`);
  for (let i = 0; i < maleCount; i++) {
    const profile = generateProfile(uuidv4(), "male");
    const location = generateRandomLocation(SF_CENTER, RADIUS_KM);
    users.push({ profile, location });
  }

  console.log(`Creating ${femaleCount} female profiles...`);
  for (let i = 0; i < femaleCount; i++) {
    const profile = generateProfile(uuidv4(), "female");
    const location = generateRandomLocation(SF_CENTER, RADIUS_KM);
    users.push({ profile, location });
  }

  subheader("Saving to Database");

  for (const { profile, location } of users) {
    await profileStore.createProfile(profile);
    await locationTracker.updateLocation(profile.id, location);
    await seenProfilesFilter.initializeFilter(profile.id);
  }

  console.log(`✅ Created ${users.length} user profiles`);

  subheader("Sample Users");

  const sampleUsers = users.slice(0, 5);
  for (const { profile, location } of sampleUsers) {
    console.log(`\n${profile.name}, ${profile.age} (${profile.gender})`);
    console.log(`  ID: ${profile.id}`);
    console.log(`  Interests: ${profile.interests.join(", ")}`);
    console.log(`  Looking for: ${profile.lookingFor.join(", ")}`);
    console.log(`  Location: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
  }

  subheader("Demo Users (for testing)");

  const demoMale = generateProfile("demo-male", "male");
  demoMale.name = "Alex";
  demoMale.interests = ["Music", "Travel", "Coffee", "Hiking", "Photography"];
  demoMale.lookingFor = ["female"];
  await profileStore.createProfile(demoMale);
  await locationTracker.updateLocation("demo-male", {
    latitude: SF_CENTER.lat,
    longitude: SF_CENTER.lng,
  });
  await seenProfilesFilter.initializeFilter("demo-male");

  const demoFemale = generateProfile("demo-female", "female");
  demoFemale.name = "Sarah";
  demoFemale.interests = ["Music", "Travel", "Yoga", "Cooking", "Art"];
  demoFemale.lookingFor = ["male"];
  await profileStore.createProfile(demoFemale);
  await locationTracker.updateLocation("demo-female", {
    latitude: SF_CENTER.lat + 0.01,
    longitude: SF_CENTER.lng + 0.01,
  });
  await seenProfilesFilter.initializeFilter("demo-female");

  console.log("\nDemo users created:");
  console.log(`  demo-male (Alex): Looking for female, interests: ${demoMale.interests.join(", ")}`);
  console.log(`  demo-female (Sarah): Looking for male, interests: ${demoFemale.interests.join(", ")}`);

  console.log("\n" + "=".repeat(60));
  console.log("✅ Seeding complete!");
  console.log(`\nTotal profiles: ${await profileStore.countProfiles()}`);
  console.log(`Total locations: ${await locationTracker.countUsers()}`);
  console.log("\nNext: Run 'pnpm demo:all' to see the system in action");

  await closeConnection();
}

main().catch(console.error);
