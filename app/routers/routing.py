# app/routers/routing.py
import time
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body, Depends, Request as FastAPIRequest, status

# --- Rate Limiter Imports ---
from slowapi import Limiter
from slowapi.util import get_remote_address
# Import the limiter instance from main.py so the decorator works
# Ensure main.py defines 'limiter = Limiter(...)'
try:
    from app.main import limiter
except ImportError:
    # Fallback if main.py isn't structured that way or for testing
    logger = logging.getLogger(__name__)
    logger.warning("Could not import 'limiter' from app.main. Rate limiting may not work.")
    # Define a dummy limiter to avoid crashes during import
    class DummyLimiter:
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
        def exempt(self, func):
            return func
    limiter = DummyLimiter()


# --- Security Imports ---
from fastapi_simple_security import api_key_security

# --- Local Imports ---
from app.services import tsp_solver
# Import schemas including new enums
from app.models import schemas
from app.config import get_settings, Settings # Settings now includes solver defaults

# --- Logging Setup ---
try:
    import structlog
    logger = structlog.get_logger(__name__)
except ImportError:
    logger = logging.getLogger(__name__)
    if not logger.hasHandlers(): # Basic setup if structlog fails/missing
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(levelname)s:%(name)s:%(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)


# --- Check OR-Tools Availability (at module import time) ---
ortools_available = False
try:
    # Ensure tsp_solver is imported before accessing its attributes
    ortools_available = tsp_solver.ORTOOLS_AVAILABLE
    if not ortools_available:
        logger.critical("OR-Tools check during import: Library not available.")
except AttributeError:
    logger.error("OR-Tools check during import: Failed to access tsp_solver.ORTOOLS_AVAILABLE.")
except ImportError:
     logger.error("OR-Tools check during import: Failed to import tsp_solver module.")

if not ortools_available:
    logger.critical("OR-Tools library not found or failed import. Routing endpoint will be unavailable.")

# --- Router Definition ---
router = APIRouter(
    prefix="/routing",
    tags=["Routing Operations"],
    dependencies=[Depends(api_key_security)] # Apply security to all routes in this router
)

