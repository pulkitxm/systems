import { redis, KEYS } from "../connection.js";
import type { Location, NearbyUser } from "../types.js";

export class LocationTracker {
  async updateLocation(userId: string, location: Location): Promise<void> {
    await redis.geoadd(
      KEYS.LOCATIONS,
      location.longitude,
      location.latitude,
      userId
    );
  }

  async getLocation(userId: string): Promise<Location | null> {
    const result = await redis.geopos(KEYS.LOCATIONS, userId);
    if (!result || !result[0]) {
      return null;
    }
    const [longitude, latitude] = result[0];
    return {
      longitude: parseFloat(longitude!),
      latitude: parseFloat(latitude!),
    };
  }

  async getNearbyUsers(
    userId: string,
    radiusKm: number,
    count: number = 50
  ): Promise<NearbyUser[]> {
    const location = await this.getLocation(userId);
    if (!location) {
      return [];
    }

    const results = await redis.georadius(
      KEYS.LOCATIONS,
      location.longitude,
      location.latitude,
      radiusKm,
      "km",
      "WITHDIST",
      "ASC",
      "COUNT",
      count + 1
    );

    const nearbyUsers: NearbyUser[] = [];
    for (const result of results) {
      const [nearbyUserId, distance] = result as [string, string];
      if (nearbyUserId !== userId) {
        nearbyUsers.push({
          userId: nearbyUserId,
          distance: parseFloat(distance) * 1000,
        });
      }
    }

    return nearbyUsers;
  }

  async getDistanceBetween(
    userId1: string,
    userId2: string
  ): Promise<number | null> {
    const result = await (redis as any).geodist(KEYS.LOCATIONS, userId1, userId2, "m");
    if (!result) {
      return null;
    }
    return parseFloat(result);
  }

  async removeLocation(userId: string): Promise<void> {
    await redis.zrem(KEYS.LOCATIONS, userId);
  }

  async getAllLocations(): Promise<Map<string, Location>> {
    const members = await redis.zrange(KEYS.LOCATIONS, 0, -1);
    const locations = new Map<string, Location>();

    for (const member of members) {
      const location = await this.getLocation(member);
      if (location) {
        locations.set(member, location);
      }
    }

    return locations;
  }

  async countUsers(): Promise<number> {
    return redis.zcard(KEYS.LOCATIONS);
  }
}

export const locationTracker = new LocationTracker();
