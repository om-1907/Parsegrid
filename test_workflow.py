import requests
import time
import uuid

BASE_URL = "http://localhost:8000/api/v1"

# 1. Register a test user
unique_id = uuid.uuid4().hex[:8]
email = f"test_{unique_id}@example.com"
password = "TestPassword123!"

session = requests.Session()

print(f"Registering user: {email}")
resp = session.post(f"{BASE_URL}/auth/register", json={
    "email": email,
    "password": password,
    "full_name": "Test User"
})
if resp.status_code != 200:
    print(f"Registration failed: {resp.text}")
    exit(1)

print("Logging in...")
resp = session.post(f"{BASE_URL}/auth/login", data={
    "username": email,
    "password": password
})
if resp.status_code != 200:
    print(f"Login failed: {resp.text}")
    exit(1)

print("Login successful.")

def upload_file(filepath, doc_type):
    with open(filepath, "rb") as f:
        print(f"Uploading {filepath} as {doc_type}...")
        resp = session.post(f"{BASE_URL}/upload", files={"file": f}, data={"document_type": doc_type})
        if resp.status_code not in [200, 202]:
            print(f"Upload failed: {resp.text}")
            return None
        data = resp.json()
        print(f"Uploaded successfully. Document ID: {data['id']}")
        return data['id']

contract_id = upload_file("sample_contract.txt", "contract")
resume_id = upload_file("sample_resume.txt", "resume")

def poll_status(doc_id):
    if not doc_id: return
    print(f"Polling status for {doc_id}...")
    for _ in range(30):
        resp = session.get(f"{BASE_URL}/status/{doc_id}")
        if resp.status_code == 200:
            status = resp.json()['status']
            print(f"Status for {doc_id}: {status}")
            if status in ["completed", "failed"]:
                return status
        time.sleep(2)
    print("Polling timed out.")
    return None

poll_status(contract_id)
poll_status(resume_id)

print("\n--- Querying Extracted Contracts ---")
resp = session.get(f"{BASE_URL}/query")
if resp.status_code == 200:
    import json
    print(json.dumps(resp.json(), indent=2))
else:
    print(f"Query failed: {resp.text}")

print("\n--- Querying Extracted Resumes ---")
resp = session.get(f"{BASE_URL}/query/resumes")
if resp.status_code == 200:
    import json
    print(json.dumps(resp.json(), indent=2))
else:
    print(f"Resume query failed: {resp.text}")
