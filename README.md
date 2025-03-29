# Route Planner API

A FastAPI application for optimizing multi-stop routes using Google OR-Tools Traveling Salesperson Problem (TSP) solver with Haversine distance calculation.

## Features

*   Optimizes routes for a list of geographic coordinates.
*   Uses the first location provided as the start/end depot.
*   Calculates distances using the Haversine formula.
*   Optionally filters outlier locations based on distance from the centroid.
*   Estimates travel duration based on a configurable average speed.
*   Provides a structured JSON response including:
    *   Route summary (total distance, duration, points optimized/excluded, calculation time).
    *   Ordered list of waypoints (`route`).
    *   Details of each travel segment (`legs`).
*   Includes Dockerfile for easy containerization and deployment.

## Project Structure