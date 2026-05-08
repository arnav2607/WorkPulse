"""Email service backed by Gmail SMTP (or any SMTP provider).

Non-blocking: send_email_safe never raises into the request handler — errors are logged.
Use a Gmail App Password (16 chars) — generate at https://myaccount.google.com/apppasswords.
"""
from __future__ import annotations

import asyncio
import logging
import os
import smtplib
import ssl
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, parseaddr
from typing import Optional

logger = logging.getLogger("workpulse.email")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
# Gmail app passwords are 16 chars; users often paste with spaces. Strip them.
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "").replace(" ", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", SMTP_USER)
ADMIN_EMAIL = os.environ.get("ADMIN_NOTIFICATION_EMAIL", "")
APP_URL = os.environ.get("APP_URL", "")


# ---------- Low-level send ----------
def _send_sync(to: str, subject: str, html: str) -> bool:
    if not (SMTP_USER and SMTP_PASSWORD):
        logger.warning("SMTP credentials not configured — skipping email to %s", to)
        return False
    if not to:
        logger.warning("No recipient — skipping email")
        return False

    from_name, from_addr = parseaddr(SENDER_EMAIL)
    if not from_addr:
        from_addr = SMTP_USER
    if not from_name:
        from_name = "WorkPulse"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_addr))
    msg["To"] = to
    msg["Reply-To"] = from_addr
    msg.attach(MIMEText("Open this email in an HTML-capable client to view the full content.", "plain"))
    msg.attach(MIMEText(html, "html"))

    try:
        if SMTP_PORT == 465:
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ctx, timeout=20) as smtp:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.sendmail(from_addr, [to], msg.as_string())
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
                smtp.ehlo()
                smtp.starttls(context=ssl.create_default_context())
                smtp.ehlo()
                smtp.login(SMTP_USER, SMTP_PASSWORD)
                smtp.sendmail(from_addr, [to], msg.as_string())
        logger.info("Email sent → %s (subj=%s)", to, subject)
        return True
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(
            "SMTP auth failed for %s — check SMTP_USER / SMTP_PASSWORD (use a Gmail App Password, NOT account password). %s",
            SMTP_USER, exc,
        )
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed sending email to %s: %s", to, exc)
        return False


async def send_email_safe(to: str, subject: str, html: str) -> Optional[bool]:
    """Fire-and-forget. Runs SMTP in a thread so we never block the event loop."""
    try:
        return await asyncio.to_thread(_send_sync, to, subject, html)
    except Exception as exc:  # noqa: BLE001
        logger.error("send_email_safe outer error: %s", exc)
        return False


def fire_and_forget(coro) -> None:
    """Schedule a coroutine without awaiting (keeps API responses snappy)."""
    try:
        asyncio.create_task(coro)
    except RuntimeError:
        asyncio.run(coro)


# ---------- Templates ----------
_BASE = """
<!doctype html>
<html><body style="margin:0;padding:0;background:#fdfbf7;font-family:Helvetica,Arial,sans-serif;color:#1c1917">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#fdfbf7;padding:24px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0"
       style="background:#fff;border:1px solid #e5e3db;border-radius:14px;overflow:hidden">
  <tr><td style="background:#14532d;padding:18px 26px;color:#fff;font-size:15px;font-weight:600;letter-spacing:0.5px">
    {brand}
  </td></tr>
  <tr><td style="padding:26px 26px 8px 26px">
    <h2 style="margin:0 0 6px 0;font-size:20px;color:#1c1917">{title}</h2>
    <p style="margin:0;color:#57534e;font-size:13px">{intro}</p>
  </td></tr>
  <tr><td style="padding:18px 26px 4px 26px">{body}</td></tr>
  <tr><td style="padding:0 26px 24px 26px">{cta}</td></tr>
  <tr><td style="background:#fef8f0;border-top:1px solid #e5e3db;padding:14px 26px;color:#a8a29e;font-size:11px">
    Sent automatically by WorkPulse · {when}
  </td></tr>
</table>
</td></tr></table>
</body></html>
""".strip()


def _shell(title: str, intro: str, body_html: str, cta_html: str = "", brand: str = "WorkPulse · Operations") -> str:
    return _BASE.format(
        brand=brand,
        title=title,
        intro=intro,
        body=body_html,
        cta=cta_html,
        when=datetime.now().strftime("%a, %d %b %Y · %H:%M"),
    )


def _kv_table(items: list[tuple[str, str]]) -> str:
    rows = "".join(
        f'<tr><td style="padding:6px 0;color:#78716c;font-size:12px;width:120px">{k}</td>'
        f'<td style="padding:6px 0;color:#1c1917;font-size:13px;font-weight:500">{v}</td></tr>'
        for k, v in items
    )
    return f'<table cellpadding="0" cellspacing="0" style="margin-top:8px">{rows}</table>'


def _btn(href: str, label: str) -> str:
    if not href:
        return ""
    return (
        f'<a href="{href}" style="display:inline-block;background:#14532d;color:#fff;'
        f'text-decoration:none;padding:11px 20px;border-radius:10px;font-size:13px;font-weight:600">'
        f"{label}</a>"
    )


