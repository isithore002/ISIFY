import api from "./client";
import { prepareBody } from "./track";

// Backend downloads every track, then offers them as one ZIP
export const startBulkDownload = (name, tracks) =>
  api.post("/api/bulk", { name, tracks: tracks.map(prepareBody) }).then((r) => r.data);

export const bulkStatus = (jobId) => api.get(`/api/bulk/${jobId}`).then((r) => r.data);

export const bulkZipUrl = (jobId) => `${api.defaults.baseURL}/api/bulk/${jobId}/zip`;
