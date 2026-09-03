"""
progress_manager.py
──────────────────────────────────────────────────────────────
Bridges the synchronous video-analysis thread with the async
WebSocket sender.

Architecture:
  • Each active analysis job is identified by a UUID job_id.
  • When the WS client connects, it calls register() to store the
    WebSocket and create an asyncio.Queue.
  • The sync analysis thread calls send_sync() — which puts an event
    onto the queue.
  • The WS handler reads the queue and forwards events to the client.
  • complete() / error() send a final event and signal the queue to stop.
  • unregister() cleans up after the WS closes.
──────────────────────────────────────────────────────────────
"""

import asyncio
from typing import Dict
from logger import logger


class ProgressManager:
    """Manages per-job WebSocket progress channels."""

    def __init__(self) -> None:
        # job_id → { "ws": WebSocket, "queue": asyncio.Queue }
        self._jobs: Dict[str, dict] = {}

    # ── Registration ─────────────────────────────────────────

    def register(self, job_id: str, websocket, loop: asyncio.AbstractEventLoop) -> None:
        """
        Register a WebSocket for a job.

        Args:
            job_id:    Unique job identifier (UUID from frontend).
            websocket: FastAPI WebSocket instance.
            loop:      The running event loop (needed for thread-safe puts).
        """
        self._jobs[job_id] = {
            "ws":    websocket,
            "queue": asyncio.Queue(),
            "loop":  loop,
        }
        logger.info(f"Progress channel registered: job={job_id}")

    def unregister(self, job_id: str) -> None:
        """Remove a job's channel after the WS closes."""
        self._jobs.pop(job_id, None)
        logger.info(f"Progress channel removed: job={job_id}")

    # ── Sending from the async WS handler ────────────────────

    async def pump(self, job_id: str) -> None:
        """
        Coroutine run by the WS handler — reads the queue and
        forwards events to the WebSocket until a sentinel is received.
        """
        job = self._jobs.get(job_id)
        if not job:
            return

        ws    = job["ws"]
        queue = job["queue"]

        while True:
            event = await queue.get()
            if event is None:          # sentinel — analysis finished
                break
            try:
                await ws.send_json(event)
            except Exception as exc:
                logger.warning(f"WS send failed for job={job_id}: {exc}")
                break

    # ── Sending from the sync analysis thread ────────────────

    def send_sync(
        self,
        job_id:  str,
        stage:   str,
        percent: int,
        message: str,
    ) -> None:
        """
        Thread-safe: enqueue a progress event from sync code.
        No-op if job_id is not registered (analysis without WS).
        """
        job = self._jobs.get(job_id)
        if not job:
            return

        event = {"stage": stage, "percent": percent, "message": message}
        # thread-safe: schedule the put on the event loop
        asyncio.run_coroutine_threadsafe(
            job["queue"].put(event),
            job["loop"],
        )

    def complete_sync(self, job_id: str, *, error: bool = False) -> None:
        """
        Signal analysis completion from the sync thread.
        Sends a final event then enqueues the sentinel (None).
        """
        if error:
            self.send_sync(job_id, "error", 0, "Analysis failed. Please try again.")
        else:
            self.send_sync(job_id, "done", 100, "Analysis complete!")

        job = self._jobs.get(job_id)
        if job:
            asyncio.run_coroutine_threadsafe(
                job["queue"].put(None),   # sentinel
                job["loop"],
            )


# Singleton — imported everywhere
progress_manager = ProgressManager()
