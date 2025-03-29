import unittest
from unittest.mock import patch, MagicMock
import importlib.util
import sys
import os

# Dynamically import the modules based on the code structure
class TestSolverTimeParameter(unittest.TestCase):
    def setUp(self):
        # Path to necessary modules
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Import necessary modules
        if importlib.util.find_spec("app.services.tsp_solver"):
            import app.services.tsp_solver as tsp_solver
            self.tsp_solver = tsp_solver
        else:
            self.skipTest("tsp_solver module not found")
            
        if importlib.util.find_spec("app.models.schemas"):
            import app.models.schemas as schemas
            self.schemas = schemas
        else:
            self.skipTest("schemas module not found")
    
    @patch('app.services.tsp_solver.pywrapcp')
    @patch('app.services.tsp_solver.create_distance_matrix')
    def test_solver_time_limit_parameter(self, mock_create_distance_matrix, mock_pywrapcp):
        """Test that the solver_time_limit_seconds parameter is correctly applied."""
        # Sample locations
        locations = [(40.7128, -74.0060), (40.7484, -73.9857)]
        
        # Mock the necessary objects and methods
        mock_manager = MagicMock()
        mock_routing = MagicMock()
        mock_search_parameters = MagicMock()
        mock_solution = MagicMock()
        
        # Setup mock returns
        mock_pywrapcp.RoutingIndexManager.return_value = mock_manager
        mock_pywrapcp.RoutingModel.return_value = mock_routing
        mock_pywrapcp.DefaultRoutingSearchParameters.return_value = mock_search_parameters
        mock_routing.SolveWithParameters.return_value = mock_solution
        mock_routing.status.return_value = 1  # Success status
        mock_create_distance_matrix.return_value = [[0, 1000], [1000, 0]]
        
        # Solution setup
        mock_solution.ObjectiveValue.return_value = 1000
        mock_routing.Start.return_value = 0
        mock_routing.IsEnd.side_effect = [False, True]  # Return False first time, True second time
        mock_solution.Value.return_value = 1
        mock_manager.IndexToNode.side_effect = [0, 1]  # Return node indices
        
        # Test with custom time limit
        custom_time_limit = 15
        result = self.tsp_solver.solve_tsp(locations, time_limit_seconds=custom_time_limit)
        
        # Verify the time limit was applied to search parameters
        mock_search_parameters.time_limit.FromSeconds.assert_called_with(custom_time_limit)
        
        # Test with None time limit (should use default)
        mock_search_parameters.reset_mock()
        result = self.tsp_solver.solve_tsp(locations, time_limit_seconds=None)
        
        # Should use default time limit (usually 30)
        default_time_limit = 30
        mock_search_parameters.time_limit.FromSeconds.assert_called_with(default_time_limit)

    def test_time_limit_validator(self):
        """Test the validator for solver_time_limit_seconds in OptimizeRequest schema."""
        # Create a sample request with various time limit values
        try:
            # Test with valid int
            request = self.schemas.OptimizeRequest(
                locations=[self.schemas.Location(latitude=40.7128, longitude=-74.0060)],
                solver_time_limit_seconds=15
            )
            self.assertEqual(request.solver_time_limit_seconds, 15)
            
            # Test with valid string (should convert to int)
            request = self.schemas.OptimizeRequest(
                locations=[self.schemas.Location(latitude=40.7128, longitude=-74.0060)],
                solver_time_limit_seconds="20"
            )
            self.assertEqual(request.solver_time_limit_seconds, 20)
            
            # Test with None (should stay None)
            request = self.schemas.OptimizeRequest(
                locations=[self.schemas.Location(latitude=40.7128, longitude=-74.0060)],
                solver_time_limit_seconds=None
            )
            self.assertIsNone(request.solver_time_limit_seconds)
            
        except Exception as e:
            self.fail(f"Schema validation failed: {str(e)}")
            
if __name__ == "__main__":
    unittest.main()