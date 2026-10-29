"""
test_video_analyzer.py
──────────────────────────────────────────────────────────────
Unit tests for VideoAnalyzer pure-Python logic.

We do NOT need a real video file here — we test the three
computation-only methods:
  • _calculate_confidence_score
  • _determine_confidence_level
  • _generate_suggestions

These methods take dicts and return values; they contain the
core domain logic and are cheap to test exhaustively.
──────────────────────────────────────────────────────────────
"""

import pytest
from unittest.mock import MagicMock, patch


# ── Fixture: lightweight VideoAnalyzer (skip model loading) ──

@pytest.fixture(scope="module")
def analyzer():
    """
    Instantiate VideoAnalyzer with the heavy ML models mocked so
    the fixture doesn't load Whisper / MediaPipe / OpenCV haarcascades.
    """
    with (
        patch("cv2.CascadeClassifier"),
        patch("whisper.load_model"),
        patch("mediapipe.solutions.pose"),
    ):
        from video_analyzer import VideoAnalyzer
        return VideoAnalyzer()


# ── Helper metric dicts ────────────────────────────────────────

def perfect_video_metrics():
    return {
        "eye_contact_percentage":    90.0,
        "face_visibility_percentage": 95.0,
        "face_straightness_percentage": 85.0,
        "smile_percentage":          80.0,
        "posture_percentage":        90.0,
        "hand_movement_percentage":  40.0,
    }

def perfect_speech_metrics():
    return {
        "speech_score":    95.0,
        "filler_word_count": 0,
        "words_per_minute":  130.0,
        "speech_text":     "Hello, my name is Test.",
    }

def poor_video_metrics():
    return {
        "eye_contact_percentage":    10.0,
        "face_visibility_percentage": 20.0,
        "face_straightness_percentage": 10.0,
        "smile_percentage":          5.0,
        "posture_percentage":        10.0,
        "hand_movement_percentage":  2.0,   # too little movement
    }

def poor_speech_metrics():
    return {
        "speech_score":    20.0,
        "filler_word_count": 25,
        "words_per_minute":  30.0,
        "speech_text":     "um uh so like um like",
    }


# ── _calculate_confidence_score ───────────────────────────────

class TestCalculateConfidenceScore:

    def test_perfect_metrics_high_score(self, analyzer):
        score = analyzer._calculate_confidence_score(
            perfect_video_metrics(), perfect_speech_metrics()
        )
        assert score >= 60, f"Expected high score, got {score}"

    def test_poor_metrics_low_score(self, analyzer):
        score = analyzer._calculate_confidence_score(
            poor_video_metrics(), poor_speech_metrics()
        )
        assert score <= 30, f"Expected low score, got {score}"

    def test_score_is_float(self, analyzer):
        score = analyzer._calculate_confidence_score(
            perfect_video_metrics(), perfect_speech_metrics()
        )
        assert isinstance(score, float)

    def test_score_bounded_0_to_100(self, analyzer):
        """Score must always be in [0, 100] regardless of inputs."""
        for vm, sm in [
            (perfect_video_metrics(), perfect_speech_metrics()),
            (poor_video_metrics(), poor_speech_metrics()),
            # Zeros everywhere
            ({k: 0.0 for k in perfect_video_metrics()}, {k: 0 for k in perfect_speech_metrics()}),
            # 100s everywhere
            ({k: 100.0 for k in perfect_video_metrics()}, {"speech_score": 100.0, "filler_word_count": 0, "words_per_minute": 130.0, "speech_text": ""}),
        ]:
            score = analyzer._calculate_confidence_score(vm, sm)
            assert 0 <= score <= 100, f"Score {score} out of bounds"

    def test_score_rounded_to_2dp(self, analyzer):
        score = analyzer._calculate_confidence_score(
            perfect_video_metrics(), perfect_speech_metrics()
        )
        assert score == round(score, 2)

    def test_face_visibility_penalty(self, analyzer):
        """Low face visibility (<70%) should penalise the score."""
        vm_good = perfect_video_metrics()
        vm_bad  = {**vm_good, "face_visibility_percentage": 20.0}
        score_good = analyzer._calculate_confidence_score(vm_good, perfect_speech_metrics())
        score_bad  = analyzer._calculate_confidence_score(vm_bad,  perfect_speech_metrics())
        assert score_bad < score_good

    def test_speech_penalty(self, analyzer):
        """Poor speech (<60 score) should penalise the overall score."""
        sm_good = perfect_speech_metrics()
        sm_bad  = {**sm_good, "speech_score": 20.0}
        score_good = analyzer._calculate_confidence_score(perfect_video_metrics(), sm_good)
        score_bad  = analyzer._calculate_confidence_score(perfect_video_metrics(), sm_bad)
        assert score_bad < score_good

    def test_hand_movement_penalty_too_little(self, analyzer):
        """Very little hand movement (<15%) should penalise the score."""
        vm_good = perfect_video_metrics()
        vm_low  = {**vm_good, "hand_movement_percentage": 5.0}
        score_good = analyzer._calculate_confidence_score(vm_good, perfect_speech_metrics())
        score_low  = analyzer._calculate_confidence_score(vm_low,  perfect_speech_metrics())
        assert score_low < score_good

    def test_hand_movement_penalty_too_much(self, analyzer):
        """Excessive hand movement (>65%) should also penalise the score."""
        vm_good = perfect_video_metrics()
        vm_high = {**vm_good, "hand_movement_percentage": 80.0}
        score_good = analyzer._calculate_confidence_score(vm_good, perfect_speech_metrics())
        score_high = analyzer._calculate_confidence_score(vm_high, perfect_speech_metrics())
        assert score_high < score_good

    def test_missing_keys_default_to_zero(self, analyzer):
        """Completely empty dicts should not raise — just return a low score."""
        score = analyzer._calculate_confidence_score({}, {})
        assert 0 <= score <= 100


