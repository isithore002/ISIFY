import axios from "axios";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);

// Where the backend lives, as seen from whatever device is running this page.
//
// The .env default is http://127.0.0.1:8000. That only means "the backend" on the PC itself:
// on a phone, 127.0.0.1 is the phone, so every request would fail. So when the page was opened
// through the PC's network address (http://192.168.x.x:5173), the backend is assumed to be on
// that same address, just on its own port.
function apiBase() {
  const pageHost = window.location.hostname;
  const configured = import.meta.env.VITE_API_URL;

  if (!configured) return `${window.location.protocol}//${pageHost}:8000`;

  const url = new URL(configured);
  if (LOOPBACK.has(url.hostname) && !LOOPBACK.has(pageHost)) url.hostname = pageHost;
  return url.origin;
}

const api = axios.create({ baseURL: apiBase() });

// No response at all means the backend isn't reachable — say so instead of "Network Error"
api.interceptors.response.use(undefined, (err) => {
  if (!err.response && err.code !== "ERR_CANCELED") {
    err.message = `Can't reach the backend at ${api.defaults.baseURL} — is it running?`;
  }
  return Promise.reject(err);
});

export default api;
