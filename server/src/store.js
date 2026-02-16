import Redis from "ioredis";
const redis = new Redis(process.env.REDIS_URL);

const key = (schoolId, meetingId) => `meeting:${schoolId}:${meetingId}`;

export async function getSnapshot(schoolId, meetingId) {
  const raw = await redis.get(key(schoolId, meetingId));
  return raw ? JSON.parse(raw) : null;
}

export async function setSnapshot(schoolId, meetingId, snap) {
  await redis.set(key(schoolId, meetingId), JSON.stringify(snap), "EX", 60 * 60 * 6);
}
