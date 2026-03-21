#!/usr/bin/env python
import sys

try:
    from mediapipe.python.solutions import pose
    print("✓ Solutions API available via mediapipe.python.solutions")
    sys.exit(0)
except ImportError as e:
    print(f"✗ Solutions API not available: {e}")
    sys.exit(1)
