import { redis, KEYS } from "../connection.js";
import { v4 as uuidv4 } from "uuid";
import type { Match } from "../types.js";

export class MatchStore {
  async createMatch(userA: string, userB: string): Promise<Match> {
    const match: Match = {
      id: uuidv4(),
      userA,
      userB,
      createdAt: Date.now(),
    };

    await redis.set(KEYS.MATCH(match.id), JSON.stringify(match));

    await redis.sadd(KEYS.MATCHES(userA), match.id);
    await redis.sadd(KEYS.MATCHES(userB), match.id);

    return match;
  }

  async getMatch(matchId: string): Promise<Match | null> {
    const data = await redis.get(KEYS.MATCH(matchId));
    if (!data) {
      return null;
    }
    return JSON.parse(data) as Match;
  }

  async getMatchesForUser(userId: string): Promise<Match[]> {
    const matchIds = await redis.smembers(KEYS.MATCHES(userId));
    const matches: Match[] = [];

    for (const matchId of matchIds) {
      const match = await this.getMatch(matchId);
      if (match) {
        matches.push(match);
      }
    }

    matches.sort((a, b) => b.createdAt - a.createdAt);
    return matches;
  }

  async getMatchBetweenUsers(
    userA: string,
    userB: string
  ): Promise<Match | null> {
    const matchIds = await redis.smembers(KEYS.MATCHES(userA));

    for (const matchId of matchIds) {
      const match = await this.getMatch(matchId);
      if (
        match &&
        ((match.userA === userA && match.userB === userB) ||
          (match.userA === userB && match.userB === userA))
      ) {
        return match;
      }
    }

    return null;
  }

  async hasMatch(userA: string, userB: string): Promise<boolean> {
    const match = await this.getMatchBetweenUsers(userA, userB);
    return match !== null;
  }

  async getMatchCount(userId: string): Promise<number> {
    return redis.scard(KEYS.MATCHES(userId));
  }

  async deleteMatch(matchId: string): Promise<void> {
    const match = await this.getMatch(matchId);
    if (!match) {
      return;
    }

    await redis.srem(KEYS.MATCHES(match.userA), matchId);
    await redis.srem(KEYS.MATCHES(match.userB), matchId);
    await redis.del(KEYS.MATCH(matchId));
  }
}

export const matchStore = new MatchStore();
