# Route Planner Codebase Guide

## Commands
- Run development server: `uvicorn app.main:app --reload`
- Run production server: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1`
- Install dependencies: `pip install -r requirements.txt`
- Build Docker image: `docker build -t route-planner .`
- Run Docker container: `docker run -p 8000:8000 route-planner`

## Code Style Guidelines
- **Imports**: Standard library → third-party → local (app.*)
- **Formatting**: 4-space indentation, 100 character line limit
- **Types**: Always use type annotations, import from `typing`
- **Naming**: snake_case for variables/functions, PascalCase for classes
- **Error handling**: Use try/except with specific exceptions
- **Constants**: UPPERCASE_WITH_UNDERSCORES
- **Logging**: Use structlog with consistent structure
- **Validation**: Use Pydantic models with Field validators
- **Docstrings**: Triple quotes, summary line then details