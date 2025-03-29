# app/services/tsp_solver.py
"""
This module provides functionality for solving the Traveling Salesperson Problem (TSP)
using Google OR-Tools, along with necessary utility functions for distance calculation,
matrix generation, duration estimation, and outlier filtering.
"""

import math
import logging
from typing import List, Tuple, Dict, Any, Optional
import time
from enum import Enum # Used for type hinting internal enums

# --- Standard Imports First ---
# Import enums from schemas - these are essential for function signatures and defaults
try:
    from app.models.schemas import LocalSearchStrategyEnum, FirstSolutionStrategyEnum
except ImportError as e:
    # This indicates a critical project structure issue. Log and raise.
    logging.critical(f"CRITICAL: Failed to import Enums from schemas: {e}. Application cannot function correctly without schemas.")
    # Define minimal dummy enums ONLY to allow the rest of the file to be parsed during startup/import.
    # The application will likely fail later if the real schemas are missing.
    class LocalSearchStrategyEnum(str, Enum): AUTOMATIC="AUTOMATIC"; TABU_SEARCH="TABU_SEARCH"; GUIDED_LOCAL_SEARCH="GUIDED_LOCAL_SEARCH"; PATH_CHEAPEST_ARC="PATH_CHEAPEST_ARC"
    class FirstSolutionStrategyEnum(str, Enum): AUTOMATIC="AUTOMATIC"; PATH_CHEAPEST_ARC="PATH_CHEAPEST_ARC"


# --- OR-Tools Conditional Imports and Setup ---
# Global variables to hold OR-Tools modules/constants and availability status
_ls_enum_map: Dict[str, Any] = {} # Map LocalSearchStrategyEnum names to OR-Tools constants
_fs_enum_map: Dict[str, Any] = {} # Map FirstSolutionStrategyEnum names to OR-Tools constants
ORTOOLS_AVAILABLE = False        # Flag indicating if OR-Tools was successfully imported
pywrapcp = None                  # Placeholder for the core OR-Tools routing module
routing_enums_pb2 = None         # Placeholder for the OR-Tools enums module

# Status codes relied upon based on standard OR-Tools behavior and previous debugging.
# Constant *names* (e.g., pywrapcp.ROUTING_SUCCESS) proved unreliable to find programmatically across environments.
STATUS_CODE_SUCCESS = 1 # routing.status() == 1 indicates success.
STATUS_CODE_TIMEOUT = 3 # routing.status() == 3 indicates timeout failure.

try:
    # Attempt to import the necessary OR-Tools modules
    from ortools.constraint_solver import routing_enums_pb2 as ortools_routing_enums
    from ortools.constraint_solver import pywrapcp as ortools_pywrapcp

    # Assign to global placeholders if import succeeded
    pywrapcp = ortools_pywrapcp
    routing_enums_pb2 = ortools_routing_enums
    ORTOOLS_AVAILABLE = True
    logging.info("Google OR-Tools library (ortools) loaded successfully.")

    # Build the strategy maps ONLY if OR-Tools is available.
    # Use getattr for safety, falling back to AUTOMATIC if a specific strategy
    # constant isn't found in the installed library version.
    if ORTOOLS_AVAILABLE:
        _ls_enum_map = {
            strat.name: getattr(routing_enums_pb2.LocalSearchMetaheuristic, strat.name, routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC)
            for strat in LocalSearchStrategyEnum
        }
        _fs_enum_map = {
            strat.name: getattr(routing_enums_pb2.FirstSolutionStrategy, strat.name, routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC)
            for strat in FirstSolutionStrategyEnum
        }
        logging.debug("Built OR-Tools strategy maps.", ls_map_keys=list(_ls_enum_map.keys()), fs_map_keys=list(_fs_enum_map.keys()))

except ImportError:
    # Log a warning but do NOT define dummy code for production.
    # The application should handle the ORTOOLS_AVAILABLE=False flag appropriately.
    logging.warning("Google OR-Tools library (ortools package) not found. TSP functionality will be DISABLED.")

