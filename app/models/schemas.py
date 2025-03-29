# app/models/schemas.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Union, Any
from enum import Enum
import uuid

# --- Enums for Solver Strategies ---

class LocalSearchStrategyEnum(str, Enum):
    """Strategies for improving the initial TSP solution."""
    AUTOMATIC = "AUTOMATIC"
    GREEDY_DESCENT = "GREEDY_DESCENT"
    GUIDED_LOCAL_SEARCH = "GUIDED_LOCAL_SEARCH"
    SIMULATED_ANNEALING = "SIMULATED_ANNEALING"
    TABU_SEARCH = "TABU_SEARCH"


class FirstSolutionStrategyEnum(str, Enum):
    """Strategies for finding the *initial* TSP solution."""
    AUTOMATIC = "AUTOMATIC"
    PATH_CHEAPEST_ARC = "PATH_CHEAPEST_ARC"  # Generally fast and good default
    SAVINGS = "SAVINGS"
    SWEEP = "SWEEP"
    CHRISTOFIDES = "CHRISTOFIDES" # Usually requires Euclidean distances
    ALL_UNPERFORMED = "ALL_UNPERFORMED"
    BEST_INSERTION = "BEST_INSERTION"
    PARALLEL_CHEAPEST_INSERTION = "PARALLEL_CHEAPEST_INSERTION"
    LOCAL_CHEAPEST_INSERTION = "LOCAL_CHEAPEST_INSERTION"
    GLOBAL_CHEAPEST_ARC = "GLOBAL_CHEAPEST_ARC"
    LOCAL_CHEAPEST_ARC = "LOCAL_CHEAPEST_ARC"
    FIRST_UNBOUND_MIN_VALUE = "FIRST_UNBOUND_MIN_VALUE"

# --- Location Models ---

class Location(BaseModel):
    id: Union[str, int] = Field(default_factory=lambda: uuid.uuid4().hex[:8]) # Auto-generate simple ID if none provided
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

    # Optional validator if needed
    # @validator('latitude')
    # def latitude_within_range(cls, v):
    #     if not -90 <= v <= 90:
    #         raise ValueError('Latitude must be between -90 and 90')
    #     return v
    # @validator('longitude')
    # def longitude_within_range(cls, v):
    #     if not -180 <= v <= 180:
    #         raise ValueError('Longitude must be between -180 and 180')
    #     return v

# --- Optimization Request ---

class OptimizeRequest(BaseModel):
    locations: List[Location] = Field(..., min_items=0) # Allow empty list
    average_speed_kmh: Optional[float] = Field(None, gt=0)
    outlier_threshold_km: Optional[float] = Field(None, ge=0)

    # --- New Solver Options ---
    solver_time_limit_seconds: Optional[int] = Field(
        None,
        description="Maximum time in seconds the solver is allowed to run."
    )
    
    # Extremely tolerant validator - convert almost anything to an integer
    @validator('solver_time_limit_seconds')
    def validate_time_limit(cls, v):
        # If None or empty string, return None
        if v is None or (isinstance(v, str) and v.strip() == ''):
            return None
            
        try:
            # Try to convert to integer - allow floats too and just convert to int
            v_int = int(float(str(v).strip()))
            
            # Ensure it's positive
            if v_int <= 0:
                raise ValueError("solver_time_limit_seconds must be greater than 0")
            
            # Return the valid integer
            return v_int
        except (ValueError, TypeError) as e:
            # Log error but don't fail validation
            import logging
            logging.warning(f"Invalid solver_time_limit_seconds value: {v}, error: {e}")
            return None
    local_search_strategy: Optional[LocalSearchStrategyEnum] = Field(
        None, # Default handled in service/config
        description="Metaheuristic strategy used to improve the route after finding an initial one. Affects speed vs. quality trade-off."
    )
    first_solution_strategy: Optional[FirstSolutionStrategyEnum] = Field(
        None, # Default handled in service/config
        description="Strategy used to find the very first solution before optimization begins."
    )

    # Example for request body in documentation
    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "locations": [
                        {"id": "Depot", "latitude": 40.7128, "longitude": -74.0060},
                        {"id": "Stop 1", "latitude": 40.7580, "longitude": -73.9855},
                        {"id": "Stop 2", "latitude": 40.7484, "longitude": -73.9857}
                    ],
                    "average_speed_kmh": 45.0,
                    "outlier_threshold_km": 100.0,
                    "solver_time_limit_seconds": 10,
                    "local_search_strategy": "TABU_SEARCH",
                    "first_solution_strategy": "PATH_CHEAPEST_ARC"
                }
            ]
        }
    }


# --- Optimization Response ---

class RoutePoint(BaseModel):
    id: Any # Match input ID type
    latitude: float
    longitude: float
    original_index: int
    visit_order: int
    is_depot: bool

class RouteLeg(BaseModel):
    start_location_id: Any
    end_location_id: Any
    distance_meters: float
    duration_seconds: Optional[float] = None

class RouteSummary(BaseModel):
    total_distance_meters: float
    total_duration_seconds: Optional[float] = None
    num_locations_optimized: int
    num_locations_excluded: int
    depot_id: Optional[Any] = None
    calculation_time_seconds: float

class OptimizeResponse(BaseModel):
    status: str # e.g., "success", "warning", "error"
    message: str
    summary: RouteSummary
    route: List[RoutePoint]
    legs: List[RouteLeg]

# --- Health Check Response ---
class HealthCheckResponse(BaseModel):
    status: str = "ok"
    ortools_available: bool