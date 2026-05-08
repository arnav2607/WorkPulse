"""WorkPulse backend integration tests."""
import os
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "arnavpgoel@gmail.com"
ADMIN_PASS = "arnav2607"


# ===== Fixtures =====
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["success"] is True
    assert body["user"]["role"] == "admin"
    return body["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def employee(admin_headers):
    """Create a test employee for the session."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "name": f"TEST_Emp_{suffix}",
        "email": f"test_emp_{suffix}@example.com",
        "password": "Test1234!",
        "department": "QA",
    }
    r = requests.post(f"{API}/employees", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["email"] == payload["email"]
    assert data["role"] == "employee"
    assert data["is_active"] is True
    assert "id" in data
    return {**data, "password": payload["password"]}


@pytest.fixture(scope="session")
def emp_token(employee):
    r = requests.post(f"{API}/auth/login", json={"email": employee["email"], "password": employee["password"]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def emp_headers(emp_token):
    return {"Authorization": f"Bearer {emp_token}", "Content-Type": "application/json"}


# ===== Auth =====
class TestAuth:
    def test_login_admin(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 10

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["data"]["email"] == ADMIN_EMAIL

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ===== Employees =====
class TestEmployees:
    def test_employee_can_login(self, employee):
        r = requests.post(f"{API}/auth/login", json={"email": employee["email"], "password": employee["password"]})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "employee"

    def test_list_employees_admin(self, admin_headers, employee):
        r = requests.get(f"{API}/employees", headers=admin_headers)
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()["data"]]
        assert employee["id"] in ids

    def test_list_employees_forbidden_for_employee(self, emp_headers):
        r = requests.get(f"{API}/employees", headers=emp_headers)
        assert r.status_code == 403

    def test_default_leave_balance_created(self, admin_headers, employee):
        r = requests.get(f"{API}/leaves/balance/{employee['id']}", headers=admin_headers)
        assert r.status_code == 200
        bal = r.json()["data"]
        assert bal["casual_total"] == 12
        assert bal["sick_total"] == 6
        assert bal["casual_used"] == 0

    def test_update_employee(self, admin_headers, employee):
        r = requests.patch(
            f"{API}/employees/{employee['id']}",
            json={"department": "Engineering"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["data"]["department"] == "Engineering"

    def test_deactivate_then_reactivate(self, admin_headers):
        # Create throwaway employee
        suffix = uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/employees", json={
            "name": f"TEST_Deact_{suffix}", "email": f"deact_{suffix}@x.com",
            "password": "p", "department": "X",
        }, headers=admin_headers)
        emp_id = r.json()["data"]["id"]
        rd = requests.delete(f"{API}/employees/{emp_id}", headers=admin_headers)
        assert rd.status_code == 200
        # Verify is_active=false
        rl = requests.get(f"{API}/employees", headers=admin_headers)
        target = next((e for e in rl.json()["data"] if e["id"] == emp_id), None)
        assert target is not None
        assert target["is_active"] is False


# ===== Activity Templates =====
class TestActivityTemplates:
    def test_list_template(self, emp_headers):
        r = requests.get(f"{API}/activities/template", headers=emp_headers)
        assert r.status_code == 200
        items = r.json()["data"]
        # seeded 5 default items
        assert len(items) >= 5

    def test_employee_cannot_create(self, emp_headers):
        r = requests.post(f"{API}/activities/template",
                          json={"name": "BadActivity"}, headers=emp_headers)
        assert r.status_code == 403

    def test_admin_create_update_delete(self, admin_headers):
        suffix = uuid.uuid4().hex[:5]
        name = f"TEST_Activity_{suffix}"
        r = requests.post(f"{API}/activities/template",
                          json={"name": name, "description": "x"}, headers=admin_headers)
        assert r.status_code == 200
        tid = r.json()["data"]["id"]
        # Update
        r2 = requests.patch(f"{API}/activities/template/{tid}",
                            json={"description": "updated"}, headers=admin_headers)
        assert r2.status_code == 200
        assert r2.json()["data"]["description"] == "updated"
        # Soft delete
        r3 = requests.delete(f"{API}/activities/template/{tid}", headers=admin_headers)
        assert r3.status_code == 200
        # Should not be in active list
        r4 = requests.get(f"{API}/activities/template", headers=admin_headers)
        assert tid not in [t["id"] for t in r4.json()["data"]]


# ===== Tasks =====
@pytest.fixture(scope="session")
def task(admin_headers, employee):
    payload = {
        "title": "TEST_Task_Initial",
        "description": "QA test task",
        "assigned_to": employee["id"],
        "priority": "high",
        "deadline": (date.today() + timedelta(days=3)).isoformat(),
    }
    r = requests.post(f"{API}/tasks", json=payload, headers=admin_headers)
    assert r.status_code == 200, r.text
    return r.json()["data"]


class TestTasks:
    def test_create_task(self, task, employee):
        assert task["assigned_to"] == employee["id"]
        assert task["status"] == "pending"

    def test_employee_cannot_create_task(self, emp_headers, employee):
        r = requests.post(f"{API}/tasks", json={
            "title": "x", "assigned_to": employee["id"]
        }, headers=emp_headers)
        assert r.status_code == 403

    def test_employee_sees_only_own(self, emp_headers, task):
        r = requests.get(f"{API}/tasks", headers=emp_headers)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()["data"]]
        assert task["id"] in ids

    def test_admin_sees_all(self, admin_headers, task):
        r = requests.get(f"{API}/tasks", headers=admin_headers)
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()["data"]]
        assert task["id"] in ids

    def test_employee_status_update(self, emp_headers, task):
        r = requests.patch(f"{API}/tasks/{task['id']}/status",
                           json={"status": "in_progress"}, headers=emp_headers)
        assert r.status_code == 200
        # Verify
        rg = requests.get(f"{API}/tasks/{task['id']}", headers=emp_headers)
        assert rg.json()["data"]["task"]["status"] == "in_progress"

    def test_admin_cannot_update_status(self, admin_headers, task):
        r = requests.patch(f"{API}/tasks/{task['id']}/status",
                           json={"status": "done"}, headers=admin_headers)
        assert r.status_code == 403

    def test_employee_done_then_admin_review(self, emp_headers, admin_headers, task):
        r1 = requests.patch(f"{API}/tasks/{task['id']}/status",
                            json={"status": "done"}, headers=emp_headers)
        assert r1.status_code == 200
        r2 = requests.patch(f"{API}/tasks/{task['id']}/review",
                            json={"status": "approved", "remark": "great"}, headers=admin_headers)
        assert r2.status_code == 200
        rg = requests.get(f"{API}/tasks/{task['id']}", headers=admin_headers)
        assert rg.json()["data"]["task"]["status"] == "approved"

    def test_remarks_both_roles(self, emp_headers, admin_headers, task):
        r1 = requests.post(f"{API}/tasks/{task['id']}/remarks",
                           json={"remark": "emp note"}, headers=emp_headers)
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/tasks/{task['id']}/remarks",
                           json={"remark": "admin note"}, headers=admin_headers)
        assert r2.status_code == 200


# ===== Notifications =====
class TestNotifications:
    def test_employee_has_task_notif(self, emp_headers, task):
        r = requests.get(f"{API}/notifications", headers=emp_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "items" in data and "unread_count" in data
        # At least one notif referencing this task
        assert any(n.get("reference_id") == task["id"] for n in data["items"])

    def test_mark_one_read(self, emp_headers, task):
        r = requests.get(f"{API}/notifications", headers=emp_headers)
        items = r.json()["data"]["items"]
        unread = next((n for n in items if not n.get("is_read")), None)
        if unread:
            rr = requests.patch(f"{API}/notifications/{unread['id']}/read", headers=emp_headers)
            assert rr.status_code == 200

    def test_mark_all_read(self, emp_headers):
        r = requests.patch(f"{API}/notifications/read-all", headers=emp_headers)
        assert r.status_code == 200
        rg = requests.get(f"{API}/notifications", headers=emp_headers)
        assert rg.json()["data"]["unread_count"] == 0


# ===== Sheets =====
class TestSheets:
    def test_today_sheet_create(self, emp_headers):
        r = requests.get(f"{API}/sheets/today", headers=emp_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "sheet" in data and "template" in data
        assert data["sheet"]["status"] in ("draft", "on_leave", "submitted")
        assert len(data["template"]) >= 1

    def test_save_draft(self, emp_headers):
        r = requests.get(f"{API}/sheets/today", headers=emp_headers)
        template = r.json()["data"]["template"]
        # Skip if already on_leave/submitted
        if r.json()["data"]["sheet"]["status"] != "draft":
            pytest.skip("Sheet not in draft state")
        entries = [{"template_id": t["id"], "status": "done", "remarks": ""} for t in template[:1]]
        rd = requests.post(f"{API}/sheets/draft", json={"entries": entries}, headers=emp_headers)
        assert rd.status_code == 200

    def test_submit_missing_required_fails(self, emp_headers):
        r = requests.get(f"{API}/sheets/today", headers=emp_headers)
        if r.json()["data"]["sheet"]["status"] != "draft":
            pytest.skip("Sheet not in draft state")
        rs = requests.post(f"{API}/sheets/submit", json={"entries": []}, headers=emp_headers)
        assert rs.status_code == 400

    def test_submit_full(self, emp_headers):
        r = requests.get(f"{API}/sheets/today", headers=emp_headers)
        data = r.json()["data"]
        if data["sheet"]["status"] != "draft":
            pytest.skip("Sheet not in draft state")
        entries = [{"template_id": t["id"], "status": "done", "remarks": ""} for t in data["template"]]
        rs = requests.post(f"{API}/sheets/submit", json={"entries": entries}, headers=emp_headers)
        assert rs.status_code == 200
        # Resubmit returns 400
        rs2 = requests.post(f"{API}/sheets/submit", json={"entries": entries}, headers=emp_headers)
        assert rs2.status_code == 400

    def test_admin_list_sheets(self, admin_headers, employee):
        r = requests.get(f"{API}/sheets", headers=admin_headers,
                         params={"employee_id": employee["id"]})
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)


# ===== Leaves =====
class TestLeaves:
    def test_apply_leave(self, emp_headers, admin_headers, employee):
        # Use a future date to avoid impacting today's sheet test
        f = (date.today() + timedelta(days=5)).isoformat()
        t = (date.today() + timedelta(days=5)).isoformat()
        r = requests.post(f"{API}/leaves",
                          json={"leave_type": "casual", "from_date": f, "to_date": t,
                                "reason": "vacation"},
                          headers=emp_headers)
        assert r.status_code == 200
        leave_id = r.json()["data"]["id"]
        # Approve
        ra = requests.patch(f"{API}/leaves/{leave_id}/approve",
                            json={"admin_comment": "ok"}, headers=admin_headers)
        assert ra.status_code == 200
        # Verify leave balance increased used
        rb = requests.get(f"{API}/leaves/balance/{employee['id']}", headers=admin_headers)
        assert rb.json()["data"]["casual_used"] >= 1

    def test_apply_leave_today_sets_sheet_on_leave(self, admin_headers):
        # Create a separate fresh employee so today's sheet isn't already submitted
        suffix = uuid.uuid4().hex[:6]
        ec = requests.post(f"{API}/employees", json={
            "name": f"TEST_LV_{suffix}",
            "email": f"lv_{suffix}@x.com",
            "password": "Test1234!",
            "department": "QA",
        }, headers=admin_headers).json()["data"]
        tok = requests.post(f"{API}/auth/login",
                            json={"email": ec["email"], "password": "Test1234!"}).json()["token"]
        eh = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

        today = date.today().isoformat()
        r = requests.post(f"{API}/leaves",
                          json={"leave_type": "casual", "from_date": today, "to_date": today,
                                "reason": "sick"}, headers=eh)
        leave_id = r.json()["data"]["id"]
        ra = requests.patch(f"{API}/leaves/{leave_id}/approve",
                            json={"admin_comment": ""}, headers=admin_headers)
        assert ra.status_code == 200
        # Today's sheet should now be on_leave
        rs = requests.get(f"{API}/sheets/today", headers=eh)
        assert rs.json()["data"]["sheet"]["status"] == "on_leave"

    def test_reject_leave(self, emp_headers, admin_headers):
        f = (date.today() + timedelta(days=10)).isoformat()
        r = requests.post(f"{API}/leaves",
                          json={"leave_type": "wfh", "from_date": f, "to_date": f,
                                "reason": "wfh"}, headers=emp_headers)
        lid = r.json()["data"]["id"]
        rj = requests.patch(f"{API}/leaves/{lid}/reject",
                            json={"admin_comment": "no"}, headers=admin_headers)
        assert rj.status_code == 200

    def test_cancel_pending_leave(self, emp_headers):
        f = (date.today() + timedelta(days=15)).isoformat()
        r = requests.post(f"{API}/leaves",
                          json={"leave_type": "casual", "from_date": f, "to_date": f,
                                "reason": "x"}, headers=emp_headers)
        lid = r.json()["data"]["id"]
        rd = requests.delete(f"{API}/leaves/{lid}", headers=emp_headers)
        assert rd.status_code == 200


# ===== Dashboards =====
class TestDashboards:
    def test_admin_dashboard(self, admin_headers):
        r = requests.get(f"{API}/dashboard/admin", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        for k in ("metrics", "weekly_completion", "submission_trend", "status_distribution", "recent_activity"):
            assert k in data

    def test_employee_dashboard(self, emp_headers):
        r = requests.get(f"{API}/dashboard/employee", headers=emp_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        for k in ("today_sheet_status", "pending_tasks", "leave_balance", "recent_remarks"):
            assert k in data

    def test_employee_cannot_access_admin_dashboard(self, emp_headers):
        r = requests.get(f"{API}/dashboard/admin", headers=emp_headers)
        assert r.status_code == 403


# ===== Reports =====
class TestReports:
    def test_reports_admin(self, admin_headers):
        r = requests.get(f"{API}/reports", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "rows" in data and "from" in data and "to" in data
        for row in data["rows"]:
            assert "productivity_score" in row

    def test_reports_employee_forbidden(self, emp_headers):
        r = requests.get(f"{API}/reports", headers=emp_headers)
        assert r.status_code == 403
