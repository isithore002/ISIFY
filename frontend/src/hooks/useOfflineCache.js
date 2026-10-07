import { db } from "../lib/db";
import { prepareTrack, fetchTrackBlob } from "../api/track";

const STORE = "tracks";

export async function cacheTrack(track) {
  const status = await prepareTrack(track);
  if (status.status !== "ready") throw new Error(status.error || "Prepare failed");

  const blob = await fetchTrackBlob(track.id);
  const d = await db();
  await d.put(STORE, { blob, meta: track }, track.id);
}

export async function getCachedTrack(trackId) {
  const d = await db();
  return d.get(STORE, trackId);
}

export async function isTrackCached(trackId) {
  const d = await db();
  return (await d.getKey(STORE, trackId)) !== undefined;
}

export async function removeCachedTrack(trackId) {
  const d = await db();
  await d.delete(STORE, trackId);
}
