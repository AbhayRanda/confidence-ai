"""
test_email_service.py
──────────────────────────────────────────────────────────────
Unit tests for email verification & SMTP delivery:
  • check_gmail_exists() — Google inbound MX verification
  • send_otp_email()     — 6-digit OTP delivery via SMTP
──────────────────────────────────────────────────────────────
"""

import smtplib
from unittest.mock import MagicMock, patch
import pytest

from email_service import check_gmail_exists, send_otp_email


class TestCheckGmailExists:

    def test_gmail_exists_success(self, monkeypatch):
        mock_smtp = MagicMock()
        mock_smtp.rcpt.return_value = (250, b"2.1.5 Recipient OK")
        mock_smtp.__enter__.return_value = mock_smtp

        monkeypatch.setattr(smtplib, "SMTP", lambda host, port, timeout: mock_smtp)
        exists, msg = check_gmail_exists("realuser@gmail.com")
        assert exists is True
        assert msg == "OK"

    def test_gmail_not_found_returns_false(self, monkeypatch):
        mock_smtp = MagicMock()
        mock_smtp.rcpt.return_value = (550, b"5.1.1 The email account that you tried to reach does not exist.")
        mock_smtp.__enter__.return_value = mock_smtp

        monkeypatch.setattr(smtplib, "SMTP", lambda host, port, timeout: mock_smtp)
        exists, msg = check_gmail_exists("fakeuser99999@gmail.com")
        assert exists is False
        assert "does not exist" in msg.lower()

    def test_gmail_smtp_timeout_graceful_fallback(self, monkeypatch):
        def mock_failing_smtp(*args, **kwargs):
            raise smtplib.SMTPConnectError(421, b"Connection timed out")

        monkeypatch.setattr(smtplib, "SMTP", mock_failing_smtp)
        exists, msg = check_gmail_exists("user@gmail.com")
        assert exists is True
        assert "skipped" in msg.lower()


class TestSendOTPEmail:

    def test_missing_credentials_returns_false(self, monkeypatch):
        mock_settings = MagicMock(smtp_user="", smtp_password="", smtp_host="smtp.gmail.com", smtp_port=587, smtp_from_name="ConfidenceAI")
        monkeypatch.setattr("email_service.get_settings", lambda: mock_settings)
        success = send_otp_email("recipient@gmail.com", "123456")
        assert success is False

    def test_valid_credentials_sends_email(self, monkeypatch):
        mock_settings = MagicMock(
            smtp_user="sender@gmail.com",
            smtp_password="testpassword123",
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_from_name="ConfidenceAI",
        )
        monkeypatch.setattr("email_service.get_settings", lambda: mock_settings)

        mock_smtp = MagicMock()
        mock_smtp.__enter__.return_value = mock_smtp

        monkeypatch.setattr(smtplib, "SMTP", lambda host, port, timeout: mock_smtp)

        success = send_otp_email("recipient@gmail.com", "654321")
        assert success is True
        mock_smtp.sendmail.assert_called_once()
        mock_smtp.login.assert_called_once_with("sender@gmail.com", "testpassword123")

    def test_smtp_send_failure_returns_false(self, monkeypatch):
        mock_settings = MagicMock(
            smtp_user="sender@gmail.com",
            smtp_password="testpassword123",
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_from_name="ConfidenceAI",
        )
        monkeypatch.setattr("email_service.get_settings", lambda: mock_settings)

        mock_smtp = MagicMock()
        mock_smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Auth error")
        mock_smtp.__enter__.return_value = mock_smtp

        monkeypatch.setattr(smtplib, "SMTP", lambda host, port, timeout: mock_smtp)

        success = send_otp_email("recipient@gmail.com", "654321")
        assert success is False
