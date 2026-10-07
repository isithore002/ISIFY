import { openDB } from "idb";

let dbPromise = null;

// One IndexedDB for the app. Bump the version when adding a store; existing data is kept.
export function db() {
  dbPromise ??= openDB("wavevault", 2, {
    upgrade(d) {
      // Offline copies of streamed songs: trackId → { blob, meta }
      if (!d.objectStoreNames.contains("tracks")) d.createObjectStore("tracks");
      // Local music folders the user picked: { id, name, handle }
      if (!d.objectStoreNames.contains("folders")) d.createObjectStore("folders", { keyPath: "id" });
    },
  });
  return dbPromise;
}
