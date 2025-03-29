# app/main.py
import logging
import sys
import time
import os
import uuid
import contextvars
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# --- Rate Limiting Imports ---
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# --- Logging Imports ---
import structlog # Import structlog itself

# --- Local Imports ---
# Import config *first*
from app.config import get_settings, Settings
# Import routers later, after app is created

# --- Load Settings Early ---
# Exit if settings fail to load
try:
    settings: Settings = get_settings()
except RuntimeError as e:
    logging.basicConfig(level=logging.CRITICAL, format='%(asctime)s - %(levelname)s - CRITICAL - %(message)s')
    logging.critical(f"CRITICAL ERROR: Failed to load application settings. Exiting. Error: {e}")
    sys.exit(1)

# --- Configure Logging (Structlog + Standard Logging) ---
# Request ID context variable
request_id_var = contextvars.ContextVar("request_id", default="-")

# Define processors for structlog
stdlib_log_processors = [
    structlog.stdlib.add_logger_name,
    structlog.stdlib.add_log_level,
    structlog.stdlib.ExtraAdder(),
    structlog.processors.TimeStamper(fmt="iso"),
]

# Common processors for all structlog loggers
shared_processors = [
    structlog.contextvars.merge_contextvars,
    structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
]

# Configure structlog BEFORE setting up standard logging handlers
try:
    structlog.configure(
        processors=stdlib_log_processors + shared_processors, # Combine processors
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Choose the final formatter based on settings
    if settings.LOG_STRUCTURED:
        final_processor = structlog.processors.JSONRenderer()
        log_info_message = "Structured JSON logging will be used."
    else:
        final_processor = structlog.dev.ConsoleRenderer(colors=True)
        log_info_message = "Console (human-readable) logging will be used."

    # Configure the stdlib formatter that structlog wraps
    formatter = structlog.stdlib.ProcessorFormatter(
        # The foreign_pre_chain runs *before* stdlib_log_processors when formatting
        # logs from other libraries (like uvicorn)
        foreign_pre_chain=stdlib_log_processors,
        # The final processor renders the formatted event
        processor=final_processor,
    )

    # Set up the handler for standard logging
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger = logging.getLogger() # Get root logger
    root_logger.handlers.clear()      # Clear any previous handlers
    root_logger.addHandler(handler)   # Add our structlog handler
    root_logger.setLevel(settings.LOG_LEVEL.upper()) # Set level

    # Adjust library log levels
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("slowapi").setLevel(logging.INFO)
    logging.getLogger("fastapi_simple_security").setLevel(logging.INFO)

    # Get our main application logger using structlog's factory
    logger = structlog.get_logger("app.main")
    logger.info(log_info_message, log_level=settings.LOG_LEVEL) # Use structlog logger now

except Exception as log_config_error:
    # Fallback to basic logging if structlog setup fails
    logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(name)s - %(message)s')
    logger = logging.getLogger("app.main") # Fallback logger
    logger.error("!!! Failed to configure structured logging. Falling back to basic logging. !!!", error=str(log_config_error), exc_info=True)


# --- Rate Limiter Setup ---
# Needs to happen after logging is configured minimally
try:
    limiter = Limiter(key_func=get_remote_address, enabled=settings.RATE_LIMIT_ENABLED)
except Exception as limiter_err:
     logger.critical("Failed to initialize Rate Limiter!", error=str(limiter_err), exc_info=True)
     sys.exit("Exiting due to Rate Limiter setup failure.")


# --- Path Definitions ---
PROJECT_ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = PROJECT_ROOT / "static"
INDEX_HTML_FILE = STATIC_DIR / "index.html"


# --- FastAPI App Initialization ---
# Do this AFTER basic logging and settings are ready
try:
    app = FastAPI(
        title=settings.APP_NAME,
        description="API for optimizing multi-stop routes using TSP.",
        version="1.1.0",
        openapi_tags=[
            {"name": "Routing Operations", "description": "Optimize routes (Requires API Key)."},
            {"name": "_auth", "description": "Manage API Keys (Requires Admin Secret)."},
            {"name": "Frontend", "description": "Serves the web interface."},
        ]
    )
    logger.info("FastAPI application instance created.")
except Exception as app_init_err:
     logger.critical("Failed to initialize FastAPI app!", error=str(app_init_err), exc_info=True)
     sys.exit("Exiting due to FastAPI initialization failure.")


# --- Add State for Rate Limiter ---
# MUST happen after 'app' is created
app.state.limiter = limiter

# --- Custom Exception Handlers (Registered BEFORE Middleware using them) ---
# Use status codes from fastapi.status module
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    # Logger context (request_id) should be available if middleware ran
    logger.warning("Rate limit exceeded", client_ip=get_remote_address(request), detail=str(exc.detail))
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "status": "error",
            "message": "Rate limit exceeded",
            "detail": f"Rate limit exceeded: {exc.detail}",
        },
        headers={"X-Request-ID": request_id_var.get("-")} # Provide default for request_id
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
	logger.warning("Request validation failed", detail=exc.errors())
	return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"status": "error", "message": "Input validation failed", "detail": exc.errors()},
        headers={"X-Request-ID": request_id_var.get("-")}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    req_id = request_id_var.get("-")
    # Error should have been logged with traceback by the middleware if it ran
    logger.critical("Unhandled server error caught by general handler", error=str(exc), error_type=type(exc).__name__)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"status": "error", "message": "An unexpected internal server error occurred."},
        headers={"X-Request-ID": req_id}
    )

