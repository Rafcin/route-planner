import requests
import json

# Extremely simplified test script to test the solver_time_limit_seconds parameter

# API endpoint
url = "http://localhost:8000/routing/optimize"

# Request data with explicit solver time limit
data = {
    "locations": [
        {"id": "depot", "latitude": 40.7128, "longitude": -74.0060},
        {"latitude": 40.7484, "longitude": -73.9857}
    ],
    "solver_time_limit_seconds": 15 
}

# API key header
headers = {
    "Content-Type": "application/json",
    "api-key": "fastapi-simple-security"
}

# Log request
print(f"Sending request with URL: {url}")
print(f"Headers: {headers}")
print(f"Request data: {json.dumps(data, indent=2)}")

# Send the request
response = requests.post(url, json=data, headers=headers)

# Print the response
print(f"Response status: {response.status_code}")
if response.status_code == 200:
    response_data = response.json()
    print(f"Response: {json.dumps(response_data, indent=2)}")
else:
    print(f"Error: {response.text}")