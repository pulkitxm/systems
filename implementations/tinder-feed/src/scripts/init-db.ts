import { redis, closeConnection } from "../connection.js";
import { header, subheader } from "../utils.js";

async function checkRedisStackModules(): Promise<boolean> {
  try {
    const modules = (await redis.call("MODULE", "LIST")) as Array<
      Array<string | number>
    >;
    const moduleNames = modules.map((m) => m[1] as string);

    console.log("Installed Redis modules:");
    moduleNames.forEach((name) => console.log(`  - ${name}`));

    const hasBloom = moduleNames.some(
      (name) =>
        name.toLowerCase().includes("bf") ||
        name.toLowerCase().includes("bloom")
    );

    if (!hasBloom) {
      console.error("\n❌ RedisBloom module not found!");
      console.error(
        "   Please use Redis Stack: docker-compose up -d"
      );
      return false;
    }

    console.log("\n✅ RedisBloom module available");
    return true;
  } catch {
    console.error("Failed to check Redis modules");
    return false;
  }
}

async function testBloomFilter(): Promise<boolean> {
  const testKey = "tinder:test:bloom";
  try {
    await redis.del(testKey);
    await redis.call("BF.RESERVE", testKey, 0.01, 100);
    await redis.call("BF.ADD", testKey, "test-item");
    const exists = await redis.call("BF.EXISTS", testKey, "test-item");
    await redis.del(testKey);

    if (exists === 1) {
      console.log("✅ Bloom filter operations working");
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Bloom filter test failed:", error);
    return false;
  }
}

async function testGeoCommands(): Promise<boolean> {
  const testKey = "tinder:test:geo";
  try {
    await redis.del(testKey);
    await redis.geoadd(testKey, -122.4194, 37.7749, "sf");
    await redis.geoadd(testKey, -122.0322, 37.3688, "sj");

    const distance = await (redis as any).geodist(testKey, "sf", "sj", "km");
    await redis.del(testKey);

    if (distance && parseFloat(distance) > 0) {
      console.log(
        `✅ Geospatial operations working (SF to SJ: ${parseFloat(distance).toFixed(1)}km)`
      );
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Geo commands test failed:", error);
    return false;
  }
}

async function main() {
  header("Tinder Feed - Database Initialization");

  subheader("Checking Redis Connection");
  try {
    const pong = await redis.ping();
    console.log(`Redis connection: ${pong === "PONG" ? "✅ OK" : "❌ Failed"}`);
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
    console.error("\nMake sure Redis is running: docker-compose up -d");
    process.exit(1);
  }

  subheader("Checking Redis Stack Modules");
  const hasModules = await checkRedisStackModules();
  if (!hasModules) {
    process.exit(1);
  }

  subheader("Testing Bloom Filter");
  const bloomOk = await testBloomFilter();

  subheader("Testing Geospatial Commands");
  const geoOk = await testGeoCommands();

  console.log("\n" + "=".repeat(60));
  if (bloomOk && geoOk) {
    console.log("✅ All checks passed! Database is ready.");
    console.log("\nNext steps:");
    console.log("  1. Run: pnpm seed");
    console.log("  2. Run: pnpm demo:all");
  } else {
    console.log("❌ Some checks failed. Please fix the issues above.");
    process.exit(1);
  }

  await closeConnection();
}

main().catch(console.error);