# --- Request ID and Logging Context Middleware (Runs Early) ---
@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4().hex)
    request_id_var.set(request_id) # Set context variable for this request

    # Bind essential request info to structlog context
    structlog.contextvars.clear_contextvars() # Ensure clean context
    header_dict = {k: v for k, v in request.headers.items()}
    bound_logger = structlog.contextvars.bind_contextvars(
        request_id=request_id,
        client_ip=get_remote_address(request),
        path=request.url.path,
        method=request.method,
        # Avoid logging potentially large headers unless necessary for debugging
        # headers=header_dict
    )
    # Log request start at debug level
    logger.debug("Request received")

    start_time = time.time()
    response = None
    try:
        # Process the request through subsequent middleware and the route handler
        response = await call_next(request)
        process_time = time.time() - start_time

        # Augment log context with response info for the final success log
        structlog.contextvars.bind_contextvars(
             status_code=response.status_code,
             duration_ms=round(process_time * 1000, 2)
        )
        logger.info("Request processed successfully") # Final success log message

        # Add custom headers to the response *after* it's generated
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.4f}"

    except Exception as exc:
        # Log exceptions that occurred during request processing
        process_time = time.time() - start_time
        log_payload = { "duration_ms": round(process_time * 1000, 2) }
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR # Default

        # Log specific details based on exception type
        if isinstance(exc, HTTPException):
            status_code = exc.status_code
            log_payload["status_code"] = status_code
            log_payload["detail"] = exc.detail
            logger.warning("Request failed (HTTPException)", **log_payload)
        elif isinstance(exc, RateLimitExceeded):
             status_code = status.HTTP_429_TOO_MANY_REQUESTS
             log_payload["status_code"] = status_code
             log_payload["detail"] = getattr(exc, 'detail', 'Rate limit exceeded')
             logger.warning("Request failed (RateLimitExceeded)", **log_payload)
        else:
            # Log unexpected errors with full traceback
            log_payload["exc_info"] = True
            logger.error("Unhandled exception during request", **log_payload)

        # Re-raise the exception. FastAPI's exception handlers (defined above)
        # will catch it and generate the appropriate JSON response.
        raise exc
    finally:
        # Ensure context is cleared after the request is fully handled
        structlog.contextvars.clear_contextvars()

    return response


# --- Add slowapi Middleware ---
# Add AFTER context middleware, BEFORE security if desired
app.add_middleware(SlowAPIMiddleware)


# --- Mount Static Files ---
# Add AFTER middleware so static file requests are logged etc.
try:
    if STATIC_DIR.is_dir():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
        logger.info("Mounted static file directory", path=str(STATIC_DIR), url_path="/static")
    else:
        # Log as error because the frontend won't work without these files
        logger.error("Static directory does not exist, frontend will fail to load.", path=str(STATIC_DIR))
