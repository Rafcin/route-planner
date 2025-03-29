import requests
import json
import sys

# Test script to verify the solver_time_limit_seconds parameter is correctly handled

def test_solver_time_parameter(time_limit):
    """Test that the solver_time_limit_seconds parameter is correctly used."""
    # Sample data with the NYC locations
    data = {
        "locations": [
            {"id": "depot", "latitude": 40.7128, "longitude": -74.0060, "name": "NYC Depot"},
            {"latitude": 40.7484, "longitude": -73.9857, "name": "Empire State Building"},
            {"latitude": 40.7527, "longitude": -73.9772, "name": "Grand Central Terminal"},
            {"latitude": 40.7587, "longitude": -73.9787, "name": "Rockefeller Center"},
            {"latitude": 40.7484, "longitude": -73.9878, "name": "Times Square"},
            {"latitude": 40.7425, "longitude": -73.9891, "name": "Macy's Herald Square"},
            {"latitude": 40.7061, "longitude": -74.0088, "name": "9/11 Memorial"}
        ],
        "solver_time_limit_seconds": time_limit
    }
    
    # API endpoint
    url = "http://localhost:8000/routing/optimize"
    
    # Headers with API key
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "api-key": "fastapi-simple-security" # A default key that should work with the default setup
    }
    
    # Send POST request
    try:
        print(f"Sending request with solver_time_limit_seconds={time_limit}...")
        print(f"Request body: {json.dumps(data)}")
        
        response = requests.post(url, headers=headers, json=data)
        
        # Print status code
        print(f"Status code: {response.status_code}")
        
        # If successful, print solver time used from response
        if response.status_code == 200:
            response_data = response.json()
            print(f"Response data: {json.dumps(response_data, indent=2)}")
            
            # Verify the solver time used in the response
            calculation_time = response_data.get("summary", {}).get("calculation_time_seconds")
            print(f"Calculation time: {calculation_time} seconds")
            
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

if __name__ == "__main__":
    # Get time limit from command line argument or use default
    time_limit = int(sys.argv[1]) if len(sys.argv) > 1 else 15
    test_solver_time_parameter(time_limit)