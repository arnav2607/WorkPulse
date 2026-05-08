"""
Backend test suite for WorkPulse new enhancements
Tests employee creation, password change, activity assignment, role promotion, and leave balance features
"""
import requests
import time
from datetime import datetime

# Backend URL from environment
BASE_URL = "https://2ba5484c-6b73-433c-acdf-8203d2041584.preview.emergentagent.com/api"

# Admin credentials (seeded)
ADMIN_EMAIL = "arnavpgoel@gmail.com"
ADMIN_PASSWORD = "arnav2607"

# Test results tracking
test_results = []

def log_test(test_name, passed, details=""):
    """Log test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    result = f"{status}: {test_name}"
    if details:
        result += f" - {details}"
    test_results.append(result)
    print(result)
    return passed

def admin_login():
    """Login as admin and return token"""
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token")
    else:
        print(f"Admin login failed: {response.status_code} - {response.text}")
        return None

def test_1_create_employee_with_password_flag():
    """Test 1: POST /api/employees - must_change_password and initial_password"""
    print("\n=== Test 1: Create Employee with Password Flag ===")
    token = admin_login()
    if not token:
        return log_test("Test 1: Admin login", False, "Could not login as admin")
    
    timestamp = int(time.time())
    new_employee = {
        "name": f"Test Employee {timestamp}",
        "email": f"btest-{timestamp}@example.com",
        "password": "initial123",
        "department": "Engineering",
        "role": "employee"
    }
    
    response = requests.post(
        f"{BASE_URL}/employees",
        json=new_employee,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 1: Create employee", False, f"Status {response.status_code}: {response.text}")
    
    data = response.json()
    employee_data = data.get("data", {})
    
    # Check must_change_password is True
    if not employee_data.get("must_change_password"):
        return log_test("Test 1: must_change_password flag", False, "Flag not set to True")
    
    # Check initial_password is returned
    if employee_data.get("initial_password") != "initial123":
        return log_test("Test 1: initial_password in response", False, f"Got: {employee_data.get('initial_password')}")
    
    # Check assigned_template_ids is null
    if employee_data.get("assigned_template_ids") is not None:
        return log_test("Test 1: assigned_template_ids default", False, f"Expected null, got: {employee_data.get('assigned_template_ids')}")
    
    log_test("Test 1: Create employee", True, "All fields correct")
    
    # Store for later tests
    return {
        "email": new_employee["email"],
        "password": "initial123",
        "id": employee_data.get("id")
    }

def test_2_login_new_employee(employee_creds):
    """Test 2: POST /api/auth/login - returns must_change_password: true"""
    print("\n=== Test 2: Login New Employee ===")
    
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": employee_creds["email"],
        "password": employee_creds["password"]
    })
    
    if response.status_code != 200:
        return log_test("Test 2: Login new employee", False, f"Status {response.status_code}: {response.text}")
    
    data = response.json()
    user_data = data.get("user", {})
    
    if not user_data.get("must_change_password"):
        return log_test("Test 2: must_change_password in login", False, "Flag not True in login response")
    
    log_test("Test 2: Login new employee", True, "must_change_password flag present")
    return data.get("token")

def test_3_change_password_flow(employee_creds, employee_token):
    """Test 3: POST /api/auth/change-password - full flow"""
    print("\n=== Test 3: Change Password Flow ===")
    
    # Test 3a: Wrong current password
    response = requests.post(
        f"{BASE_URL}/auth/change-password",
        json={"current_password": "wrongpass", "new_password": "newpass123"},
        headers={"Authorization": f"Bearer {employee_token}"}
    )
    if response.status_code != 400:
        log_test("Test 3a: Wrong current password", False, f"Expected 400, got {response.status_code}")
    else:
        log_test("Test 3a: Wrong current password", True, "Correctly rejected")
    
    # Test 3b: New password too short
    response = requests.post(
        f"{BASE_URL}/auth/change-password",
        json={"current_password": employee_creds["password"], "new_password": "short"},
        headers={"Authorization": f"Bearer {employee_token}"}
    )
    if response.status_code != 400:
        log_test("Test 3b: Password too short", False, f"Expected 400, got {response.status_code}")
    else:
        log_test("Test 3b: Password too short", True, "Correctly rejected")
    
    # Test 3c: Same password rejection
    response = requests.post(
        f"{BASE_URL}/auth/change-password",
        json={"current_password": employee_creds["password"], "new_password": employee_creds["password"]},
        headers={"Authorization": f"Bearer {employee_token}"}
    )
    if response.status_code != 400:
        log_test("Test 3c: Same password rejection", False, f"Expected 400, got {response.status_code}")
    else:
        log_test("Test 3c: Same password rejection", True, "Correctly rejected")
    
    # Test 3d: Successful password change
    new_password = "newpass123"
    response = requests.post(
        f"{BASE_URL}/auth/change-password",
        json={"current_password": employee_creds["password"], "new_password": new_password},
        headers={"Authorization": f"Bearer {employee_token}"}
    )
    if response.status_code != 200:
        log_test("Test 3d: Successful password change", False, f"Status {response.status_code}: {response.text}")
        return None
    
    log_test("Test 3d: Successful password change", True)
    
    # Test 3e: Verify must_change_password is now False
    response = requests.get(
        f"{BASE_URL}/auth/me",
        headers={"Authorization": f"Bearer {employee_token}"}
    )
    if response.status_code == 200:
        me_data = response.json().get("data", {})
        if me_data.get("must_change_password") == False:
            log_test("Test 3e: must_change_password now False", True)
        else:
            log_test("Test 3e: must_change_password now False", False, f"Still: {me_data.get('must_change_password')}")
    else:
        log_test("Test 3e: Verify flag via /me", False, f"Status {response.status_code}")
    
    # Test 3f: Old password should fail
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": employee_creds["email"],
        "password": employee_creds["password"]
    })
    if response.status_code == 401:
        log_test("Test 3f: Old password fails", True)
    else:
        log_test("Test 3f: Old password fails", False, f"Got status {response.status_code}")
    
    # Test 3g: New password should work
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": employee_creds["email"],
        "password": new_password
    })
    if response.status_code == 200:
        log_test("Test 3g: New password works", True)
        return response.json().get("token")
    else:
        log_test("Test 3g: New password works", False, f"Status {response.status_code}")
        return None

def test_4_get_employee_activities(employee_id):
    """Test 4: GET /api/employees/{id}/activities"""
    print("\n=== Test 4: Get Employee Activities ===")
    token = admin_login()
    
    response = requests.get(
        f"{BASE_URL}/employees/{employee_id}/activities",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 4: Get activities", False, f"Status {response.status_code}: {response.text}")
    
    data = response.json().get("data", {})
    
    # Check structure
    if "all_templates" not in data:
        return log_test("Test 4: all_templates field", False, "Missing field")
    
    if "assigned_ids" not in data:
        return log_test("Test 4: assigned_ids field", False, "Missing field")
    
    if "is_all" not in data:
        return log_test("Test 4: is_all field", False, "Missing field")
    
    # For freshly created employee, is_all should be True
    if not data.get("is_all"):
        return log_test("Test 4: is_all=True for new employee", False, f"Got: {data.get('is_all')}")
    
    # assigned_ids should equal all active template IDs
    all_template_ids = [t["id"] for t in data.get("all_templates", [])]
    assigned_ids = data.get("assigned_ids", [])
    
    if set(assigned_ids) != set(all_template_ids):
        return log_test("Test 4: assigned_ids matches all templates", False, 
                       f"Assigned: {len(assigned_ids)}, All: {len(all_template_ids)}")
    
    log_test("Test 4: Get employee activities", True, f"is_all=True, {len(assigned_ids)} templates")
    return all_template_ids

def test_5_set_employee_activities(employee_id, all_template_ids):
    """Test 5: PUT /api/employees/{id}/activities"""
    print("\n=== Test 5: Set Employee Activities ===")
    token = admin_login()
    
    if len(all_template_ids) < 2:
        return log_test("Test 5: Set activities", False, "Need at least 2 templates for testing")
    
    # Test 5a: Set to specific subset
    subset_ids = all_template_ids[:2]
    response = requests.put(
        f"{BASE_URL}/employees/{employee_id}/activities",
        json={"template_ids": subset_ids},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_test("Test 5a: Set specific activities", False, f"Status {response.status_code}: {response.text}")
    else:
        log_test("Test 5a: Set specific activities", True)
    
    # Test 5b: Verify the change
    response = requests.get(
        f"{BASE_URL}/employees/{employee_id}/activities",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        data = response.json().get("data", {})
        if data.get("is_all") == False and set(data.get("assigned_ids", [])) == set(subset_ids):
            log_test("Test 5b: Verify subset assignment", True, f"is_all=False, {len(subset_ids)} templates")
        else:
            log_test("Test 5b: Verify subset assignment", False, 
                    f"is_all={data.get('is_all')}, assigned={len(data.get('assigned_ids', []))}")
    else:
        log_test("Test 5b: Verify subset assignment", False, f"Status {response.status_code}")
    
    # Test 5c: Reset to "all" with null
    response = requests.put(
        f"{BASE_URL}/employees/{employee_id}/activities",
        json={"template_ids": None},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        log_test("Test 5c: Reset to all (null)", False, f"Status {response.status_code}: {response.text}")
    else:
        log_test("Test 5c: Reset to all (null)", True)
    
    # Test 5d: Verify reset
    response = requests.get(
        f"{BASE_URL}/employees/{employee_id}/activities",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code == 200:
        data = response.json().get("data", {})
        if data.get("is_all") == True:
            log_test("Test 5d: Verify reset to all", True, "is_all=True")
        else:
            log_test("Test 5d: Verify reset to all", False, f"is_all={data.get('is_all')}")
    else:
        log_test("Test 5d: Verify reset to all", False, f"Status {response.status_code}")
    
    return subset_ids

def test_6_sheets_today_limited_employee(employee_id, subset_ids):
    """Test 6: GET /api/sheets/today for employee with limited assignment"""
    print("\n=== Test 6: Sheets Today for Limited Employee ===")
    token = admin_login()
    
    # First, set employee to limited assignment
    response = requests.put(
        f"{BASE_URL}/employees/{employee_id}/activities",
        json={"template_ids": subset_ids},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 6: Setup limited assignment", False, f"Status {response.status_code}")
    
    # Login as the limited employee
    # Need to get employee credentials - create a new test employee for this
    timestamp = int(time.time())
    new_emp = {
        "name": f"Limited Employee {timestamp}",
        "email": f"limited-{timestamp}@example.com",
        "password": "testpass123",
        "department": "Testing",
        "role": "employee"
    }
    
    response = requests.post(
        f"{BASE_URL}/employees",
        json=new_emp,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 6: Create limited employee", False, f"Status {response.status_code}")
    
    limited_emp_id = response.json()["data"]["id"]
    
    # Set limited assignment
    response = requests.put(
        f"{BASE_URL}/employees/{limited_emp_id}/activities",
        json={"template_ids": subset_ids},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    # Login as limited employee
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": new_emp["email"],
        "password": new_emp["password"]
    })
    
    if response.status_code != 200:
        return log_test("Test 6: Login limited employee", False, f"Status {response.status_code}")
    
    limited_token = response.json()["token"]
    
    # Get today's sheet
    response = requests.get(
        f"{BASE_URL}/sheets/today",
        headers={"Authorization": f"Bearer {limited_token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 6: Get sheets/today", False, f"Status {response.status_code}: {response.text}")
    
    data = response.json().get("data", {})
    templates = data.get("template", [])
    
    if len(templates) != len(subset_ids):
        return log_test("Test 6: Template count matches assignment", False, 
                       f"Expected {len(subset_ids)}, got {len(templates)}")
    
    log_test("Test 6: Sheets today for limited employee", True, f"{len(templates)} templates returned")
    return {"id": limited_emp_id, "token": limited_token, "subset_ids": subset_ids}

def test_7_submit_sheet_limited_employee(limited_emp_data):
    """Test 7: POST /api/sheets/submit for limited employee"""
    print("\n=== Test 7: Submit Sheet for Limited Employee ===")
    
    # Get today's sheet to see what templates are assigned
    response = requests.get(
        f"{BASE_URL}/sheets/today",
        headers={"Authorization": f"Bearer {limited_emp_data['token']}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 7: Get today sheet", False, f"Status {response.status_code}")
    
    data = response.json().get("data", {})
    templates = data.get("template", [])
    
    # Create entries for only the assigned templates
    entries = []
    for template in templates:
        if template.get("is_required", True):
            entries.append({
                "template_id": template["id"],
                "status": "done",
                "remarks": "Test completion"
            })
    
    # Submit the sheet
    response = requests.post(
        f"{BASE_URL}/sheets/submit",
        json={"entries": entries},
        headers={"Authorization": f"Bearer {limited_emp_data['token']}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 7: Submit limited sheet", False, 
                       f"Status {response.status_code}: {response.text}")
    
    log_test("Test 7: Submit sheet for limited employee", True, 
            f"Submitted {len(entries)} entries without 'all required missing' error")
    return True

def test_8_role_promotion(employee_id):
    """Test 8: PATCH /api/employees/{id} - role promotion"""
    print("\n=== Test 8: Role Promotion ===")
    token = admin_login()
    
    # Create a new employee for role testing
    timestamp = int(time.time())
    new_emp = {
        "name": f"Role Test Employee {timestamp}",
        "email": f"roletest-{timestamp}@example.com",
        "password": "testpass123",
        "department": "Testing",
        "role": "employee"
    }
    
    response = requests.post(
        f"{BASE_URL}/employees",
        json=new_emp,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 8: Create test employee", False, f"Status {response.status_code}")
    
    test_emp_id = response.json()["data"]["id"]
    
    # Login as employee
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": new_emp["email"],
        "password": new_emp["password"]
    })
    
    if response.status_code != 200:
        return log_test("Test 8: Login test employee", False, f"Status {response.status_code}")
    
    emp_token = response.json()["token"]
    
    # Test 8a: Try to access admin endpoint (should fail)
    response = requests.get(
        f"{BASE_URL}/employees",
        headers={"Authorization": f"Bearer {emp_token}"}
    )
    
    if response.status_code == 403:
        log_test("Test 8a: Employee cannot access admin endpoint", True)
    else:
        log_test("Test 8a: Employee cannot access admin endpoint", False, f"Got status {response.status_code}")
    
    # Test 8b: Promote to admin
    response = requests.patch(
        f"{BASE_URL}/employees/{test_emp_id}",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 8b: Promote to admin", False, f"Status {response.status_code}: {response.text}")
    
    log_test("Test 8b: Promote to admin", True)
    
    # Login again to get new token with admin role
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": new_emp["email"],
        "password": new_emp["password"]
    })
    
    if response.status_code != 200:
        return log_test("Test 8c: Re-login after promotion", False, f"Status {response.status_code}")
    
    admin_token = response.json()["token"]
    
    # Test 8c: Now can access admin endpoint
    response = requests.get(
        f"{BASE_URL}/employees",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    
    if response.status_code == 200:
        log_test("Test 8c: Admin can access admin endpoint", True)
    else:
        log_test("Test 8c: Admin can access admin endpoint", False, f"Status {response.status_code}")
    
    # Test 8d: Demote back to employee
    response = requests.patch(
        f"{BASE_URL}/employees/{test_emp_id}",
        json={"role": "employee"},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 8d: Demote to employee", False, f"Status {response.status_code}")
    
    log_test("Test 8d: Demote to employee", True)
    
    # Login again
    response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": new_emp["email"],
        "password": new_emp["password"]
    })
    
    if response.status_code != 200:
        return log_test("Test 8e: Re-login after demotion", False, f"Status {response.status_code}")
    
    emp_token_again = response.json()["token"]
    
    # Test 8e: Cannot access admin endpoint again
    response = requests.get(
        f"{BASE_URL}/employees",
        headers={"Authorization": f"Bearer {emp_token_again}"}
    )
    
    if response.status_code == 403:
        log_test("Test 8e: Demoted employee cannot access admin endpoint", True)
    else:
        log_test("Test 8e: Demoted employee cannot access admin endpoint", False, f"Got status {response.status_code}")
    
    return True

def test_9_leave_balance_breakdown(employee_id):
    """Test 9: GET /api/leaves/balance/{employee_id}"""
    print("\n=== Test 9: Leave Balance Breakdown ===")
    token = admin_login()
    
    # Create a new employee for leave testing
    timestamp = int(time.time())
    new_emp = {
        "name": f"Leave Test Employee {timestamp}",
        "email": f"leavetest-{timestamp}@example.com",
        "password": "testpass123",
        "department": "Testing",
        "role": "employee"
    }
    
    response = requests.post(
        f"{BASE_URL}/employees",
        json=new_emp,
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 9: Create test employee", False, f"Status {response.status_code}")
    
    test_emp_id = response.json()["data"]["id"]
    
    # Get balance
    response = requests.get(
        f"{BASE_URL}/leaves/balance/{test_emp_id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 9: Get leave balance", False, f"Status {response.status_code}: {response.text}")
    
    data = response.json().get("data", {})
    
    # Check for total_taken_ytd
    if "total_taken_ytd" not in data:
        return log_test("Test 9: total_taken_ytd field", False, "Missing field")
    
    # Check for by_type
    if "by_type" not in data:
        return log_test("Test 9: by_type field", False, "Missing field")
    
    by_type = data.get("by_type", {})
    
    # Check all leave types are present
    required_types = ["casual", "sick", "half_day", "wfh"]
    for leave_type in required_types:
        if leave_type not in by_type:
            return log_test("Test 9: by_type has all leave types", False, f"Missing {leave_type}")
    
    # For new employee with no approved leaves, all should be 0
    if data.get("total_taken_ytd") != 0:
        log_test("Test 9: total_taken_ytd is 0 for new employee", False, f"Got: {data.get('total_taken_ytd')}")
    else:
        log_test("Test 9: total_taken_ytd is 0 for new employee", True)
    
    all_zero = all(by_type.get(t, -1) == 0 for t in required_types)
    if not all_zero:
        log_test("Test 9: All by_type entries are 0", False, f"Got: {by_type}")
    else:
        log_test("Test 9: All by_type entries are 0", True)
    
    log_test("Test 9: Leave balance breakdown", True, f"total_taken_ytd={data.get('total_taken_ytd')}, by_type present")
    return True

def test_10_employees_with_balance():
    """Test 10: GET /api/employees?include_balance=true"""
    print("\n=== Test 10: Employees with Balance ===")
    token = admin_login()
    
    response = requests.get(
        f"{BASE_URL}/employees?include_balance=true",
        headers={"Authorization": f"Bearer {token}"}
    )
    
    if response.status_code != 200:
        return log_test("Test 10: Get employees with balance", False, f"Status {response.status_code}: {response.text}")
    
    data = response.json().get("data", [])
    
    if len(data) == 0:
        return log_test("Test 10: Employees list", False, "No employees returned")
    
    # Check first employee has balance object
    first_emp = data[0]
    if "balance" not in first_emp:
        return log_test("Test 10: balance field present", False, "Missing balance field")
    
    balance = first_emp.get("balance", {})
    
    # Check required fields in balance
    required_fields = ["casual_total", "sick_total", "casual_used", "sick_used", "total_taken_ytd"]
    for field in required_fields:
        if field not in balance:
            return log_test("Test 10: balance has all fields", False, f"Missing {field}")
    
    log_test("Test 10: Employees with balance", True, 
            f"{len(data)} employees, balance includes: {', '.join(required_fields)}")
    return True

def main():
    """Run all tests"""
    print("=" * 80)
    print("WorkPulse Backend Test Suite - New Enhancements")
    print("=" * 80)
    
    # Test 1: Create employee
    employee_creds = test_1_create_employee_with_password_flag()
    if not employee_creds:
        print("\n❌ Test 1 failed, cannot continue with dependent tests")
        return
    
    # Test 2: Login new employee
    employee_token = test_2_login_new_employee(employee_creds)
    if not employee_token:
        print("\n❌ Test 2 failed, cannot continue with password change tests")
    else:
        # Test 3: Change password flow
        test_3_change_password_flow(employee_creds, employee_token)
    
    # Test 4: Get employee activities
    all_template_ids = test_4_get_employee_activities(employee_creds["id"])
    if all_template_ids:
        # Test 5: Set employee activities
        subset_ids = test_5_set_employee_activities(employee_creds["id"], all_template_ids)
        
        if subset_ids:
            # Test 6: Sheets today for limited employee
            limited_emp_data = test_6_sheets_today_limited_employee(employee_creds["id"], subset_ids)
            
            if limited_emp_data:
                # Test 7: Submit sheet for limited employee
                test_7_submit_sheet_limited_employee(limited_emp_data)
    
    # Test 8: Role promotion
    test_8_role_promotion(employee_creds["id"])
    
    # Test 9: Leave balance breakdown
    test_9_leave_balance_breakdown(employee_creds["id"])
    
    # Test 10: Employees with balance
    test_10_employees_with_balance()
    
    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    for result in test_results:
        print(result)
    
    passed = sum(1 for r in test_results if "✅" in r)
    failed = sum(1 for r in test_results if "❌" in r)
    print(f"\nTotal: {len(test_results)} tests | Passed: {passed} | Failed: {failed}")
    print("=" * 80)

if __name__ == "__main__":
    main()
