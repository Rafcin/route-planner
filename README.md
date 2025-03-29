# Route Planner

A high-performance API and web application for optimizing multi-stop routes using the Traveling Salesperson Problem (TSP) algorithm.

![Route Planner Interface](/static/Screenshot%202025-03-29%20at%202.51.21%20PM.png)

## Features

- **Route Optimization**: Efficiently orders stops to minimize total travel distance
- **Distance Calculation**: Uses Haversine formula for accurate geographic distances
- **Configurable Solver**: Adjustable time limits and search strategies
- **Web Interface**: Interactive map visualization with Leaflet.js
- **REST API**: Well-documented endpoints for integration
- **Outlier Filtering**: Optional removal of distant locations
- **Duration Estimation**: Travel time calculations based on configurable speeds

## Demo

Visit the web interface at `http://localhost:8000` after starting the server to try the route planner.

## Installation

### Prerequisites

- Python 3.8+
- pip

### Option 1: Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/route-planner.git
   cd route-planner
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the development server:
   ```bash
   uvicorn app.main:app --reload
   ```

### Option 2: Docker

1. Build the Docker image:
   ```bash
   docker build -t route-planner .
   ```

2. Run the container:
   ```bash
   docker run -p 8000:8000 route-planner
   ```

## Usage

### Web Interface

1. Open `http://localhost:8000` in your browser
2. Enter locations (latitude, longitude)
3. Configure solver parameters (optional)
4. Click "Optimize Route" to view the result

### API

Optimize a route with the API:

```bash
curl -X POST "http://localhost:8000/routing/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {"id": "depot", "lat": 40.7128, "lng": -74.0060},
      {"id": "stop1", "lat": 40.7282, "lng": -73.7949},
      {"id": "stop2", "lat": 40.6782, "lng": -73.9442}
    ],
    "parameters": {
      "depot_index": 0,
      "time_limit_seconds": 5,
      "local_search_strategy": "GUIDED_LOCAL_SEARCH",
      "first_solution_strategy": "PATH_CHEAPEST_ARC",
      "filter_outliers": false,
      "average_speed_kmh": 35
    }
  }'
```

## API Documentation

Access the Swagger UI documentation at `http://localhost:8000/docs`.

## Configuration

Configuration is managed through environment variables or a `.env` file:

- `API_KEY_ENABLED`: Enable/disable API key authentication (default: false)
- `LOG_LEVEL`: Logging level (default: INFO)
- `DEFAULT_TIME_LIMIT`: Default solver time limit in seconds (default: 5)
- `DEFAULT_SPEED_KMH`: Default average speed in km/h (default: 35)

## Advanced Usage

### Solver Strategies

The route planner supports various OR-Tools strategies:

#### First Solution Strategies:
- `PATH_CHEAPEST_ARC`: Quick, greedy approach
- `CHRISTOFIDES`: Better quality, slower runtime
- `SAVINGS`: Good balance of quality and speed

#### Local Search Strategies:
- `GUIDED_LOCAL_SEARCH`: Best quality for most cases
- `SIMULATED_ANNEALING`: Good for complex routes
- `TABU_SEARCH`: Helps avoid local optima

### Outlier Filtering

Enable outlier filtering to remove locations far from the route's geographic center:

```json
{
  "parameters": {
    "filter_outliers": true,
    "outlier_factor": 2.5
  }
}
```

## Development

### Project Structure

```
route-planner/
├── app/
│   ├── config.py         # Configuration settings
│   ├── main.py           # FastAPI application
│   ├── models/           # Data models
│   ├── routers/          # API endpoints
│   └── services/         # Business logic
├── static/               # Web interface assets
├── tests/                # Test suite
└── requirements.txt      # Dependencies
```

### Running Tests

```bash
pytest
```

### Performance Testing

```bash
python test_solver_time.py
```

## License

This project is released under the MIT License. See the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgements

- [Google OR-Tools](https://developers.google.com/optimization) for TSP solving
- [FastAPI](https://fastapi.tiangolo.com/) for the API framework
- [Leaflet.js](https://leafletjs.com/) for map visualization