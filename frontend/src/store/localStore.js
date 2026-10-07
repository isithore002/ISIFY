import { create } from "zustand";
import { db } from "../lib/db";
import { scanDirectory, readTracks, isAudio } from "../lib/localAudio";

// Chrome/Edge can remember a picked folder across reloads; other browsers get a
// per-session folder via <input webkitdirectory>.
export const canRememberFolders = typeof window !== "undefined" && "showDirectoryPicker" in window;

// crypto.randomUUID only exists on secure pages (https or localhost). Opened from a phone at
// http://192.168.x.x it is undefined, and adding a folder or files would crash.
const newId = () => globalThis.crypto?.randomUUID?.() ?? `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const toPlaylist = (folder, tracks) => ({
  id: `local:${folder.id}`,
  folderId: folder.id,
  name: folder.name,
  owner: folder.handle ? "Local folder" : "Opened this session",
  description: "",
  cover_url: tracks.find((t) => t.cover_url)?.cover_url ?? null,
  tracks,
  local: true,
});

export const useLocalStore = create((set, get) => ({
  folders: [],    // [{ id, name, handle? }] — entries with a handle are saved in IndexedDB
  playlists: {},  // folderId → playlist, once read
  loading: null,  // { folderId, done, total } while reading tags
  error: null,

  init: async () => {
    const saved = await (await db()).getAll("folders");
    set((s) => ({ folders: [...saved, ...s.folders.filter((f) => !f.handle)] }));
  },

  // Chrome/Edge: pick a folder that stays in the sidebar. Throws AbortError if cancelled.
  pickFolder: async () => {
    const handle = await window.showDirectoryPicker({ id: "wavevault-music", mode: "read" });
    for (const f of get().folders) {
      if (f.handle && (await f.handle.isSameEntry(handle))) return get().openFolder(f);
    }
    const folder = { id: newId(), name: handle.name, handle };
    await (await db()).put("folders", folder);
    set((s) => ({ folders: [...s.folders, folder] }));
    return get().openFolder(folder);
  },

  // Files from an <input type="file"> (single songs, or a folder in other browsers) — session only
  addFiles: async (fileList, name) => {
    const files = [...fileList]
      .filter((f) => isAudio(f.name))
      .map((f) => ({ file: f, path: f.webkitRelativePath || f.name }));
    const folder = { id: newId(), name };
    set((s) => ({ folders: [...s.folders, folder] }));
    return get()._read(folder, async () => files);
  },

  openFolder: async (folder, { rescan = false } = {}) => {
    const loaded = get().playlists[folder.id];
    if (loaded && !rescan) return loaded;
    if (!folder.handle) return loaded ?? null;

    return get()._read(folder, async () => {
      // After a reload Chrome asks again before the site may read the folder
      const opts = { mode: "read" };
      if ((await folder.handle.queryPermission(opts)) !== "granted" &&
          (await folder.handle.requestPermission(opts)) !== "granted") {
        throw new Error(`No permission to read "${folder.name}"`);
      }
      return scanDirectory(folder.handle);
    });
  },

  _read: async (folder, listFiles) => {
    set({ loading: { folderId: folder.id, done: 0, total: 0 }, error: null });
    try {
      const files = await listFiles();
      if (!files.length) throw new Error(`No songs found in "${folder.name}"`);
      const tracks = await readTracks(files, folder.id, (done, total) =>
        set({ loading: { folderId: folder.id, done, total } }),
      );
      const playlist = toPlaylist(folder, tracks);
      set((s) => ({ playlists: { ...s.playlists, [folder.id]: playlist }, loading: null }));
      return playlist;
    } catch (e) {
      set({ loading: null, error: e.name === "NotFoundError" ? `"${folder.name}" no longer exists` : e.message });
      return null;
    }
  },

  removeFolder: async (folder) => {
    if (folder.handle) await (await db()).delete("folders", folder.id);
    set((s) => {
      const playlists = { ...s.playlists };
      delete playlists[folder.id];
      return { folders: s.folders.filter((f) => f.id !== folder.id), playlists };
    });
  },
}));
