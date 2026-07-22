// TypeScript mirror of the backend WebSocket protocol (backend/app/schemas.py).
// Kept in sync by hand; both ends are intentionally small and typed.

export type Speaker = "interviewer" | "candidate";

export type QuestionType =
  | "easy"
  | "hard_technical"
  | "rapid_easy"
  | "opinion"
  | "resume_ownership"
  | "personal_experience"
  | "constraint"
  | "follow_up";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";
export type SignalDirection = "positive" | "human";

// --- Inbound events (browser -> backend) --- //
export interface TranscriptEvent {
  type: "transcript";
  speaker: Speaker;
  text: string;
  ts_start: number;
  ts_end: number;
  is_final: boolean;
}

export type ActivityKind =
  | "focus"
  | "blur"
  | "visibility_hidden"
  | "visibility_visible"
  | "mouse"
  | "key"
  /** Sustained dual-talk: interviewer mic + Meet tab audio both hot. */
  | "voice_overlap";

export interface GazeEvent {
  type: "gaze";
  ts: number;
  face_visible?: boolean;
  on_screen: boolean;
  blink: boolean;
  ear?: number | null;
  gaze_x: number;
  gaze_y: number;
  yaw?: number | null;
  pitch?: number | null;
}

export interface ActivityEvent {
  type: "activity";
  ts: number;
  kind: ActivityKind;
  detail?: string | null;
}

export interface QuestionEvent {
  type: "question";
  ts: number;
  question_type: QuestionType;
}

export interface ControlEvent {
  type: "control";
  action: "start" | "stop" | "reset";
}

export type InboundEvent =
  | TranscriptEvent
  | GazeEvent
  | ActivityEvent
  | QuestionEvent
  | ControlEvent;

// --- Outbound (backend -> browser) --- //
export interface Signal {
  id: string;
  label: string;
  direction: SignalDirection;
  weight: number;
  confidence: number;
  explanation: string;
  detector: string;
}

export interface RiskResult {
  risk_level: RiskLevel;
  risk_score: number;
  confidence_level: ConfidenceLevel;
  confidence_score: number;
  positive_pressure: number;
  human_pressure: number;
  evidence: Signal[];
  counter_evidence: Signal[];
  summary: string;
}

export interface FlowSuggestion {
  next_question_type: QuestionType;
  next_question_prompt: string;
  rationale: string;
  adaptive_flow: QuestionType[];
}

export interface TimelinePoint {
  ts: number;
  value: number;
  label?: string | null;
}

export interface Timelines {
  wpm: TimelinePoint[];
  latency: TimelinePoint[];
  blink: TimelinePoint[];
  pause: TimelinePoint[];
  conversation: TimelinePoint[];
}

export interface HeatmapCell {
  x: number;
  y: number;
  value: number;
}

export interface TranscriptSegment {
  speaker: Speaker;
  text: string;
  ts_start: number;
  ts_end: number;
}

export interface FeatureSnapshot {
  values: Record<string, number>;
  by_question_type: Record<string, Record<string, number>>;
}

export interface MonitorState {
  type: "state";
  session_id: string;
  ts: number;
  status: "idle" | "monitoring" | "stopped";
  duration_s: number;
  features: FeatureSnapshot;
  risk: RiskResult;
  flow: FlowSuggestion;
  timelines: Timelines;
  heatmap: HeatmapCell[];
  transcript: TranscriptSegment[];
  ownership_score: number;
  data_sufficiency: number;
}

export interface AckMessage {
  type: "ack";
  session_id: string;
  message: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type OutboundMessage = MonitorState | AckMessage | ErrorMessage;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  easy: "Easy",
  hard_technical: "Hard Technical",
  rapid_easy: "Rapid Easy",
  opinion: "Opinion",
  resume_ownership: "Resume Ownership",
  personal_experience: "Personal Experience",
  constraint: "Constraint",
  follow_up: "Follow-up",
};
