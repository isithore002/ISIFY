import { create } from "zustand";
import { startBulkDownload, bulkStatus, bulkZipUrl } from "../api/bulk";

const POLL_MS = 1500;

// Lives outside components so a "Download all" keeps going while you browse other playlists
export const useDownloadStore = create((set) => ({
  jobs: {}, // playlistId → { status, done, total, failed, error }

  downloadAll: async (playlist) => {
    const update = (job) => set((s) => ({ jobs: { ...s.jobs, [playlist.id]: job } }));
    update({ status: "running", done: 0, total: playlist.tracks.length, failed: [] });

    try {
      let job = await startBulkDownload(playlist.name, playlist.tracks);
      while (job.status === "running") {
        update(job);
        await new Promise((r) => setTimeout(r, POLL_MS));
        job = await bulkStatus(job.job_id);
      }
      update(job);
      if (job.status === "ready") {
        // Content-Disposition: attachment makes the browser save it instead of navigating
        const a = document.createElement("a");
        a.href = bulkZipUrl(job.job_id);
        a.click();
      }
    } catch (e) {
      update({ status: "error", done: 0, total: playlist.tracks.length, failed: [],
               error: e.response?.data?.detail || e.message });
    }
  },
}));
