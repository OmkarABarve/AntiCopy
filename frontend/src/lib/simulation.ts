// Simulation / replay layer.
//
// Emits realistic scripted InboundEvents through the SAME sink the live capture
// hooks use, so the dashboard behaves identically whether data is real or
// replayed. This guarantees a flawless demo even without camera/mic/models, and
// lets us showcase two contrasting behavioural profiles.

import type {
  GazeEvent,
  InboundEvent,
  QuestionType,
  TranscriptEvent,
} from "@/lib/types";
import { nowSeconds } from "@/lib/utils";

export type SimulationProfile = "ai_assisted" | "human";

type Emit = (event: InboundEvent) => void;

interface ScriptItem {
  type: QuestionType;
  question: string;
  answer: string;
  latency: number; // seconds after the question ends
  wpm: number; // controls answer duration
}

const AI_SCRIPT: ScriptItem[] = [
  {
    type: "easy",
    question: "Can you tell me what a hash map is?",
    answer:
      "A hash map is a data structure that stores key value pairs and provides average constant time complexity for insertion lookup and deletion by using a hash function to map keys to buckets.",
    latency: 1.9,
    wpm: 156,
  },
  {
    type: "hard_technical",
    question: "How would you design a rate limiter for a distributed system?",
    answer:
      "A distributed rate limiter can be implemented using a token bucket algorithm backed by a centralized store such as Redis where each request atomically decrements a counter and the counter refills at a fixed rate ensuring consistency across nodes.",
    latency: 2.0,
    wpm: 155,
  },
  {
    type: "rapid_easy",
    question: "What is the time complexity of binary search?",
    answer:
      "The time complexity of binary search is logarithmic specifically O of log n because the search space is halved on each iteration of the algorithm.",
    latency: 1.9,
    wpm: 157,
  },
  {
    type: "opinion",
    question: "Do you prefer SQL or NoSQL databases and why?",
    answer:
      "Both have their advantages SQL databases provide strong consistency and structured schemas while NoSQL databases offer horizontal scalability and flexibility the choice depends on the specific requirements of the application.",
    latency: 2.0,
    wpm: 156,
  },
  {
    type: "resume_ownership",
    question: "Tell me about a project on your resume that you built.",
    answer:
      "The project was a web application that allowed users to manage tasks it was built using modern technologies and followed best practices for scalability and maintainability throughout the development lifecycle.",
    latency: 1.9,
    wpm: 155,
  },
  {
    type: "constraint",
    question: "Now assume you cannot use any external cache. How does that change your design?",
    answer:
      "Without an external cache the rate limiter can use an in memory data structure on each node however this introduces consistency challenges that can be mitigated using a consistent hashing approach to route requests deterministically.",
    latency: 2.0,
    wpm: 156,
  },
  {
    type: "follow_up",
    question: "What tradeoffs did you consider there?",
    answer:
      "The main tradeoff is between consistency and latency a centralized approach offers stronger consistency while a distributed approach offers lower latency and higher availability at the cost of eventual consistency.",
    latency: 1.9,
    wpm: 156,
  },
];

const HUMAN_SCRIPT: ScriptItem[] = [
  {
    type: "easy",
    question: "Can you tell me what a hash map is?",
    answer:
      "Yeah so a hash map is basically um a key value store, right? You hash the key to find a bucket. I use them all the time, like dictionaries in Python.",
    latency: 0.8,
    wpm: 168,
  },
  {
    type: "hard_technical",
    question: "How would you design a rate limiter for a distributed system?",
    answer:
      "Hmm, good question. Let me think. So, I actually built one at my last job. We used a token bucket in Redis, but honestly the tricky part was, wait, sorry, it was the clock skew between nodes. We debugged that for like two days.",
    latency: 3.8,
    wpm: 132,
  },
  {
    type: "rapid_easy",
    question: "What is the time complexity of binary search?",
    answer: "Oh, log n. Easy.",
    latency: 0.6,
    wpm: 150,
  },
  {
    type: "opinion",
    question: "Do you prefer SQL or NoSQL databases and why?",
    answer:
      "Personally I prefer SQL for most things? I mean, I like having a schema. But for my side project I chose Postgres and it was great. Does that answer your question, or do you want a specific case?",
    latency: 1.5,
    wpm: 175,
  },
  {
    type: "resume_ownership",
    question: "Tell me about a project on your resume that you built.",
    answer:
      "Sure. So I built this task manager. The interesting part was I implemented offline sync myself, and in hindsight I'd use a CRDT instead because merging conflicts was a nightmare. I learned a lot from that mistake honestly.",
    latency: 2.2,
    wpm: 158,
  },
  {
    type: "constraint",
    question: "Now assume you cannot use any external cache. How does that change your design?",
    answer:
      "Oh interesting. Um, so no Redis then. I guess I'd keep it in memory per node, but then, wait, how do we stay consistent? Maybe consistent hashing so each user always hits the same node? I'm not fully sure that scales though.",
    latency: 4.5,
    wpm: 120,
  },
  {
    type: "follow_up",
    question: "What tradeoffs did you consider there?",
    answer:
      "Right so the tradeoff is basically consistency versus latency. When we chose the centralized version, we sacrificed a bit of speed. The benefit was it was way easier to reason about. In retrospect it was the right call for us.",
    latency: 1.9,
    wpm: 145,
  },
];

