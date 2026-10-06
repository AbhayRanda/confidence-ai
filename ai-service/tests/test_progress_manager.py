"""
test_progress_manager.py
──────────────────────────────────────────────────────────────
Unit tests for ProgressManager:
  • register() / unregister() channel lifecycle
  • send_sync() thread-safe queue event creation
  • complete_sync() completion signaling (success and error)
  • pump() async event forwarding
──────────────────────────────────────────────────────────────
"""

import asyncio
from unittest.mock import AsyncMock
import pytest

from progress_manager import ProgressManager


class TestProgressManager:

    def test_register_and_unregister(self):
        pm = ProgressManager()
        mock_ws = AsyncMock()
        loop = asyncio.new_event_loop()

        pm.register("job-1", mock_ws, loop)
        assert "job-1" in pm._jobs
        assert pm._jobs["job-1"]["ws"] is mock_ws

        pm.unregister("job-1")
        assert "job-1" not in pm._jobs
        loop.close()

    def test_send_sync_and_complete(self):
        async def _run():
            pm = ProgressManager()
            mock_ws = AsyncMock()
            loop = asyncio.get_running_loop()

            pm.register("job-2", mock_ws, loop)

            # Send progress events
            pm.send_sync("job-2", "extracting_audio", 25, "Extracting audio")
            pm.complete_sync("job-2")

            # Pump until complete
            await asyncio.wait_for(pm.pump("job-2"), timeout=2.0)

            # Assert WebSocket received events
            calls = mock_ws.send_json.call_args_list
            assert len(calls) == 2
            assert calls[0][0][0]["stage"] == "extracting_audio"
            assert calls[0][0][0]["percent"] == 25
            assert calls[1][0][0]["stage"] == "done"
            assert calls[1][0][0]["percent"] == 100

        asyncio.run(_run())

    def test_complete_sync_with_error(self):
        async def _run():
            pm = ProgressManager()
            mock_ws = AsyncMock()
            loop = asyncio.get_running_loop()

            pm.register("job-3", mock_ws, loop)
            pm.complete_sync("job-3", error=True)

            await asyncio.wait_for(pm.pump("job-3"), timeout=2.0)

            calls = mock_ws.send_json.call_args_list
            assert len(calls) == 1
            assert calls[0][0][0]["stage"] == "error"

        asyncio.run(_run())

    def test_send_sync_unregistered_job_is_noop(self):
        pm = ProgressManager()
        # Should not raise any exceptions
        pm.send_sync("nonexistent-job", "processing", 10, "Test")
        pm.complete_sync("nonexistent-job")