except Exception as e:
    # Use logger which should be configured by now
    logger.error("Could not mount static directory", path=str(STATIC_DIR), error=str(e), exc_info=True)


# --- Include API Routers ---
# Import and include routers AFTER 'app' is defined and middleware/handlers are set
# This ensures decorators within routers (like @limiter.limit) can find the app state if needed implicitly
try:
    from fastapi_simple_security import api_key_router # Library router
    from app.routers import routing # Your router
    app.include_router(api_key_router, prefix="/auth", tags=["_auth"])
    app.include_router(routing.router)
    logger.info("API routers included successfully.")
except Exception as router_err:
     logger.critical("Failed to include API routers!", error=str(router_err), exc_info=True)
     sys.exit("Exiting due to router configuration error.")


# --- Serve Frontend Interface ---
# Define route AFTER app initialization and router inclusion
@app.get("/", include_in_schema=False, tags=["Frontend"])
@limiter.exempt # Don't rate limit the main interface page load
async def read_interface():
    """Serves the main HTML page for the testing interface."""
    logger.debug("Serving frontend interface request")
    if not INDEX_HTML_FILE.is_file():
        logger.error("Interface file not found, cannot serve frontend.", path=str(INDEX_HTML_FILE))
        # Use 500 error as this is a server config issue
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Server configuration error: Interface file missing.")
    try:
        # Return the HTML file
        return FileResponse(str(INDEX_HTML_FILE))
    except Exception as e:
        # Catch potential errors during file reading/serving
        logger.error("Could not serve interface file", path=str(INDEX_HTML_FILE), error=str(e), exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not serve interface file.")


# --- Startup/Shutdown Events ---
@app.on_event("startup")
async def startup_event():
    # Logger is already configured
    logger.info("Application startup sequence initiated...")

    # Verify static dir
    if not STATIC_DIR.is_dir():
         logger.warning("Static directory check failed during startup", path=str(STATIC_DIR))
    else:
         logger.info("Static directory check OK", path=str(STATIC_DIR))

    # Log security status (Library handles actual key loading/generation)
    if settings.FASTAPI_SIMPLE_SECURITY_SECRET:
        logger.info("FastAPI Simple Security: Admin Secret LOADED from environment.")
    else:
        # The library logs the generated secret value
        logger.warning("FastAPI Simple Security: Admin Secret NOT SET in environment - check logs for auto-generated secret.")

    logger.info(f"FastAPI Simple Security: DB Location", path=str(settings.FASTAPI_SIMPLE_SECURITY_DB_LOCATION))
    # Check expiration setting (0 or negative means disabled in the library)
    if settings.FASTAPI_SIMPLE_SECURITY_AUTOMATIC_EXPIRATION <= 0:
         logger.info("FastAPI Simple Security: Key expiration DISABLED.")
    else:
         logger.info("FastAPI Simple Security: Key expiration ENABLED", days=settings.FASTAPI_SIMPLE_SECURITY_AUTOMATIC_EXPIRATION)

    # Log Rate Limit status
    if settings.RATE_LIMIT_ENABLED:
        logger.info("Rate Limiting: ENABLED", default_limit=settings.DEFAULT_RATE_LIMIT)
    else:
        logger.info("Rate Limiting: DISABLED")

    # Log OR-Tools status
    try:
        from app.services import tsp_solver # Import locally within startup
        if tsp_solver.ORTOOLS_AVAILABLE:
             logger.info("OR-Tools check: OK")
        else:
             # This is critical if routing is the core function
             logger.critical("OR-Tools check: FAILED - Library not found or importable. Routing endpoint will fail.")
    except Exception as e:
        logger.critical("OR-Tools check: FAILED - Error during import check.", error=str(e), exc_info=True)

    logger.info(f"{settings.APP_NAME} startup complete.", app_version=app.version) # Log app version


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Application shutdown sequence initiated...")
    # Add any cleanup tasks here (e.g., closing database connections if not managed elsewhere)
    logger.info("Application shutdown complete.")