except AttributeError as e:
    # Catch cases where OR-Tools is imported but expected constants/classes are missing
    logging.error(f"AttributeError during OR-Tools setup - library might be incomplete or unexpected version: {e}", exc_info=True)
    ORTOOLS_AVAILABLE = False # Treat as unavailable if setup fails

# --- Logger Setup ---
# Set up logging using structlog if available, otherwise standard logging
try:
    import structlog
    logger = structlog.get_logger(__name__)
except ImportError:
    logger = logging.getLogger(__name__)
    # Ensure basicConfig is called only if no handlers exist to avoid duplicates if main.py also configures logging
    if not logging.getLogger().hasHandlers():
        logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')


# ----------------------------------------------------
# Section 1: Distance & Duration Utilities
# ----------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two points on the Earth
    (specified in decimal degrees) using the Haversine formula.

    Args:
        lat1: Latitude of the first point.
        lon1: Longitude of the first point.
        lat2: Latitude of the second point.
        lon2: Longitude of the second point.

    Returns:
        The distance in meters.

    Raises:
        TypeError: If latitudes or longitudes are not numeric.
        ValueError: If the calculation fails for other reasons.
    """
    # Input type validation
    if not all(isinstance(coord, (int, float)) for coord in [lat1, lon1, lat2, lon2]):
        logger.error("Invalid coordinate type for Haversine", lat1=lat1, lon1=lon1, lat2=lat2, lon2=lon2)
        raise TypeError("Latitude and longitude must be numeric")

    R = 6371000  # Earth's mean radius in meters

    try:
        # Convert decimal degrees to radians
        phi1, lam1, phi2, lam2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula components
        dlon = lam2 - lam1
        dlat = phi2 - phi1
        a = math.sin(dlat / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        # Calculate the distance
        distance = R * c
    except Exception as e:
         # Catch potential math errors or other exceptions during calculation
         logger.error("Error during Haversine calculation", error=str(e), lat1=lat1, lon1=lon1, lat2=lat2, lon2=lon2, exc_info=True)
         raise ValueError(f"Could not calculate Haversine distance: {e}") from e

    return distance

def create_distance_matrix(locations: List[Tuple[float, float]]) -> Optional[List[List[int]]]:
    """
    Builds a symmetric 2D distance matrix using Haversine distance.
    Distances are stored as integers representing meters.

    Args:
        locations: A list of (latitude, longitude) tuples.

    Returns:
        A list of lists representing the distance matrix, or None if an error occurs
        (e.g., invalid coordinates, calculation failure). Returns an empty list if
        input `locations` is empty.
    """
    size = len(locations)
    if size == 0:
        logger.debug("Cannot create distance matrix for 0 locations.")
        return [] # Return empty list for empty input

    logger.debug(f"Creating distance matrix for {size} locations.")
    # Initialize matrix with zeros
    distance_matrix = [[0] * size for _ in range(size)]

    try:
        # Iterate through pairs of locations (only upper triangle needed due to symmetry)
        for i in range(size):
            for j in range(i + 1, size):
                try:
                    lat1, lon1 = locations[i]
                    lat2, lon2 = locations[j]

                    # Validate coordinate types within the loop for robustness
                    if not (isinstance(lat1, (int, float)) and isinstance(lon1, (int, float)) and \
                            isinstance(lat2, (int, float)) and isinstance(lon2, (int, float))):
                        logger.error("Invalid coordinates found during matrix creation", idx1=i, idx2=j, loc1=(lat1, lon1), loc2=(lat2, lon2))
                        return None # Indicate failure if coordinates are invalid

                    # Calculate distance using Haversine formula
                    d = haversine_distance(lat1, lon1, lat2, lon2)
                    # Convert to integer and ensure non-negativity
                    dist_int = int(d)
                    distance_value = max(0, dist_int)

                    # Assign distance to symmetric positions in the matrix
                    distance_matrix[i][j] = distance_value
                    distance_matrix[j][i] = distance_value

                except (TypeError, ValueError) as dist_calc_error:
                    # Handle errors during individual distance calculations
                    logger.error("Failed distance calculation for matrix entry", idx1=i, idx2=j, error=str(dist_calc_error), exc_info=True)
                    return None # Indicate failure if any distance calculation fails
    except IndexError as e:
         # Handle errors if the locations list structure is incorrect
         logger.error("Index error during distance matrix creation.", list_size=size, error=str(e), exc_info=True)
         return None
    except Exception as e:
         # Catch any other unexpected errors during matrix generation
         logger.error("Unexpected error creating distance matrix", error=str(e), exc_info=True)
         return None

    logger.debug("Distance matrix created successfully.")
    return distance_matrix

def calculate_duration_seconds(distance_meters: float, speed_kmh: float) -> Optional[float]:
    """
    Calculates estimated travel duration in seconds based on distance and average speed.

    Args:
        distance_meters: The distance of the leg in meters.
        speed_kmh: The average travel speed in kilometers per hour.

    Returns:
        Estimated duration in seconds, or None if speed is non-positive
        or distance is negative. Returns float('inf') if speed is zero but
        distance is positive.
    """
    # Validate inputs - ensure we're working with numeric values
    try:
        distance_meters = float(distance_meters)
        speed_kmh = float(speed_kmh)
    except (TypeError, ValueError) as e:
        logger.error(f"Invalid input types for duration calculation: {e}", 
                     distance_type=type(distance_meters).__name__, 
                     speed_type=type(speed_kmh).__name__)
        return None
        
    # Check for valid values
    if speed_kmh <= 0:
        logger.debug("Non-positive speed provided, cannot calculate duration.", speed_kmh=speed_kmh)
        return None
    if distance_meters < 0:
        logger.debug("Negative distance provided, cannot calculate duration.", distance_m=distance_meters)
        return None # Duration for negative distance is undefined

    try:
        # Convert speed from km/h to m/s
        speed_mps = speed_kmh * 1000 / 3600

        # Handle zero speed case (avoid division by zero)
        if speed_mps == 0:
            # If speed is zero, duration is infinite if there's distance to cover, else zero.
            return float('inf') if distance_meters > 0 else 0.0

        # Calculate duration: time = distance / speed
        duration = distance_meters / speed_mps
        logger.debug(f"Duration calculation: {distance_meters}m ÷ {speed_mps}m/s = {duration}s")
        return duration
    except ZeroDivisionError:
        # This should theoretically be caught by the speed_mps == 0 check, but included as a safeguard.
        logger.error("Division by zero encountered calculating duration (should not happen).")
        return None
    except Exception as e:
        # Catch any other potential errors during calculation
        logger.error("Error calculating duration", distance_m=distance_meters, speed_kmh=speed_kmh, error=str(e), exc_info=True)
        return None

# ----------------------------------------------------
# Section 2: Outlier Filtering
# ----------------------------------------------------

LocationMeta = Dict[str, Any] # Type alias for location dictionaries with metadata

def remove_far_outliers(locations_with_meta: List[LocationMeta], threshold_km: float) -> List[LocationMeta]:
    """
    Filters a list of locations, removing those farther than `threshold_km`
    from the geographic centroid of the valid points.

    Args:
        locations_with_meta: List of dictionaries, each containing at least
                             'lat', 'lon', 'id', 'original_index'.
        threshold_km: The maximum distance (in kilometers) from the centroid
                      for a location to be kept.

    Returns:
        A new list containing only the locations within the threshold,
        preserving the original dictionary structure. Locations with invalid
        coordinates are kept by default. Returns the original list if filtering
        is skipped or fails.
    """
    num_locations = len(locations_with_meta)
    # Skip filtering if not enough points or threshold is non-positive
    if num_locations <= 1 or threshold_km <= 0:
        logger.debug("Skipping outlier filtering (not applicable).", count=num_locations, threshold=threshold_km)
        return locations_with_meta

    logger.info("Performing outlier filtering", input_count=num_locations, threshold_km=threshold_km)

    # --- Calculate Centroid ---
    try:
        # Use only locations with valid numeric coordinates for centroid calculation
        valid_coords = [
            (loc['lat'], loc['lon'])
            for loc in locations_with_meta
            if isinstance(loc.get('lat'), (int, float)) and isinstance(loc.get('lon'), (int, float))
        ]

        if not valid_coords:
             # Cannot calculate centroid if no valid points exist
             logger.error("Cannot compute centroid for outlier filtering: No valid coordinates found in the input list.")
             return locations_with_meta # Return original list as filtering cannot be performed

        # Calculate average latitude and longitude
        avg_lat = sum(lat for lat, lon in valid_coords) / len(valid_coords)
        avg_lon = sum(lon for lat, lon in valid_coords) / len(valid_coords)
        logger.debug("Calculated centroid for outlier check.", avg_lat=avg_lat, avg_lon=avg_lon)

    except Exception as e:
        # Log error and return original list if centroid calculation fails
        logger.error("Could not compute centroid, skipping outlier filtering.", error=str(e), exc_info=True)
        return locations_with_meta
    # --- End Centroid Calculation ---

    # Convert threshold to meters for distance comparison
    threshold_meters = threshold_km * 1000
    filtered_locations: List[LocationMeta] = []
    excluded_count = 0

    # --- Filter Locations ---
    for loc_data in locations_with_meta:
        try:
            lat, lon = loc_data.get('lat'), loc_data.get('lon')

            # Keep locations that have invalid coordinates (cannot calculate distance)
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                 logger.warning("Keeping location with invalid coordinates during outlier filtering.", location_id=loc_data.get('id', 'N/A'))
                 filtered_locations.append(loc_data)
                 continue

            # Calculate distance from the calculated centroid
            dist_meters = haversine_distance(lat, lon, avg_lat, avg_lon)

            # Keep the location if it's within the distance threshold
            if dist_meters <= threshold_meters:
                filtered_locations.append(loc_data)
            else:
                # Exclude the location if it's beyond the threshold
                excluded_count += 1
                logger.debug("Filtering outlier location.",
                              location_id=loc_data.get('id', 'N/A'),
                              original_index=loc_data.get('original_index', 'N/A'),
                              distance_m=round(dist_meters),
                              threshold_m=round(threshold_meters))
        except Exception as e:
             # If an error occurs processing a specific location, keep it to be safe
             logger.warning("Could not process location for outlier check, keeping it.",
                            location_id=loc_data.get('id', 'N/A'), error=str(e))
             filtered_locations.append(loc_data)
    # --- End Filtering ---

    logger.info("Outlier filtering complete.", kept_count=len(filtered_locations), excluded_count=excluded_count)
    return filtered_locations

# ----------------------------------------------------
# Section 3: TSP Solver using OR-Tools
# ----------------------------------------------------

def solve_tsp(
    locations: List[Tuple[float, float]],
    time_limit_seconds: Optional[int] = None,
    local_search_strategy: Optional[LocalSearchStrategyEnum] = None,
    first_solution_strategy: Optional[FirstSolutionStrategyEnum] = None,
) -> Tuple[Optional[List[int]], Optional[float], Optional[List[List[int]]]]:
    """
    Solves the Single Depot Traveling Salesperson Problem using OR-Tools.

    - Uses the first location (index 0) in the `locations` list as the mandatory start and end depot.
    - Allows configuration of solver time limit and search strategies via optional parameters.
      If parameters are None, defaults are loaded from application settings.

    Args:
        locations: List of (latitude, longitude) tuples. The depot must be at index 0.
        time_limit_seconds: Maximum time in seconds the solver is allowed to run.
        local_search_strategy: Enum specifying the local search metaheuristic.
        first_solution_strategy: Enum specifying the initial solution generation strategy.

    Returns:
        A tuple: (route_indices, total_distance_meters, distance_matrix).
        - `route_indices`: List of location indices in the optimized visiting order, starting with 0 (depot).
                         Returns None if no solution is found or an error occurs.
        - `total_distance_meters`: Total calculated route distance in meters. Returns None if no solution.
        - `distance_matrix`: The distance matrix used by the solver. Returns None only if matrix creation failed.

    Raises:
        ImportError: If the 'ortools' library is not available when this function is called.
    """
    # --- Pre-check: Ensure OR-Tools is Available ---
    if not ORTOOLS_AVAILABLE:
        logger.critical("solve_tsp called but OR-Tools is not available/loaded.")
        # Raise an error immediately if the required library is missing.
        raise ImportError("Google OR-Tools library is required for TSP solving but was not found or failed to load.")

    # --- Load Settings for Defaults ---
    try:
        # Import get_settings here to avoid potential circular imports at module level
        # and ensure the latest settings are used if they can change dynamically.
        from app.config import get_settings
        settings = get_settings()
        # Extract default values from the loaded settings
        default_time_limit = settings.DEFAULT_SOLVER_TIME_LIMIT_SECONDS
        default_ls_strategy = settings.DEFAULT_LOCAL_SEARCH_STRATEGY
        default_fs_strategy = settings.DEFAULT_FIRST_SOLUTION_STRATEGY
    except Exception as e:
         # Fallback ONLY if settings cannot be loaded (e.g., config file issue)
         logger.error(f"Could not load settings from app.config: {e}. Using hardcoded solver defaults.", exc_info=True)
         default_time_limit = 30 # Hardcoded default time limit
         # Use Enum members directly for hardcoded defaults
         default_ls_strategy = LocalSearchStrategyEnum.TABU_SEARCH
         default_fs_strategy = FirstSolutionStrategyEnum.PATH_CHEAPEST_ARC

    # --- Determine Effective Solver Parameters ---
    logger.info(f"*************************************************************")
    logger.info(f"SOLVE_TSP FUNCTION CALLED WITH: time_limit_seconds={time_limit_seconds}")
    logger.info(f"Parameter type: {type(time_limit_seconds).__name__}")
    logger.info(f"Default time limit: {default_time_limit}")
    logger.info(f"*************************************************************")
    
    # CRITICAL FIX: Special handling for solver time limit
    # Convert and validate time_limit_seconds first
    custom_time_valid = False
    if time_limit_seconds is not None:
        try:
            # First convert to string to handle any type
            str_time = str(time_limit_seconds).strip()
            logger.info(f"String representation: '{str_time}'")
            
            # Then to float (to handle both integers and floating point strings)
            float_time = float(str_time)
            logger.info(f"Float conversion: {float_time}")
            
            # Finally to int for the solver
            int_time = int(float_time)
            logger.info(f"Final integer value: {int_time}")
            
            # Update the parameter with the converted value
            time_limit_seconds = int_time
            
            # Verify it's positive
            if int_time > 0:
                custom_time_valid = True
                logger.info(f"VALID TIME LIMIT: {int_time} seconds")
            else:
                logger.warning(f"Time limit must be positive: {int_time}")
                
        except (ValueError, TypeError, AttributeError) as e:
            logger.warning(f"ERROR CONVERTING TIME LIMIT: {e}, type: {type(time_limit_seconds).__name__}")
            time_limit_seconds = None
    
    # Use the provided value if valid, otherwise fall back to the default
    if custom_time_valid:
        effective_time_limit = time_limit_seconds
        logger.info(f"*** USING CUSTOM TIME LIMIT: {effective_time_limit} seconds ***")
    else:
        effective_time_limit = default_time_limit
        logger.info(f"*** USING DEFAULT TIME LIMIT: {effective_time_limit} seconds ***")
    
    # Validate and process local search strategy
    custom_ls_valid = False
    if local_search_strategy is not None:
        try:
            # If it's a string, convert to enum
            if isinstance(local_search_strategy, str):
                # Check if the string is a valid enum value
                try:
                    local_search_strategy = LocalSearchStrategyEnum(local_search_strategy)
                    logger.info(f"Converted string '{local_search_strategy}' to LocalSearchStrategyEnum")
                    custom_ls_valid = True
                except ValueError:
                    logger.warning(f"Invalid local search strategy string: '{local_search_strategy}'")
            else:
                # Already an enum object
                custom_ls_valid = True
        except Exception as e:
            logger.warning(f"Error processing local search strategy: {e}")
            local_search_strategy = None
    
    # Validate and process first solution strategy
    custom_fs_valid = False
    if first_solution_strategy is not None:
        try:
            # If it's a string, convert to enum
            if isinstance(first_solution_strategy, str):
                # Check if the string is a valid enum value
                try:
                    first_solution_strategy = FirstSolutionStrategyEnum(first_solution_strategy)
                    logger.info(f"Converted string '{first_solution_strategy}' to FirstSolutionStrategyEnum")
                    custom_fs_valid = True
                except ValueError:
                    logger.warning(f"Invalid first solution strategy string: '{first_solution_strategy}'")
            else:
                # Already an enum object
                custom_fs_valid = True
        except Exception as e:
            logger.warning(f"Error processing first solution strategy: {e}")
            first_solution_strategy = None
    
    # Set effective strategies
    effective_ls_strategy = local_search_strategy if custom_ls_valid else default_ls_strategy
    effective_fs_strategy = first_solution_strategy if custom_fs_valid else default_fs_strategy
    
    # Log what's being used
    if custom_ls_valid:
        logger.info(f"USING CUSTOM LOCAL SEARCH STRATEGY: {effective_ls_strategy.name}")
    else:
        logger.info(f"USING DEFAULT LOCAL SEARCH STRATEGY: {default_ls_strategy.name}")
        
    if custom_fs_valid:
        logger.info(f"USING CUSTOM FIRST SOLUTION STRATEGY: {effective_fs_strategy.name}")
    else:
        logger.info(f"USING DEFAULT FIRST SOLUTION STRATEGY: {default_fs_strategy.name}")

    num_locations = len(locations)
    logger.info("Initiating TSP solve process with effective parameters",
                num_locations=num_locations,
                time_limit=effective_time_limit,
                ls_strategy=effective_ls_strategy.name,
                fs_strategy=effective_fs_strategy.name)

    # --- Handle Trivial Cases ---
    if num_locations == 0:
        logger.warning("solve_tsp called with 0 locations.")
        return [], 0.0, [] # Return empty structures for zero locations
    if num_locations == 1:
        logger.info("solve_tsp called with 1 location (depot). Route is just the depot.")
        # Route is just the depot index 0, distance is 0, matrix is [[0]]
        return [0], 0.0, [[0]]

    # --- Step 1: Create Distance Matrix ---
    logger.debug("Creating distance matrix...")
    distance_matrix = create_distance_matrix(locations)
    # If matrix creation fails, we cannot proceed with OR-Tools.
    if distance_matrix is None:
        logger.error("Failed to create a valid distance matrix. Aborting TSP solve.")
        return None, None, None # Return None for route/distance/matrix

    # --- Step 2: Setup OR-Tools Routing Model ---
    # This block requires OR-Tools (pywrapcp and routing_enums_pb2)
    try:
        logger.debug("Initializing OR-Tools Routing Manager and Model...")
        # Create the routing index manager: (num_nodes, num_vehicles, depot_index)
        # For standard TSP, we use 1 vehicle starting and ending at the depot (index 0).
        manager = pywrapcp.RoutingIndexManager(num_locations, 1, 0)
        # Create the Routing Model.
        routing = pywrapcp.RoutingModel(manager)

        # Define the distance callback the solver will use.
        def distance_callback(from_index: int, to_index: int) -> int:
            """Internal callback returning pre-calculated distance between nodes."""
            try:
                # Convert from routing variable Index to distance matrix NodeIndex.
                from_node = manager.IndexToNode(from_index)
                to_node = manager.IndexToNode(to_index)
                # Basic bounds check for safety
                if 0 <= from_node < num_locations and 0 <= to_node < num_locations:
                    return distance_matrix[from_node][to_node]
                else:
                    # Should not happen if RoutingModel is consistent
                    logger.error("Invalid node index in distance_callback", from_n=from_node, to_n=to_node, max_n=num_locations-1)
                    return 999999999 # Return a large cost for invalid indices
            except Exception as e:
                 # Catch any unexpected error within the callback
                 logger.error("Exception inside distance_callback", error=str(e), from_idx=from_index, to_idx=to_index, exc_info=True)
                 return 999999999 # Return high penalty cost

        # Register the callback with the routing model.
        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        # Define cost of travel between nodes based on our callback.
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # --- Step 3: Set Search Parameters ---
        logger.debug("Setting OR-Tools search parameters...")
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()

        # Get the OR-Tools constant corresponding to the selected strategy enum name.
        # Use the pre-built maps (_fs_enum_map, _ls_enum_map) which handle fallbacks.
        fs_constant = _fs_enum_map.get(effective_fs_strategy.name)
        ls_constant = _ls_enum_map.get(effective_ls_strategy.name)

        # Log if the fallback (AUTOMATIC) had to be used because the map didn't contain the requested key.
        # This implies the installed OR-Tools version might not support that specific strategy name.
        if fs_constant is None or (fs_constant == routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC and effective_fs_strategy.name != "AUTOMATIC"):
             logger.warning(f"Using AUTOMATIC First Solution Strategy (requested: '{effective_fs_strategy.name}' may not be supported or mapped).")
             # Ensure fs_constant is set to AUTOMATIC if lookup failed entirely
             fs_constant = routing_enums_pb2.FirstSolutionStrategy.AUTOMATIC

        if ls_constant is None or (ls_constant == routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC and effective_ls_strategy.name != "AUTOMATIC"):
             logger.warning(f"Using AUTOMATIC Local Search Strategy (requested: '{effective_ls_strategy.name}' may not be supported or mapped).")
             ls_constant = routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC

        # Assign the determined constants to the search parameters
        search_parameters.first_solution_strategy = fs_constant
        search_parameters.local_search_metaheuristic = ls_constant

        # Apply the time limit with extensive debugging
        _requested_time_limit = time_limit_seconds
        _used_time_limit = effective_time_limit
        
        logger.info(f"******************************************")
        logger.info(f"APPLYING SOLVER TIME LIMIT PARAMETERS:")
        logger.info(f"Raw requested time_limit_seconds: {_requested_time_limit} (type: {type(_requested_time_limit).__name__})")
        logger.info(f"Using effective_time_limit: {_used_time_limit} (type: {type(_used_time_limit).__name__})")
        
        # CRITICAL: Ensure effective_time_limit is properly set
        if _requested_time_limit is not None and _requested_time_limit > 0:
            logger.info(f"SUCCESS: Using CUSTOM TIME LIMIT of {_used_time_limit} seconds")
        else:
            logger.info(f"USING DEFAULT TIME LIMIT of {_used_time_limit} seconds")
        logger.info(f"******************************************")
        
        # Apply the time limit to the search parameters
        search_parameters.time_limit.FromSeconds(_used_time_limit)

    except AttributeError as ae:
        # Catch errors if expected OR-Tools classes/methods are missing
        logger.critical(f"AttributeError during OR-Tools model setup: {ae}. Library may be incompatible.", exc_info=True)
        # Reraise as ImportError to signal fundamental issue with the dependency
        raise ImportError(f"Failed to setup OR-Tools model due to missing attribute: {ae}") from ae
    except Exception as e:
         # Catch any other errors during model setup
         logger.error("Unexpected exception during OR-Tools model setup", error=str(e), exc_info=True)
         # Return failure, but include matrix if it was created successfully
         return None, None, distance_matrix

    # --- Step 4: Solve the Problem ---
    logger.info("Starting OR-Tools solver call (SolveWithParameters)...")
    solve_start_time = time.time() # Start timer right before the solve call
    solution = None # Initialize solution variable
    try:
        # Execute the solver
        solution = routing.SolveWithParameters(search_parameters)
        solve_end_time = time.time() # Stop timer immediately after
        actual_solve_duration_ms = (solve_end_time - solve_start_time) * 1000
        logger.info("OR-Tools SolveWithParameters finished.", actual_duration_ms=round(actual_solve_duration_ms, 2))
    except Exception as e:
        # Catch errors specifically from the SolveWithParameters call
        logger.error("Exception occurred during routing.SolveWithParameters", error=str(e), exc_info=True)
        return None, None, distance_matrix # Return failure if solver crashes

    # --- Step 5: Process and Return the Solution ---
    if solution:
        # Get the status code returned by the solver
        routing_status_code = routing.status()
        logger.info("Raw solver status code received", status_code=routing_status_code, time_limit=effective_time_limit)

        # Check if the status code indicates success (using the reliable hardcoded value)
        if routing_status_code == STATUS_CODE_SUCCESS:
            # Retrieve the total distance (objective value) from the solution
            total_distance = solution.ObjectiveValue()
            logger.info('OR-Tools Objective (Total Distance)', distance_m=total_distance, time_limit=effective_time_limit)

            # Extract the sequence of visits (route)
            route_indices = []
            index = routing.Start(0) # Get the starting node index for vehicle 0
            while not routing.IsEnd(index):
                node_index = manager.IndexToNode(index) # Convert routing index to original location index
                route_indices.append(node_index)
                index = solution.Value(routing.NextVar(index)) # Get the next node index in the solution

            # Add the end node index (depot) to explicitly close the loop visually if needed by consumer,
            # though OR-Tools TSP objective inherently assumes return to depot.
            # For clarity in the returned list, we add the depot at the end if it's not implicitly there.
            # end_depot_index = manager.IndexToNode(routing.End(0)) # This would be the depot again
            # if route_indices and route_indices[-1] != end_depot_index:
            #     route_indices.append(end_depot_index) # Usually not needed for interpretation

            # --- Sanity Checks for Success Case ---
            if not route_indices:
                 # This case indicates an inconsistency if status is SUCCESS but route is empty
                 logger.error("Solver reported success (status 1) but extracted route is empty!")
                 return None, None, distance_matrix # Treat as failure

            if route_indices[0] != 0:
                 # The route must start at the depot (index 0) for our single-depot setup
                 logger.warning("Route solution doesn't start with depot 0. Correcting.", route=route_indices)
                 try:
                      # Attempt to find and move depot 0 to the start
                      depot_actual_pos = route_indices.index(0)
                      route_indices.insert(0, route_indices.pop(depot_actual_pos))
                 except ValueError:
                      # If depot 0 isn't even in the route, it's a major solver issue
                      logger.error("Depot 0 not found in supposedly successful route. Solver inconsistency.")
                      return None, None, distance_matrix # Treat as failure
            # --- End Sanity Checks ---

            logger.info("Route extracted successfully.", route_length=len(route_indices))
            # Return the results: route indices, total distance, and the distance matrix used
            return route_indices, float(total_distance), distance_matrix

        else:
            # Solver finished but the status code was not SUCCESS (1)
            # Create a simple mapping for logging common non-success statuses
            status_map_simple = {0: "NOT_SOLVED", 1: "SUCCESS", 2: "FAIL", 3: "FAIL_TIMEOUT", 4: "INVALID"}
            status_str = status_map_simple.get(routing_status_code, f"UNKNOWN ({routing_status_code})")

            logger.error("OR-Tools solver finished but status was not SUCCESS.",
                         status=status_str, status_code=routing_status_code)

            # Specifically log if the status indicates a timeout
            if routing_status_code == STATUS_CODE_TIMEOUT:
                 logger.warning(f"Solver likely timed out (status {STATUS_CODE_TIMEOUT}). Applied time limit was {effective_time_limit}s.")

            # Return failure (None for route/distance)
            return None, None, distance_matrix
    else:
        # The 'solution' object itself was None, meaning SolveWithParameters failed fundamentally.
        logger.error("OR-Tools routing.SolveWithParameters returned None. Solver failed before producing a status.")
        return None, None, distance_matrix