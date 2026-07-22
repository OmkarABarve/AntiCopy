"""Quick end-to-end WebSocket smoke test.

Sends a short scripted interview to a running backend and prints the final
risk assessment. Usage:

    python -m scripts.ws_smoke            # against ws://127.0.0.1:8000
"""

from __future__ import annotations

import asyncio
import json
import time

import websockets

URL = "ws://127.0.0.1:8000/ws/monitor/smoke"

SCRIPT = [
    ("interviewer", "Tell me about a project you built.", "resume_ownership"),
    (
        "candidate",
        "So I implemented the caching layer myself, and honestly I debugged a "
        "nasty race condition for two days. In hindsight I would use a different "
        "lock. I think that was the right call though, maybe.",
        None,
    ),
    ("interviewer", "What is the time complexity of binary search?", "rapid_easy"),
    ("candidate", "Oh, log n. Easy.", None),
]


async def main() -> None:
    async with websockets.connect(URL) as ws:
        base = time.time()
        t = 0.0
        await ws.send(json.dumps({"type": "control", "action": "reset"}))
        await ws.send(json.dumps({"type": "control", "action": "start"}))

        for speaker, text, qtype in SCRIPT:
            if qtype:
                await ws.send(
                    json.dumps({"type": "question", "ts": base + t, "question_type": qtype})
                )
            words = len(text.split())
            dur = words / (150 / 60)
            await ws.send(
                json.dumps(
                    {
                        "type": "transcript",
                        "speaker": speaker,
                        "text": text,
                        "ts_start": base + t,
                        "ts_end": base + t + dur,
                        "is_final": True,
                    }
                )
            )
            t += dur + (2.0 if speaker == "interviewer" else 0.8)

        for i in range(80):
            await ws.send(
                json.dumps(
                    {
                        "type": "gaze",
                        "ts": base + i * 0.4,
                        "on_screen": i % 3 != 0,
                        "blink": i % 15 == 0,
                        "gaze_x": 0.1,
                        "gaze_y": 0.0,
                    }
                )
            )

        # Read a few state frames and print the last one's headline.
        last = None
        for _ in range(4):
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
            if msg.get("type") == "state":
                last = msg

        assert last is not None, "no state received"
        r = last["risk"]
        print("RISK:", r["risk_level"], round(r["risk_score"], 1))
        print("CONFIDENCE:", r["confidence_level"], round(r["confidence_score"], 1))
        print("OWNERSHIP:", last["ownership_score"])
        print("EVIDENCE:", [s["id"] for s in r["evidence"]])
        print("COUNTER:", [s["id"] for s in r["counter_evidence"]])
        print("NEXT Q:", last["flow"]["next_question_type"])
        print("TRANSCRIPT SEGMENTS:", len(last["transcript"]))
        print("WPM POINTS:", len(last["timelines"]["wpm"]))
        print("SMOKE_OK")


if __name__ == "__main__":
    asyncio.run(main())
