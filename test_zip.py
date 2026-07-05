import zipfile
import requests
import os
import json

def create_test_zip():
    with zipfile.ZipFile("test_batch.zip", "w") as z:
        z.writestr("test1.txt", "This is test document 1.")
        z.writestr("test2.md", "# Test Document 2\nThis is the second test.")
        z.writestr("test3.txt", "This is test document 3.")
        # add an invalid file
        z.writestr("test4.jpg", "invalid")
        # add a hidden file
        z.writestr(".hidden_test.txt", "hidden")

def test_upload():
    import uuid
    email = f"test_{uuid.uuid4()}@example.com"
    password = "testpassword123"
    
    # Register
    reg_res = requests.post("http://localhost:8000/api/v1/auth/register", json={"email": email, "password": password})
    print("Register:", reg_res.status_code)
    
    # Login
    log_res = requests.post("http://localhost:8000/api/v1/auth/login", data={"username": email, "password": password})
    print("Login:", log_res.status_code)
    token = log_res.json().get("access_token")
    
    # Upload
    url = "http://localhost:8000/api/v1/upload"
    headers = {"Authorization": f"Bearer {token}"}
    with open("test_batch.zip", "rb") as f:
        files = {"file": ("test_batch.zip", f, "application/zip")}
        data = {"document_type": "contract"}
        response = requests.post(url, headers=headers, files=files, data=data)
        print("Upload Status:", response.status_code)
        try:
            print(json.dumps(response.json(), indent=2))
        except:
            print(response.text)

if __name__ == "__main__":
    create_test_zip()
    test_upload()