# ---------- High-level senders ----------
async def notify_admin_sheet_submitted(admin_email: str, employee_name: str, summary: dict) -> None:
    if not admin_email:
        return
    body = _kv_table([
        ("Employee", employee_name),
        ("Date", summary.get("date", "")),
        ("Activities", str(summary.get("count", 0))),
        ("Status", "Submitted ✅"),
    ])
    html = _shell(
        title="Daily sheet submitted",
        intro=f"{employee_name} just submitted today's activity sheet.",
        body_html=body,
        cta_html=_btn(f"{APP_URL}/admin/sheets" if APP_URL else "", "View activity sheets"),
    )
    await send_email_safe(admin_email, f"✅ Sheet submitted by {employee_name}", html)


async def notify_admin_leave_applied(admin_email: str, employee_name: str, leave: dict) -> None:
    if not admin_email:
        return
    body = _kv_table([
        ("Employee", employee_name),
        ("Type", str(leave.get("leave_type", "")).replace("_", " ").title()),
        ("From", leave.get("from_date", "")),
        ("To", leave.get("to_date", "")),
        ("Reason", leave.get("reason", "—")),
    ])
    html = _shell(
        title="Leave request pending review",
        intro=f"{employee_name} has applied for leave and is waiting for your decision.",
        body_html=body,
        cta_html=_btn(f"{APP_URL}/admin/leaves" if APP_URL else "", "Review request"),
    )
    await send_email_safe(admin_email, f"📋 Leave request from {employee_name}", html)


async def notify_employee_leave_decided(employee_email: str, employee_name: str, leave: dict, decision: str, comment: str = "") -> None:
    if not employee_email:
        return
    is_approved = decision == "approved"
    color = "#15803d" if is_approved else "#b91c1c"
    icon = "✅" if is_approved else "❌"
    body = _kv_table([
        ("Type", str(leave.get("leave_type", "")).replace("_", " ").title()),
        ("From", leave.get("from_date", "")),
        ("To", leave.get("to_date", "")),
        ("Decision", f'<span style="color:{color};font-weight:600">{decision.upper()}</span>'),
    ])
    if comment:
        body += (
            f'<div style="margin-top:14px;padding:12px;border-left:3px solid {color};'
            f'background:#fef8f0;border-radius:6px;font-size:13px;color:#44403c">'
            f'<strong>Note from admin:</strong> {comment}</div>'
        )
    html = _shell(
        title=f"Your leave was {decision}",
        intro=f"Hi {employee_name}, here's the decision on your leave request.",
        body_html=body,
        cta_html=_btn(f"{APP_URL}/employee/leaves" if APP_URL else "", "View my leaves"),
    )
    await send_email_safe(employee_email, f"{icon} Leave {decision} — WorkPulse", html)


async def notify_employee_task_assigned(employee_email: str, employee_name: str, task: dict) -> None:
    if not employee_email:
        return
    body = _kv_table([
        ("Title", task.get("title", "")),
        ("Priority", str(task.get("priority", "")).title()),
        ("Deadline", task.get("deadline", "—")),
        ("Status", str(task.get("status", "")).replace("_", " ").title()),
    ])
    desc = task.get("description") or ""
    if desc:
        body += (
            f'<div style="margin-top:14px;padding:12px;background:#fef8f0;'
            f'border:1px solid #e5e3db;border-radius:8px;font-size:13px;color:#44403c">{desc}</div>'
        )
    task_id = task.get("id", "")
    cta_url = f"{APP_URL}/employee/tasks/{task_id}" if (APP_URL and task_id) else (f"{APP_URL}/employee/tasks" if APP_URL else "")
    html = _shell(
        title="A new task has been assigned to you",
        intro=f"Hi {employee_name}, your admin has assigned you a new task.",
        body_html=body,
        cta_html=_btn(cta_url, "Open task"),
    )
    await send_email_safe(employee_email, f"📌 New task: {task.get('title','')}", html)


async def notify_employee_task_deadline_tomorrow(employee_email: str, employee_name: str, task: dict) -> None:
    if not employee_email:
        return
    body = _kv_table([
        ("Title", task.get("title", "")),
        ("Priority", str(task.get("priority", "")).title()),
        ("Deadline", f'<span style="color:#b45309;font-weight:600">{task.get("deadline","")} · tomorrow</span>'),
        ("Current status", str(task.get("status", "")).replace("_", " ").title()),
    ])
    task_id = task.get("id", "")
    cta_url = f"{APP_URL}/employee/tasks/{task_id}" if (APP_URL and task_id) else (f"{APP_URL}/employee/tasks" if APP_URL else "")
    html = _shell(
        title="Task deadline tomorrow",
        intro=f"Hi {employee_name}, this is a friendly reminder that one of your tasks is due tomorrow.",
        body_html=body,
        cta_html=_btn(cta_url, "Open task"),
    )
    await send_email_safe(employee_email, f"⏰ Reminder: '{task.get('title','')}' is due tomorrow", html)


async def notify_employee_sheet_pending(employee_email: str, employee_name: str) -> None:
    if not employee_email:
        return
    body = (
        '<p style="margin:0;color:#44403c;font-size:13px;line-height:1.6">'
        "Just a quick reminder to submit today's activity sheet before the day ends. "
        "It only takes a minute, and it keeps your manager updated on what you accomplished today."
        "</p>"
    )
    cta_url = f"{APP_URL}/employee/sheet" if APP_URL else ""
    html = _shell(
        title="Don't forget your daily sheet",
        intro=f"Hi {employee_name}, you haven't submitted today's activity sheet yet.",
        body_html=body,
        cta_html=_btn(cta_url, "Submit my sheet"),
    )
    await send_email_safe(employee_email, "🕕 Reminder · Daily activity sheet pending", html)
