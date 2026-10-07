import { parseBlob } from "music-metadata";

const AUDIO_EXT = ["mp3", "m4a", "aac", "flac", "wav", "ogg", "oga", "opus", "webm"];
const PARALLEL_READS = 4;

export const AUDIO_ACCEPT = "audio/*," + AUDIO_EXT.map((e) => "." + e).join(",");
export const extOf = (name) => name.split(".").pop().toLowerCase();
export const isAudio = (name) => AUDIO_EXT.includes(extOf(name));

// Recursively lists audio files under a directory handle → [{ file, path }]
export async function scanDirectory(dirHandle, prefix = "") {
  const out = [];
  for await (const entry of dirHandle.values()) {
    const path = prefix + entry.name;
    if (entry.kind === "directory") out.push(...(await scanDirectory(entry, path + "/")));
    else if (isAudio(entry.name)) out.push({ file: await entry.getFile(), path });
  }
  return out;
}

// For untagged files: "01 - Artist - Title.mp3" (WaveVault ZIPs), "Artist - Title.mp3" or "Title.mp3"
function guessFromFilename(name) {
  const parts = name.replace(/\.[^.]+$/, "").replace(/^\d+\s*[-.]\s*/, "").split(" - ");
  return parts.length > 1
    ? { artist: parts[0], title: parts.slice(1).join(" - ") }
    : { artist: "Unknown artist", title: parts[0] };
}

async function readTrack({ file, path }, sourceId) {
  let common = {};
  let format = {};
  try {
    ({ common, format } = await parseBlob(file, { duration: false }));
  } catch {
    // Unreadable tags — fall back to the file name
  }
  const pic = common.picture?.[0];
  const guess = guessFromFilename(file.name);
  return {
    id: `local:${sourceId}:${path}`,
    title: common.title || guess.title,
    artist: common.artist || guess.artist,
    album: common.album || "",
    duration_ms: Math.round((format.duration || 0) * 1000),
    cover_url: pic ? URL.createObjectURL(new Blob([pic.data], { type: pic.format })) : null,
    track_number: common.track?.no || 0,
    // Played straight from disk by usePlayer; never sent to the backend
    local: true,
    file,
    format: extOf(file.name),
  };
}

// Reads tags of all files (a few at a time), sorted by path so "2 - …" comes before "10 - …"
export async function readTracks(files, sourceId, onProgress) {
  const sorted = [...files].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }),
  );
  const tracks = new Array(sorted.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < sorted.length) {
      const i = next++;
      tracks[i] = await readTrack(sorted[i], sourceId);
      onProgress?.(++done, sorted.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_READS, sorted.length) }, worker));
  return tracks;
}
