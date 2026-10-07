import api from "./client";

export const searchYouTube = async (query, { limit = 5, songsOnly = false } = {}) => {
  if (!query || !query.trim()) return [];
  const res = await api.get("/api/search", {
    params: { q: query.trim(), n: limit, songs_only: songsOnly },
  });
  return res.data?.results || [];
};

// Songs that go well after the given YouTube video (what autoplay queues up next)
export const fetchSimilarTracks = async (videoId) => {
  const res = await api.get("/api/search/similar", { params: { video_id: videoId } });
  return res.data?.results || [];
};