function scriptFor(profile: SimulationProfile): ScriptItem[] {
  return profile === "ai_assisted" ? AI_SCRIPT : HUMAN_SCRIPT;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

const SPEED = 4; // real-time compression factor for the demo

/**
 * Build the full timeline of (delayMs, event) tuples for a profile. Event `ts`
 * values are in *script time* (real latencies preserved) while `delayMs` paces
 * emission at SPEED x so the dashboard fills in quickly.
 */
function buildTimeline(profile: SimulationProfile): { delayMs: number; event: InboundEvent }[] {
  const base = nowSeconds();
  const script = scriptFor(profile);
  const out: { delayMs: number; event: InboundEvent }[] = [];

  let t = 0; // script seconds
  for (const item of script) {
    const qWords = wordCount(item.question);
    const qDuration = qWords / (150 / 60);

    out.push({
      delayMs: (t / SPEED) * 1000,
      event: { type: "question", ts: base + t, question_type: item.type },
    });
    const qStart = t;
    const qEnd = t + qDuration;
    out.push({
      delayMs: (qStart / SPEED) * 1000,
      event: {
        type: "transcript",
        speaker: "interviewer",
        text: item.question,
        ts_start: base + qStart,
        ts_end: base + qEnd,
        is_final: true,
      } satisfies TranscriptEvent,
    });

    const aStart = qEnd + item.latency;
    const aWords = wordCount(item.answer);
    const aDuration = aWords / (item.wpm / 60);
    const aEnd = aStart + aDuration;
    out.push({
      delayMs: (aEnd / SPEED) * 1000,
      event: {
        type: "transcript",
        speaker: "candidate",
        text: item.answer,
        ts_start: base + aStart,
        ts_end: base + aEnd,
        is_final: true,
      } satisfies TranscriptEvent,
    });

    t = aEnd + 0.8;
  }

  const total = t;
  out.push(...buildGaze(profile, base, total));
  return out.sort((a, b) => a.delayMs - b.delayMs);
}

function buildGaze(
  profile: SimulationProfile,
  base: number,
  total: number,
): { delayMs: number; event: InboundEvent }[] {
  const out: { delayMs: number; event: InboundEvent }[] = [];
  const hz = 8;
  const n = Math.floor(total * hz);
  for (let i = 0; i < n; i++) {
    const st = i / hz; // script time
    let gaze_x: number;
    let gaze_y: number;
    let on_screen: boolean;
    let blink = i % Math.floor(hz * (profile === "ai_assisted" ? 6 : 3.5)) === 0;

    if (profile === "ai_assisted") {
      // Reading-like: rhythmic left->right sweep with resets, held off-center.
      const phase = (i % (hz * 2)) / (hz * 2); // 2s reading cycle
      gaze_x = 0.15 + phase * 0.55; // sweep rightward
      if (phase > 0.92) gaze_x = 0.1; // line reset
      gaze_y = 0.25 + Math.sin(i / 6) * 0.05;
      on_screen = gaze_x < 0.45;
    } else {
      // Natural: centered gaze with organic jitter, mostly on-camera.
      gaze_x = Math.sin(i / 9) * 0.18 + (Math.random() - 0.5) * 0.12;
      gaze_y = Math.cos(i / 11) * 0.12 + (Math.random() - 0.5) * 0.1;
      on_screen = Math.abs(gaze_x) < 0.5 && Math.abs(gaze_y) < 0.5;
    }

    out.push({
      delayMs: (st / SPEED) * 1000,
      event: {
        type: "gaze",
        ts: base + st,
        on_screen,
        blink,
        gaze_x: Number(gaze_x.toFixed(3)),
        gaze_y: Number(gaze_y.toFixed(3)),
      } satisfies GazeEvent,
    });
  }
  return out;
}

export interface SimulationHandle {
  stop: () => void;
}

/** Start a simulation, emitting events through `emit`. Returns a stop handle. */
export function startSimulation(emit: Emit, profile: SimulationProfile): SimulationHandle {
  const timeline = buildTimeline(profile);
  const timers: ReturnType<typeof setTimeout>[] = [];

  emit({ type: "control", action: "reset" });
  emit({ type: "control", action: "start" });

  for (const { delayMs, event } of timeline) {
    timers.push(setTimeout(() => emit(event), delayMs));
  }

  return {
    stop: () => {
      timers.forEach(clearTimeout);
    },
  };
}
