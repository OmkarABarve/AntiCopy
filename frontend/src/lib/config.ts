// Frontend runtime config. Override via NEXT_PUBLIC_* env vars.

export const BACKEND_HTTP =
  process.env.NEXT_PUBLIC_BACKEND_HTTP ?? "http://localhost:8000";

export const BACKEND_WS =
  process.env.NEXT_PUBLIC_BACKEND_WS ?? "ws://localhost:8000";

export function wsUrl(sessionId: string): string {
  return `${BACKEND_WS}/ws/monitor/${encodeURIComponent(sessionId)}`;
}

// MediaPipe Face Landmarker assets (served from the jsDelivr CDN, no install).
export const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";
export const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
