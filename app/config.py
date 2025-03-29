# app/config.py
import os
import logging
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Set, Optional
from pathlib import Path
# Import the enums to use them for type hinting and default values
from app.models.schemas import LocalSearchStrategyEnum, FirstSolutionStrategyEnum

# Use standard logger for initial config loading messages
logger = logging.getLogger(__name__)
# Ensure basicConfig is called only if no handlers exist to avoid duplicates
if not logging.getLogger().hasHandlers():
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: [%(name)s] %(message)s')

# Define project root relative to this config file
PROJECT_ROOT_CONFIG = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    # --- Core Settings ---
    APP_NAME: str = "Route Planner API"
    LOG_LEVEL: str = "INFO" # Default log level (can be overridden by env var)

    # --- Feature Settings ---
    DEFAULT_AVERAGE_SPEED_KMH: float = 50.0
    DEFAULT_OUTLIER_THRESHOLD_KM: Optional[float] = 80.0

    # --- Solver Default Settings ---
    DEFAULT_SOLVER_TIME_LIMIT_SECONDS: int = 30
    DEFAULT_LOCAL_SEARCH_STRATEGY: LocalSearchStrategyEnum = LocalSearchStrategyEnum.TABU_SEARCH
    DEFAULT_FIRST_SOLUTION_STRATEGY: FirstSolutionStrategyEnum = FirstSolutionStrategyEnum.PATH_CHEAPEST_ARC

    # --- Rate Limiting ---
    RATE_LIMIT_ENABLED: bool = True
    DEFAULT_RATE_LIMIT: str = "10/minute"

    # --- Logging ---
    LOG_STRUCTURED: bool = True # Set to False for development console logging

    # --- FastAPI Simple Security Configuration ---
    FASTAPI_SIMPLE_SECURITY_SECRET: Optional[str] = None
    FASTAPI_SIMPLE_SECURITY_HIDE_DOCS: bool = False
    FASTAPI_SIMPLE_SECURITY_DB_LOCATION: Path = PROJECT_ROOT_CONFIG / "security_sqlite.db"
    FASTAPI_SIMPLE_SECURITY_AUTOMATIC_EXPIRATION: int = 15

    # --- Pydantic-Settings Configuration ---
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding='utf-8',
        extra='ignore',
        case_sensitive=False # Environment variables are usually uppercase
    )

# --- Settings Loading Function ---
@lru_cache(maxsize=None)
def get_settings() -> Settings:
    logger.info("Loading application settings...")
    try:
        settings_instance = Settings()
        logger.info("Settings initialized.")
        # Log loaded log level
        logger.info(f"Effective Log Level: {settings_instance.LOG_LEVEL}")

        db_path = settings_instance.FASTAPI_SIMPLE_SECURITY_DB_LOCATION
        try:
            db_path.parent.mkdir(parents=True, exist_ok=True)
            logger.info(f"Checked/created security DB directory: {db_path.parent}")
        except OSError as e:
            logger.error(f"Failed to create security DB directory: {db_path.parent} - Error: {e}")

        return settings_instance
    except Exception as e:
        logger.error(f"!!! Failed to initialize Settings: {e}", exc_info=True)
        raise RuntimeError(f"Could not load application settings: {e}")