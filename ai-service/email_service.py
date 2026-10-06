import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from config import get_settings

logger = logging.getLogger("confidence_ai.email_service")


def check_gmail_exists(email: str) -> tuple[bool, str]:
    """
    Directly query Google's inbound MX server (gmail-smtp-in.l.google.com)
    to verify in real time whether this Gmail address actually exists in Google's database.

    Returns (True, "OK") if the account exists.
    Returns (False, error_message) if Google confirms the account does NOT exist.
    """
    clean_email = (email or "").strip().lower()
    try:
        with smtplib.SMTP("gmail-smtp-in.l.google.com", 25, timeout=4.0) as s:
            s.helo("gmail.com")
            s.mail("verify@gmail.com")
            code, msg = s.rcpt(clean_email)
            if code == 550 or b"does not exist" in msg.lower() or b"nosuchuser" in msg.lower():
                return False, "This Gmail address does not exist on Google. Please enter your real Gmail address."
            return True, "OK"
    except Exception as e:
        logger.warning(f"[Gmail Verify] Live MX probe skipped ({e}), proceeding with email delivery")
        return True, "Probe skipped"


def send_otp_email(to_email: str, otp_code: str) -> bool:
    """
    Send a 6-digit OTP verification code to the user's actual Gmail address.
    Uses SMTP credentials configured in .env (SMTP_USER, SMTP_PASSWORD).

    Returns True if sent successfully, False otherwise.
    """
    settings = get_settings()
    smtp_user = (settings.smtp_user or "").strip()
    smtp_password = (settings.smtp_password or "").replace(" ", "").strip()
    smtp_host = (settings.smtp_host or "smtp.gmail.com").strip()
    smtp_port = int(settings.smtp_port or 587)
    from_name = settings.smtp_from_name or "ConfidenceAI"

    if not smtp_user or not smtp_password:
        logger.warning(
            f"[Email Service] SMTP not configured. Missing SMTP_USER or SMTP_PASSWORD in .env. "
            f"OTP code for {to_email} is {otp_code}."
        )
        return False

    subject = f"{otp_code} is your ConfidenceAI verification code"

    text_body = f"""Hello,

Thank you for joining ConfidenceAI!

Your verification code is: {otp_code}

This code will expire in 10 minutes. Please enter it on the verification page to activate your account.

If you didn't request this code, you can safely ignore this email.

Best regards,
The ConfidenceAI Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="520px" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #121826; border: 1px solid rgba(124, 92, 252, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 36px 20px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: inline-block; padding: 8px 16px; background: linear-gradient(135deg, rgba(124, 92, 252, 0.2), rgba(91, 141, 239, 0.2)); border: 1px solid rgba(124, 92, 252, 0.35); border-radius: 999px; margin-bottom: 16px;">
                <span style="font-size: 12px; font-weight: 700; letter-spacing: 0.8px; color: #a78bfa; text-transform: uppercase;">ConfidenceAI Verification</span>
              </div>
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Verify your Gmail address</h1>
              <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">Enter this 6-digit code in the app to complete your registration.</p>
            </td>
          </tr>

          <!-- OTP Box -->
          <tr>
            <td style="padding: 32px 36px; text-align: center;">
              <div style="background-color: rgba(124, 92, 252, 0.1); border: 2px dashed rgba(124, 92, 252, 0.4); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #c4b5fd; text-shadow: 0 0 20px rgba(124, 92, 252, 0.4); margin-left: 10px;">
                  {otp_code}
                </div>
              </div>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                ⏱️ This code expires in <strong style="color: #ffffff;">10 minutes</strong>.
              </p>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 36px 32px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748b; line-height: 1.5;">
                🔒 For your security, never share this code with anyone. ConfidenceAI will never ask for your code via message or phone.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 36px; background-color: #0d121e; border-top: 1px solid rgba(255, 255, 255, 0.06); text-align: center; font-size: 11px; color: #475569;">
              © 2026 ConfidenceAI. All rights reserved.<br>
              Sent to <span style="color: #94a3b8;">{to_email}</span> because an account was registered with this Gmail.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{smtp_user}>"
    msg["To"] = to_email

    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=12.0) as server:
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=12.0) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(smtp_user, [to_email], msg.as_string())

        logger.info(f"[Email Service] Verification OTP email delivered to {to_email}")
        return True

    except Exception as e:
        logger.error(f"[Email Service] Failed sending OTP email to {to_email}: {e}", exc_info=True)
        return False