# ── _determine_confidence_level ───────────────────────────────

class TestDetermineConfidenceLevel:

    @pytest.mark.parametrize("score,expected", [
        (100.0, "High Confidence"),
        (70.0,  "High Confidence"),
        (69.9,  "Moderate Confidence"),
        (50.0,  "Moderate Confidence"),
        (49.9,  "Low Confidence"),
        (0.0,   "Low Confidence"),
    ])
    def test_level_thresholds(self, analyzer, score, expected):
        assert analyzer._determine_confidence_level(score) == expected

    def test_returns_string(self, analyzer):
        assert isinstance(analyzer._determine_confidence_level(55.0), str)


# ── _generate_suggestions ─────────────────────────────────────

class TestGenerateSuggestions:

    def test_returns_list(self, analyzer):
        suggestions = analyzer._generate_suggestions(
            perfect_video_metrics(), perfect_speech_metrics(), 80.0
        )
        assert isinstance(suggestions, list)

    def test_perfect_metrics_few_suggestions(self, analyzer):
        """Near-perfect metrics should produce few or no suggestions."""
        suggestions = analyzer._generate_suggestions(
            perfect_video_metrics(), perfect_speech_metrics(), 85.0
        )
        assert len(suggestions) <= 2

    def test_low_face_visibility_triggers_suggestion(self, analyzer):
        vm = {**perfect_video_metrics(), "face_visibility_percentage": 30.0}
        suggestions = analyzer._generate_suggestions(vm, perfect_speech_metrics(), 40.0)
        # At least one suggestion about face/frame visibility
        assert any("face" in s.lower() or "frame" in s.lower() for s in suggestions)

    def test_low_eye_contact_triggers_suggestion(self, analyzer):
        vm = {**perfect_video_metrics(), "eye_contact_percentage": 10.0}
        suggestions = analyzer._generate_suggestions(vm, perfect_speech_metrics(), 40.0)
        assert any("eye" in s.lower() or "camera" in s.lower() for s in suggestions)

    def test_high_filler_words_triggers_suggestion(self, analyzer):
        sm = {**perfect_speech_metrics(), "filler_word_count": 20, "speech_score": 40.0}
        suggestions = analyzer._generate_suggestions(perfect_video_metrics(), sm, 40.0)
        assert any("filler" in s.lower() or "um" in s.lower() or "uh" in s.lower()
                   for s in suggestions)

    def test_poor_all_metrics_many_suggestions(self, analyzer):
        """All-poor inputs should produce multiple suggestions."""
        suggestions = analyzer._generate_suggestions(
            poor_video_metrics(), poor_speech_metrics(), 15.0
        )
        assert len(suggestions) >= 3

    def test_all_suggestions_are_strings(self, analyzer):
        suggestions = analyzer._generate_suggestions(
            poor_video_metrics(), poor_speech_metrics(), 10.0
        )
        for s in suggestions:
            assert isinstance(s, str) and len(s) > 0


# ── on_progress callback (analyze_video integration) ─────────

class TestAnalyzeVideoProgressCallback:
    """
    Verify that analyze_video() correctly fires the on_progress callback
    without actually running any ML (everything is mocked).
    """

    def test_callback_called_with_expected_stages(self, analyzer):
        stages_received = []

        def capture(stage, percent, message):
            stages_received.append((stage, percent, message))

        # Stub out all IO-bound sub-methods
        analyzer._extract_video_metrics = MagicMock(return_value=perfect_video_metrics())
        analyzer._extract_speech_metrics = MagicMock(return_value=perfect_speech_metrics())
        analyzer._analyze_frame_quality  = MagicMock(return_value={})
        analyzer._generate_suggestions   = MagicMock(return_value=["Keep it up!"])

        analyzer.analyze_video("fake_path.mp4", on_progress=capture)

        stage_keys = [s[0] for s in stages_received]
        assert "starting" in stage_keys
        assert "video_metrics" in stage_keys
        assert "scoring" in stage_keys
        assert "saving" in stage_keys

    def test_no_callback_does_not_raise(self, analyzer):
        """analyze_video without on_progress should work normally."""
        analyzer._extract_video_metrics = MagicMock(return_value=perfect_video_metrics())
        analyzer._extract_speech_metrics = MagicMock(return_value=perfect_speech_metrics())
        analyzer._analyze_frame_quality  = MagicMock(return_value={})
        analyzer._generate_suggestions   = MagicMock(return_value=[])

        result = analyzer.analyze_video("fake_path.mp4")
        assert "confidence_score" in result

    def test_callback_exception_does_not_abort_analysis(self, analyzer):
        """A crashing callback must never propagate to the caller."""
        def bad_callback(stage, percent, message):
            raise RuntimeError("callback exploded!")

        analyzer._extract_video_metrics = MagicMock(return_value=perfect_video_metrics())
        analyzer._extract_speech_metrics = MagicMock(return_value=perfect_speech_metrics())
        analyzer._analyze_frame_quality  = MagicMock(return_value={})
        analyzer._generate_suggestions   = MagicMock(return_value=[])

        # Should not raise
        result = analyzer.analyze_video("fake_path.mp4", on_progress=bad_callback)
        assert "confidence_score" in result