# --- Route Definition ---
@router.post(
    "/optimize",
    response_model=schemas.OptimizeResponse,
    summary="Optimize a multi-stop route (TSP)",
    description=(
        "Calculates an optimized route visiting the provided locations using OR-Tools TSP solver.\n\n"
        "**Requires:** Valid API Key (`X-API-Key` header or `api_key` query param).\n\n"
        "**Options:**\n"
        "- `locations`: List of locations with `id`, `latitude`, `longitude`. First location is the depot.\n"
        "- `average_speed_kmh`: (Optional) Used for duration estimates. Default: from config.\n"
        "- `outlier_threshold_km`: (Optional) Excludes points far from the centroid before solving. Default: from config.\n"
        "- `solver_time_limit_seconds`: (Optional) Max seconds for the solver. Default: from config.\n"
        "- `local_search_strategy`: (Optional) Solver algorithm trade-off (e.g., 'TABU_SEARCH', 'GUIDED_LOCAL_SEARCH'). See Enum for options. Default: from config.\n"
        "- `first_solution_strategy`: (Optional) Initial route generation method (e.g., 'PATH_CHEAPEST_ARC'). See Enum for options. Default: from config."
    ),
)
@limiter.limit(lambda: get_settings().DEFAULT_RATE_LIMIT) # Use callable for dynamic limit from settings
async def optimize_route(
    request: FastAPIRequest, # Inject request for rate limiting context
    payload: schemas.OptimizeRequest = Body(...),
    settings: Settings = Depends(get_settings), # Inject settings
) -> schemas.OptimizeResponse:
    # Get and log the raw request body before Pydantic processes it
    try:
        raw_body = await request.body()
        raw_text = raw_body.decode('utf-8')
        logger.info(f"RAW REQUEST BODY: {raw_text}")
    except Exception as e:
        logger.error(f"Error reading raw request body: {e}")
    # Log incoming payload for debugging - showing all optional parameters
    logger.info("RECEIVED PAYLOAD", 
                solver_time_limit_seconds=payload.solver_time_limit_seconds,
                solver_time_limit_type=type(payload.solver_time_limit_seconds).__name__,
                average_speed_kmh=payload.average_speed_kmh,
                outlier_threshold_km=payload.outlier_threshold_km,
                local_search_strategy=payload.local_search_strategy,
                first_solution_strategy=payload.first_solution_strategy)
    """
    Optimizes a route visiting the input locations.
    Handles API Key auth, rate limiting, outlier filtering, and solver execution.
    Accepts optional parameters to control solver behavior.
    """
    start_time = time.time()
    # Log basic request info (context middleware should add more)
    logger.info("Processing /optimize request payload", location_count=len(payload.locations))

    if not ortools_available:
        logger.error("OR-Tools unavailable at request time.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Route optimization service unavailable (OR-Tools library missing/failed)."
        )

    # --- Input Processing & Filtering ---
    original_count = len(payload.locations)

    # Handle empty input gracefully
    if original_count == 0:
        logger.warning("Request received with zero locations.")
        calc_time = time.time() - start_time
        summary = schemas.RouteSummary(
            total_distance_meters=0,
            total_duration_seconds=0,
            num_locations_optimized=0,
            num_locations_excluded=0,
            depot_id=None,
            calculation_time_seconds=round(calc_time, 3)
        )
        return schemas.OptimizeResponse(
            status="success",
            message="Input contained zero locations.",
            summary=summary,
            route=[],
            legs=[]
        )

    # Prepare metadata for filtering and response formatting
    locations_with_meta = [
        {"lat": loc.latitude, "lon": loc.longitude, "id": loc.id, "original_index": i}
        for i, loc in enumerate(payload.locations)
    ]
    # Keep track of the original depot details
    original_depot_meta = locations_with_meta[0] if locations_with_meta else None

    # Apply outlier filtering if requested or default is set
    locations_to_solve_meta = locations_with_meta
    # Use payload threshold if provided, otherwise use settings default (which can also be None)
    threshold = payload.outlier_threshold_km if payload.outlier_threshold_km is not None else settings.DEFAULT_OUTLIER_THRESHOLD_KM

    if threshold is not None and threshold > 0: # Only filter if threshold is positive
        logger.info("Applying outlier filtering", threshold_km=threshold)
        try:
            locations_to_solve_meta = tsp_solver.remove_far_outliers(locations_with_meta, threshold)
        except Exception as e:
            logger.error("Error during outlier filtering", error=str(e), exc_info=True)
            # Use 500 for internal errors during filtering
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error during outlier filtering: {e}"
            )

    filtered_count = len(locations_to_solve_meta)
    excluded_count = original_count - filtered_count
    logger.info("Filtering complete", original=original_count, kept=filtered_count, excluded=excluded_count)

    # Handle cases where filtering removed all locations
    if filtered_count == 0:
        logger.warning("All locations were filtered out.")
        calc_time = time.time() - start_time
        depot_id_for_summary = original_depot_meta.get('id') if original_depot_meta else None
        summary = schemas.RouteSummary(
            total_distance_meters=0,
            total_duration_seconds=0,
            num_locations_optimized=0,
            num_locations_excluded=excluded_count, # Report how many were excluded
            depot_id=depot_id_for_summary,
            calculation_time_seconds=round(calc_time, 3)
        )
        return schemas.OptimizeResponse(
            status="warning",
            message="No locations remained after filtering.",
            summary=summary,
            route=[],
            legs=[]
        )

    # Ensure the designated depot (original index 0) wasn't filtered out
    depot_in_filtered = any(loc['original_index'] == 0 for loc in locations_to_solve_meta)
    if not depot_in_filtered:
        depot_id_log = original_depot_meta.get('id', 'N/A') if original_depot_meta else 'N/A'
        logger.error("Designated depot (original index 0) was filtered out.", depot_id=depot_id_log, threshold=threshold)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"The designated start location (Depot ID: {depot_id_log}) was excluded by the outlier filter (threshold: {threshold} km). Cannot create route starting from it."
        )

    # Ensure depot is at index 0 for the solver's input list
    current_depot_idx = next((i for i, loc in enumerate(locations_to_solve_meta) if loc['original_index'] == 0), -1)
    if current_depot_idx > 0:
        logger.debug(f"Moving depot from filtered index {current_depot_idx} to 0 for solver.")
        # Move depot to the front
        locations_to_solve_meta.insert(0, locations_to_solve_meta.pop(current_depot_idx))
    elif current_depot_idx == -1: # Should not happen if depot_in_filtered is True
         logger.error("Internal logic error: Depot inconsistency after filtering check.")
         raise HTTPException(status_code=500, detail="Internal server error processing depot location.")
    # If current_depot_idx is 0, it's already in the correct place

    # Handle case with only the depot remaining after filtering
    if filtered_count == 1:
        logger.info("Only the depot location remains after filtering.")
        calc_time = time.time() - start_time
        depot_data = locations_to_solve_meta[0] # Should be the depot
        route = [schemas.RoutePoint(
            id=depot_data['id'],
            latitude=depot_data['lat'],
            longitude=depot_data['lon'],
            original_index=depot_data['original_index'],
            visit_order=1, # Only one stop
            is_depot=True
        )]
        depot_id_sum = original_depot_meta.get('id') if original_depot_meta else None
        summary = schemas.RouteSummary(
            total_distance_meters=0,
            total_duration_seconds=0,
            num_locations_optimized=1,
            num_locations_excluded=excluded_count,
            depot_id=depot_id_sum,
            calculation_time_seconds=round(calc_time, 3)
        )
        return schemas.OptimizeResponse(
            status="success",
            message="Route contains only the depot location.",
            summary=summary,
            route=route,
            legs=[] # No legs for a single point route
        )

    # --- Prepare for Solver ---
    try:
        # Create list of (lat, lon) tuples for the solver
        solver_locations = [(loc['lat'], loc['lon']) for loc in locations_to_solve_meta]
    except KeyError as e:
        logger.error("Missing 'lat' or 'lon' key preparing data for solver.", error=str(e))
        raise HTTPException(status_code=500, detail="Internal error preparing location data.")

    # --- Call Solver ---
    route_indices = None
    total_distance_solver = None
    distance_matrix = None
    try:
        # Log the parameters being sent (or None if not provided in payload)
        logger.info("Calling OR-Tools TSP solver with parameters",
                    location_count=len(solver_locations),
                    time_limit=payload.solver_time_limit_seconds, # Log requested value (can be None)
                    ls_strategy=payload.local_search_strategy,    # Log requested value (can be None)
                    fs_strategy=payload.first_solution_strategy)  # Log requested value (can be None)

        # Pass parameters from payload to the solver service
        # The solver service will use defaults from config if these are None
        # Get the raw request body to check what's actually being sent
        try:
            # Get and log the entire request
            req_body = await request.body()
            req_text = req_body.decode('utf-8')
            logger.info(f"EXACT RAW REQUEST BODY TEXT: {req_text}")
            
            # Try to parse it as JSON
            try:
                import json
                req_json = json.loads(req_text)
                logger.info(f"PARSED RAW REQUEST BODY: {req_json}")
                
                # Direct access to all keys in the request
                for key in req_json.keys():
                    logger.info(f"REQUEST KEY FOUND: {key} = {req_json.get(key)}")
                
                # Check for options object (used by the frontend)
                options = req_json.get('options')
                if options and isinstance(options, dict):
                    logger.info(f"FOUND OPTIONS OBJECT: {options}")
                    for key in options.keys():
                        logger.info(f"OPTIONS KEY FOUND: {key} = {options.get(key)}")
                    
                    # Extract all parameters from options object
                    raw_time_limit = options.get('solver_time_limit_seconds')
                    if raw_time_limit is not None:
                        logger.info(f"FOUND TIME LIMIT IN OPTIONS: {raw_time_limit}")
                    
                    # Also look for search strategies
                    raw_local_search = options.get('local_search_strategy')
                    if raw_local_search:
                        logger.info(f"FOUND LOCAL SEARCH STRATEGY IN OPTIONS: {raw_local_search}")
                    
                    raw_first_solution = options.get('first_solution_strategy')
                    if raw_first_solution:
                        logger.info(f"FOUND FIRST SOLUTION STRATEGY IN OPTIONS: {raw_first_solution}")
                        
                    # Look for speed and outlier threshold
                    raw_speed = options.get('average_speed_kmh')
                    if raw_speed is not None:
                        logger.info(f"FOUND SPEED IN OPTIONS: {raw_speed}")
                        
                    raw_threshold = options.get('outlier_threshold_km')
                    if raw_threshold is not None:
                        logger.info(f"FOUND OUTLIER THRESHOLD IN OPTIONS: {raw_threshold}")
                else:
                    # If options object not found, try to find parameters at the top level
                    logger.info("NO OPTIONS OBJECT FOUND, CHECKING TOP LEVEL")
                    raw_time_limit = req_json.get('solver_time_limit_seconds')
                    raw_local_search = req_json.get('local_search_strategy')
                    raw_first_solution = req_json.get('first_solution_strategy')
                    raw_speed = req_json.get('average_speed_kmh')
                    raw_threshold = req_json.get('outlier_threshold_km')
                
                logger.info(f"DIRECT FROM RAW JSON: solver_time_limit_seconds = {raw_time_limit} (type: {type(raw_time_limit).__name__})")
            except json.JSONDecodeError as je:
                logger.error(f"JSON parse error: {je}")
                raw_time_limit = None
                raw_local_search = None
                raw_first_solution = None
                raw_speed = None
                raw_threshold = None
        except Exception as e:
            logger.error(f"Error reading raw request body: {e}")
            raw_time_limit = None
            raw_local_search = None
            raw_first_solution = None
            raw_speed = None
            raw_threshold = None
        
        # Now try to get all parameters from the Pydantic model
        pydantic_time_limit = payload.solver_time_limit_seconds
        pydantic_local_search = payload.local_search_strategy
        pydantic_first_solution = payload.first_solution_strategy
        pydantic_speed = payload.average_speed_kmh
        pydantic_threshold = payload.outlier_threshold_km
        
        logger.info(f"FROM PYDANTIC MODEL: solver_time_limit_seconds = {pydantic_time_limit}")
        logger.info(f"FROM PYDANTIC MODEL: local_search_strategy = {pydantic_local_search}")
        logger.info(f"FROM PYDANTIC MODEL: first_solution_strategy = {pydantic_first_solution}")
        logger.info(f"FROM PYDANTIC MODEL: average_speed_kmh = {pydantic_speed}")
        logger.info(f"FROM PYDANTIC MODEL: outlier_threshold_km = {pydantic_threshold}")
        
        # Choose the most reliable source for normal operations
        # Prefer raw JSON if available, then fall back to Pydantic model
        solve_time = raw_time_limit if raw_time_limit is not None else pydantic_time_limit
        local_search = raw_local_search if raw_local_search is not None else pydantic_local_search
        first_solution = raw_first_solution if raw_first_solution is not None else pydantic_first_solution
        speed = raw_speed if raw_speed is not None else pydantic_speed
        threshold = raw_threshold if raw_threshold is not None else pydantic_threshold
        
        # Validate local search strategy if provided
        if isinstance(local_search, str):
            try:
                # Check if it's a valid enum value
                from app.models.schemas import LocalSearchStrategyEnum
                local_search = LocalSearchStrategyEnum(local_search)
                logger.info(f"Converted local_search string '{local_search}' to enum")
            except (ValueError, AttributeError) as e:
                logger.warning(f"Invalid local search strategy: {e}")
                local_search = None
                
        # Validate first solution strategy if provided
        if isinstance(first_solution, str):
            try:
                # Check if it's a valid enum value
                from app.models.schemas import FirstSolutionStrategyEnum
                first_solution = FirstSolutionStrategyEnum(first_solution)
                logger.info(f"Converted first_solution string '{first_solution}' to enum")
            except (ValueError, AttributeError) as e:
                logger.warning(f"Invalid first solution strategy: {e}")
                first_solution = None
        
        logger.info(f"SELECTED TIME LIMIT FROM REQUEST: {solve_time}")
        logger.info(f"SELECTED LOCAL SEARCH STRATEGY FROM REQUEST: {local_search}")
        logger.info(f"SELECTED FIRST SOLUTION STRATEGY FROM REQUEST: {first_solution}")
        logger.info(f"SELECTED SPEED FROM REQUEST: {speed}")
        logger.info(f"SELECTED THRESHOLD FROM REQUEST: {threshold}")
        
        # Ensure it's an integer
        if solve_time is not None:
            try:
                solve_time = int(float(str(solve_time).strip()))
                logger.info(f"FINAL CONVERTED solver_time_limit_seconds = {solve_time}")
            except (ValueError, TypeError) as e:
                logger.warning(f"Failed to convert time limit: {e}, value={solve_time}")
                solve_time = None
        
        # Log the final value being passed
        logger.info(f"************************************************************")
        logger.info(f"*** FINAL TIME LIMIT PASSED TO SOLVER: {solve_time} ***")
        logger.info(f"************************************************************")
        
        # Call the solver with the extracted parameters
        solve_result = tsp_solver.solve_tsp(
            solver_locations,
            time_limit_seconds=solve_time,
            local_search_strategy=local_search,
            first_solution_strategy=first_solution
        )

        # Check result carefully - solve_tsp returns (route, distance, matrix) or (None, None, matrix)
        if solve_result is None:
             logger.error("TSP Solver function returned None unexpectedly.")
             # This shouldn't happen based on solve_tsp logic, but handle defensively
             raise HTTPException(status_code=503, detail="TSP solver encountered an unexpected internal error.")

        route_indices, total_distance_solver, distance_matrix = solve_result

        # Check if the solver failed to find a *solution* (route_indices will be None)
        if route_indices is None:
            logger.error("TSP Solver returned None for route indices, indicating no solution found.")
            # Use 503 status code for solver failure to find a route
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="TSP solver did not find a solution (check logs for solver status).")

        # Validate route format (should be a list)
        if not isinstance(route_indices, list):
             logger.error("TSP Solver returned invalid route format", type=type(route_indices).__name__)
             raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal solver error: Invalid route format returned.")

        # Log success if we have a valid list of indices
        logger.info("TSP solved successfully by service", route_length=len(route_indices), total_distance_m=round(total_distance_solver or 0, 2))

    except ImportError as e: # Catch if OR-Tools became unavailable
        logger.critical("ImportError during TSP solve call - OR-Tools likely missing.", error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Optimization service unavailable (Required library missing).")
    except HTTPException: # Re-raise HTTPExceptions raised within this try block
        raise
    except Exception as e:
        # Catch any other unexpected error during the call to solve_tsp or result processing
        logger.error("Unhandled exception during TSP solving process", error=str(e), exc_info=True)
        # Use a general 500 error for truly unexpected issues
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An internal error occurred during route optimization: {e}") from e

    # --- Format Response ---
    logger.debug("Formatting successful TSP response...")
    total_distance = total_distance_solver if total_distance_solver is not None else 0.0

    # Map solver indices back to original metadata
    index_to_solver_meta_map = {i: meta for i, meta in enumerate(locations_to_solve_meta)}
    ordered_route_points: List[schemas.RoutePoint] = []
    try:
        for visit_idx, solver_idx in enumerate(route_indices):
            if solver_idx in index_to_solver_meta_map:
                loc_data = index_to_solver_meta_map[solver_idx]
                ordered_route_points.append(schemas.RoutePoint(
                    id=loc_data['id'],
                    latitude=loc_data['lat'],
                    longitude=loc_data['lon'],
                    original_index=loc_data['original_index'],
                    visit_order=visit_idx + 1, # 1-based visit order
                    is_depot=(loc_data['original_index'] == 0) # Check original index for depot status
                ))
            else:
                # This indicates a logic error in the solver or mapping
                logger.error("Solver returned index out of bounds for mapping", invalid_index=solver_idx, map_size=len(index_to_solver_meta_map))
                # Depending on requirements, either raise 500 or try to continue without this point
                raise HTTPException(status_code=500, detail="Internal error mapping solver results.")
    except KeyError as ke:
        logger.error("Missing expected key in location metadata during response formatting.", missing_key=str(ke), exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error formatting response data.")

    # Calculate legs (distance and duration)
    ordered_legs: List[schemas.RouteLeg] = []
    total_calculated_duration_sec = 0.0
    # Use speed from payload or default from settings
    speed = payload.average_speed_kmh if payload.average_speed_kmh is not None and payload.average_speed_kmh > 0 else settings.DEFAULT_AVERAGE_SPEED_KMH

    if distance_matrix and len(route_indices) > 1:
        num_stops = len(route_indices)
        logger.debug(f"Calculating {num_stops} legs...")
        for i in range(num_stops):
            start_solver_idx = route_indices[i]
            # Connect the last point back to the depot (index 0)
            end_solver_idx = route_indices[0] if i == num_stops - 1 else route_indices[i + 1]

            start_meta = index_to_solver_meta_map.get(start_solver_idx)
            end_meta = index_to_solver_meta_map.get(end_solver_idx)

            if start_meta and end_meta:
                leg_distance_m = 0.0
                leg_duration_sec = None
                try:
                    # Use pre-calculated matrix distance if possible
                    if 0 <= start_solver_idx < len(distance_matrix) and 0 <= end_solver_idx < len(distance_matrix[0]):
                        leg_distance_m = float(distance_matrix[start_solver_idx][end_solver_idx])
                    else:
                        # Fallback: Recalculate Haversine if indices invalid (shouldn't happen)
                        logger.warning("Invalid indices for matrix lookup, recalculating Haversine.", start=start_solver_idx, end=end_solver_idx)
                        leg_distance_m = tsp_solver.haversine_distance(start_meta['lat'], start_meta['lon'], end_meta['lat'], end_meta['lon'])
                except (IndexError, TypeError, ValueError) as matrix_err:
                    # Fallback: Recalculate Haversine on matrix error
                    logger.error("Error accessing distance matrix for leg, recalculating.", start_idx=start_solver_idx, end_idx=end_solver_idx, error=str(matrix_err))
                    try:
                        leg_distance_m = tsp_solver.haversine_distance(start_meta['lat'], start_meta['lon'], end_meta['lat'], end_meta['lon'])
                    except Exception as hv_err:
                         logger.error("Haversine fallback failed for leg", start_id=start_meta.get('id'), end_id=end_meta.get('id'), error=str(hv_err))
                         leg_distance_m = 0.0 # Assign 0 if fallback fails

                # Calculate duration if speed is valid
                if speed > 0:
                    try:
                        duration = tsp_solver.calculate_duration_seconds(leg_distance_m, speed)
                        if duration is not None:
                            total_calculated_duration_sec += duration
                            leg_duration_sec = round(duration, 2)
                            logger.debug(f"Calculated leg duration: {leg_duration_sec}s for distance {leg_distance_m}m at speed {speed}km/h")
                        else:
                            logger.warning(f"Duration calculation returned None for leg: dist={leg_distance_m}m, speed={speed}km/h")
                    except Exception as dur_err:
                        logger.error("Error calculating duration for leg", start_id=start_meta.get('id'), end_id=end_meta.get('id'), error=str(dur_err))

                ordered_legs.append(schemas.RouteLeg(
                    start_location_id=start_meta['id'],
                    end_location_id=end_meta['id'],
                    distance_meters=round(leg_distance_m, 2),
                    duration_seconds=leg_duration_sec
                ))
            else:
                # Indicates a logic error
                logger.error("Could not find metadata for leg calculation", start_idx=start_solver_idx, end_idx=end_solver_idx)
                raise HTTPException(status_code=500, detail="Internal error calculating route legs.")

    # --- Final Summary ---
    calc_time = time.time() - start_time
    # Use the actual time limit that was applied (from payload or default)
    effective_time_limit = payload.solver_time_limit_seconds if payload.solver_time_limit_seconds is not None else settings.DEFAULT_SOLVER_TIME_LIMIT_SECONDS
    
    # Ensure we have a value for total_duration_seconds
    duration_seconds = round(total_calculated_duration_sec, 2) if total_calculated_duration_sec and speed > 0 else None
    
    final_summary = schemas.RouteSummary(
        total_distance_meters=round(total_distance, 2),
        total_duration_seconds=duration_seconds,
        num_locations_optimized=len(ordered_route_points),
        num_locations_excluded=excluded_count,
        depot_id=original_depot_meta.get('id') if original_depot_meta else None,
        calculation_time_seconds=round(calc_time, 3)
    )

    logger.info("Successfully processed /optimize request", duration_ms=round(calc_time * 1000, 2))
    return schemas.OptimizeResponse(
        status="success",
        message=f"Route optimized for {final_summary.num_locations_optimized} locations.",
        summary=final_summary,
        route=ordered_route_points,
        legs=ordered_legs
    )