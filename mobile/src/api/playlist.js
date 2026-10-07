import api from './client';

export const importPlaylist = (url) =>
  api.post('/api/playlist', { url }).then((r) => r.data);
