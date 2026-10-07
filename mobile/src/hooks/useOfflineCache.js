import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { prepareTrack } from '../api/track';
import { API_URL } from '../config';

const TRACKS_DIR = FileSystem.documentDirectory + 'tracks/';
const META_KEY = 'wv_cached_meta';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(TRACKS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });
  }
}

function trackPath(trackId) {
  return TRACKS_DIR + trackId + '.mp3';
}

async function readMeta() {
  try {
    const raw = await AsyncStorage.getItem(META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMeta(meta) {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

export async function cacheTrack(track) {
  await ensureDir();

  // Ensure the server has the file ready
  const status = await prepareTrack(track);
  if (status.status !== 'ready') throw new Error(status.error || 'Prepare failed');

  // Download MP3 from server to device storage
  const res = await FileSystem.downloadAsync(
    `${API_URL}/api/track/${track.id}/file`,
    trackPath(track.id),
  );
  if (res.status !== 200) {
    // downloadAsync writes the error body to disk; don't let it pass as a cached track
    await FileSystem.deleteAsync(trackPath(track.id), { idempotent: true });
    throw new Error(`Download failed (HTTP ${res.status})`);
  }

  const meta = await readMeta();
  meta[track.id] = track;
  await writeMeta(meta);
}

export async function isTrackCached(trackId) {
  const info = await FileSystem.getInfoAsync(trackPath(trackId));
  return info.exists;
}

// Returns local file:// URI if cached, null otherwise
export async function getCachedTrackUri(trackId) {
  const path = trackPath(trackId);
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? path : null;
}

export async function removeCachedTrack(trackId) {
  const path = trackPath(trackId);
  const info = await FileSystem.getInfoAsync(path);
  if (info.exists) await FileSystem.deleteAsync(path);

  const meta = await readMeta();
  delete meta[trackId];
  await writeMeta(meta);
}

export async function getAllCachedMeta() {
  return readMeta();
}
