"""
test_coaching_engine.py
──────────────────────────────────────────────────────────────
Unit tests for the coaching engine:
  • generate_analysis_report() — rich post-session report generation
  • generate_response()        — rule-based & LLM fallback chat logic
  • generate_response_stream() — streaming token generation
  • _rule_based_response()     — pattern & sentiment matching
──────────────────────────────────────────────────────────────
"""

import pytest
from coaching_engine import (
    generate_analysis_report,
    generate_response,
    generate_response_stream,
    _rule_based_response,
    _build_system_prompt,
)


class TestGenerateAnalysisReport:

    @pytest.fixture()
    def sample_metrics(self):
        return {
            "confidence_score": 72.5,
            "eye_contact_percentage": 55.0,
            "smile_percentage": 45.0,
            "posture_percentage": 85.0,
            "hand_movement_percentage": 50.0,
            "speech_score": 68.0,
            "filler_word_count": 4,
            "words_per_minute": 135.0,
        }

    def test_report_structure_keys(self, sample_metrics):
        report = generate_analysis_report(sample_metrics)
        assert isinstance(report, dict)
        assert "summary" in report
        assert "strengths" in report
        assert "priority_fixes" in report
        assert "practice_plan" in report
        assert "exercise" in report

    def test_report_priority_fixes_targets_worst(self, sample_metrics):
        report = generate_analysis_report(sample_metrics)
        fixes = report["priority_fixes"]
        assert len(fixes) > 0
        # smile (45%) or eye_contact (55%) should be among priority fixes
        metrics_targeted = [f["metric"].lower() for f in fixes]
        assert "smile" in metrics_targeted or "eye contact" in metrics_targeted

    def test_report_with_history_includes_trends(self, sample_metrics):
        history = [
            {
                "confidence_score": 60.0,
                "eye_contact_percentage": 40.0,
                "smile_percentage": 30.0,
                "posture_percentage": 70.0,
                "hand_movement_percentage": 40.0,
                "speech_score": 60.0,
            }
        ]
        report = generate_analysis_report(sample_metrics, history=history)
        assert "trend" in report
        assert isinstance(report["trend"], dict)

    def test_report_practice_plan_length(self, sample_metrics):
        report = generate_analysis_report(sample_metrics)
        plan = report["practice_plan"]
        assert len(plan) == 7  # 7-day plan


class TestGenerateResponse:

    def test_rule_based_greeting(self):
        result = generate_response("Hello!", api_key="")
        assert isinstance(result, dict)
        assert "response" in result
        assert "emotion" in result
        assert len(result["response"]) > 0

    def test_rule_based_eye_contact_question(self):
        result = generate_response("How can I improve my eye contact?", api_key="")
        text = result["response"].lower()
        assert any(w in text for w in ("eye", "camera", "contact", "gaze", "look"))

    def test_rule_based_filler_words_question(self):
        result = generate_response("I use too many filler words like um and uh", api_key="")
        text = result["response"].lower()
        assert "filler" in text or "pause" in text or "breath" in text

    def test_context_awareness(self):
        context = {
            "confidence_score": 45.0,
            "eye_contact_percentage": 30.0,
            "filler_word_count": 8,
        }
        result = generate_response("How was my performance?", context=context, api_key="")
        assert len(result["response"]) > 0

    def test_system_prompt_builder(self):
        context = {"confidence_score": 80.0, "words_per_minute": 140}
        prompt = _build_system_prompt(context, system_prompt_override="You are a strict mentor.")
        assert "strict mentor" in prompt
        assert "80.0" in prompt or "80" in prompt


class TestGenerateResponseStream:

    def test_stream_yields_tokens(self):
        chunks = list(generate_response_stream("Give me quick tips for speaking.", api_key=""))
        assert len(chunks) > 0
        full_text = "".join(chunks)
        assert len(full_text) > 10
