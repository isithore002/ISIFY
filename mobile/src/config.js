import Constants from 'expo-constants';

// When running with `expo start`, hostUri is the Metro dev server host
// (e.g. "192.168.1.100:8081"). We strip the port and point at FastAPI on 8000.
// This means your phone and PC must be on the same WiFi — or use `adb reverse`.
function resolveApiUrl() {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:8000`;
  return 'http://localhost:8000';
}

export const API_URL = resolveApiUrl();
