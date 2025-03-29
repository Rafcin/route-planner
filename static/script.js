/**
 * Route Optimizer - Modern JavaScript
 * A clean, modular implementation for the Route Optimizer application
 */

// Main application namespace
const RouteOptimizer = (() => {
  // Configuration
  const config = {
    apiEndpoint: '/routing/optimize',
    mapDefaultView: [40.7128, -74.0060], // NYC
    mapDefaultZoom: 10,
    storageKeyApiKey: 'routeOptimizerApiKey',
    toastDuration: 3000, // milliseconds
    logPrefix: '[RouteOptimizer]'
  };

  // Example data sets
  const exampleData = {
    nyc: [
      {"id": "depot", "latitude": 40.7128, "longitude": -74.0060, "name": "NYC Depot"},
      {"latitude": 40.7484, "longitude": -73.9857, "name": "Empire State Building"},
      {"latitude": 40.7527, "longitude": -73.9772, "name": "Grand Central Terminal"},
      {"latitude": 40.7587, "longitude": -73.9787, "name": "Rockefeller Center"},
      {"latitude": 40.7484, "longitude": -73.9878, "name": "Times Square"},
      {"latitude": 40.7425, "longitude": -73.9891, "name": "Macy's Herald Square"},
      {"latitude": 40.7061, "longitude": -74.0088, "name": "9/11 Memorial"}
    ],
    jacksonville: [
      {"id": "depot", "latitude": 30.3322, "longitude": -81.6557, "name": "JAX Depot"},
      {"latitude": 30.3243, "longitude": -81.6612, "name": "TIAA Bank Field"},
      {"latitude": 30.3241, "longitude": -81.6383, "name": "Veterans Memorial Arena"},
      {"latitude": 30.3099, "longitude": -81.6613, "name": "Museum of Science & History"},
      {"latitude": 30.3219, "longitude": -81.6390, "name": "Daily's Place Amphitheater"},
      {"latitude": 30.3250, "longitude": -81.6590, "name": "James Weldon Johnson Park"},
      {"latitude": 30.3197, "longitude": -81.6589, "name": "Main Library"}
    ]
  };

  // State
  let state = {
    map: null,
    mapLayers: {
      base: {
        standard: null,
        satellite: null
      },
      current: 'standard',
      markers: [],
      polylines: [],
      decorators: []
    },
    elements: {},
    optimization: {
      inProgress: false,
      result: null
    }
  };

  // Logger utility
  const logger = {
    log: (message, data) => console.log(`${config.logPrefix} ${message}`, data || ''),
    info: (message, data) => console.info(`${config.logPrefix} ${message}`, data || ''),
    warn: (message, data) => console.warn(`${config.logPrefix} ${message}`, data || ''),
    error: (message, data) => console.error(`${config.logPrefix} ${message}`, data || '')
  };

  // DOM utilities
  const dom = {
    getElements: () => {
      const elements = {
        // Map elements
        map: document.getElementById('map'),
        resetMapButton: document.getElementById('resetMapButton'),
        toggleSatelliteButton: document.getElementById('toggleSatelliteButton'),

        // Input elements
        apiKeyInput: document.getElementById('apiKeyInput'),
        locationsInput: document.getElementById('locationsInput'),
        averageSpeed: document.getElementById('averageSpeed'),
        outlierThreshold: document.getElementById('outlierThreshold'),
        solverTimeLimit: document.getElementById('solverTimeLimit'),
        localSearchStrategy: document.getElementById('localSearchStrategy'),
        firstSolutionStrategy: document.getElementById('firstSolutionStrategy'),

        // Buttons
        optimizeButton: document.getElementById('optimizeButton'),
        loadNYCButton: document.getElementById('loadNYCButton'),
        loadExampleButton: document.getElementById('loadExampleButton'),
        copyResponseButton: document.getElementById('copyResponseButton'),
        formatJsonButton: document.getElementById('formatJsonButton'),

        // Status and output elements
        statusMessage: document.getElementById('statusMessage'),
        apiResponse: document.getElementById('apiResponse'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toast: document.getElementById('toast'),
        toastMessage: document.getElementById('toastMessage'),

        // Statistics elements
        routeStatsCard: document.getElementById('routeStatsCard'),
        totalDistance: document.getElementById('totalDistance'),
        totalDuration: document.getElementById('totalDuration'),
        locationsVisited: document.getElementById('locationsVisited')
      };

      // Check if all required elements exist
      const missingElements = Object.entries(elements)
        .filter(([key, element]) => !element)
        .map(([key]) => key);

      if (missingElements.length > 0) {
        logger.warn('Missing DOM elements:', missingElements);
      }

      return elements;
    }
  };

  // Map utilities
  const mapUtils = {
    init: () => {
      try {
        if (!state.elements.map) {
          logger.error('Map container element not found');
          return false;
        }

        console.log('Initializing map with container:', state.elements.map);

        // Initialize the map with options
        state.map = L.map('map', {
          center: config.mapDefaultView,
          zoom: config.mapDefaultZoom,
          zoomControl: true,
          scrollWheelZoom: true
        });

        console.log('Map object created:', state.map);

        // Create and add tile layers
        try {
          // Standard layer (OpenStreetMap)
          state.mapLayers.base.standard = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          });
          
          // Add the standard layer to the map
          state.mapLayers.base.standard.addTo(state.map);
          console.log('Standard map layer added');

          // Satellite layer (ESRI)
          state.mapLayers.base.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: '© Esri'
          });
          console.log('Satellite map layer created (not added yet)');

          // Force a resize to ensure proper rendering
          setTimeout(() => {
            state.map.invalidateSize();
            console.log('Map size invalidated for proper rendering');
          }, 100);
        
        } catch (layerError) {
          console.error('Error creating map layers:', layerError);
        }

        logger.info('Map initialized successfully');
        return true;
      } catch (error) {
        console.error('Failed to initialize map:', error);
        logger.error('Failed to initialize map', error);
        ui.setStatus('Map initialization failed', 'error');
        return false;
      }
    },

    toggleSatellite: () => {
      if (state.mapLayers.current === 'standard') {
        state.map.removeLayer(state.mapLayers.base.standard);
        state.map.addLayer(state.mapLayers.base.satellite);
        state.mapLayers.current = 'satellite';
        state.elements.toggleSatelliteButton.textContent = 'Show Standard';
      } else {
        state.map.removeLayer(state.mapLayers.base.satellite);
        state.map.addLayer(state.mapLayers.base.standard);
        state.mapLayers.current = 'standard';
        state.elements.toggleSatelliteButton.textContent = 'Toggle Satellite';
      }
    },

    resetView: () => {
      if (state.mapLayers.markers.length > 0) {
        const group = L.featureGroup(state.mapLayers.markers);
        state.map.fitBounds(group.getBounds(), { padding: [30, 30] });
      } else {
        state.map.setView(config.mapDefaultView, config.mapDefaultZoom);
      }
    },

    clearLayers: () => {
      // Remove markers
      state.mapLayers.markers.forEach(marker => {
        state.map.removeLayer(marker);
      });

      // Remove polylines
      state.mapLayers.polylines.forEach(polyline => {
        state.map.removeLayer(polyline);
      });

      // Remove decorators
      state.mapLayers.decorators.forEach(decorator => {
        state.map.removeLayer(decorator);
      });

      // Reset arrays
      state.mapLayers.markers = [];
      state.mapLayers.polylines = [];
      state.mapLayers.decorators = [];

      logger.info('Map layers cleared');
    },

    displayRoute: (locations, sequence) => {
      console.log('displayRoute called with:', { 
        locationsCount: locations?.length || 0, 
        sequenceCount: sequence?.length || 0,
        map: state.map
      });
      
      // Clear existing layers
      mapUtils.clearLayers();

      // Validate inputs
      if (!locations || !sequence || !Array.isArray(locations) || !Array.isArray(sequence) || 
          locations.length === 0 || sequence.length === 0) {
        console.warn('No valid route data to display');
        logger.warn('No valid route data to display');
        return;
      }

      // Ensure map is available
      if (!state.map) {
        console.error('Map not initialized');
        logger.error('Map not initialized, cannot display route');
        return;
      }

      console.log('Displaying route on map', { 
        locations: locations.length, 
        sequence: sequence.length,
        firstLocation: locations[0],
        firstSequencePoint: sequence[0]
      });

      // Create bounds for fitting map
      const bounds = [];

      // Depot and location icons
      const depotIcon = L.divIcon({
        html: `<div class="w-5 h-5 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center"></div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const locationIcon = L.divIcon({
        html: `<div class="w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-md"></div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      // Add markers for each location
      try {
        locations.forEach((location, idx) => {
          if (!location || typeof location !== 'object') {
            console.warn(`Location at index ${idx} is not an object:`, location);
            return; // Skip invalid locations
          }
          
          // Make sure latitude and longitude are valid numbers
          const lat = parseFloat(location.latitude);
          const lng = parseFloat(location.longitude);
          
          if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates at index ${idx}:`, location);
            return; // Skip invalid locations
          }
          
          const isDepot = idx === 0;
          const icon = isDepot ? depotIcon : locationIcon;
          
          try {
            const marker = L.marker(
              [lat, lng],
              { icon: icon }
            );

            const name = location.name || (isDepot ? 'Depot' : `Location ${idx}`);
            marker.bindTooltip(name, {
              permanent: false,
              direction: 'top',
              offset: [0, -10]
            });

            marker.addTo(state.map);
            state.mapLayers.markers.push(marker);
            bounds.push([lat, lng]);
            
            console.log(`Added marker for location ${idx}: ${name} at [${lat}, ${lng}]`);
          } catch (markerError) {
            console.error(`Error creating marker for location ${idx}:`, markerError);
          }
        });
      } catch (markersError) {
        console.error('Error adding location markers:', markersError);
      }

      // Create route polyline
      try {
        // Filter out any invalid indices
        const validSequence = sequence.filter(idx => idx >= 0 && idx < locations.length);
        console.log('Valid sequence for polyline:', validSequence);
        
        if (validSequence.length === 0) {
          console.warn('No valid sequence indices to create polyline');
          return;
        }
        
        const routePoints = [];
        for (const idx of validSequence) {
          const loc = locations[idx];
          
          if (!loc || typeof loc !== 'object') {
            console.warn(`Missing or invalid location at index ${idx}`);
            continue;
          }
          
          const lat = parseFloat(loc.latitude);
          const lng = parseFloat(loc.longitude);
          
          if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates at index ${idx}:`, loc);
            continue;
          }
          
          routePoints.push([lat, lng]);
        }
        
        console.log('Route points for polyline:', routePoints);

        if (routePoints.length > 1) {
          // Create and add the polyline
          try {
            const polyline = L.polyline(routePoints, {
              color: '#4f46e5',
              weight: 4,
              opacity: 0.7,
              lineJoin: 'round'
            }).addTo(state.map);

            state.mapLayers.polylines.push(polyline);
            console.log('Added polyline to map');

            // Add arrow decorations
            try {
              const decorator = L.polylineDecorator(polyline, {
                patterns: [
                  {
                    offset: 25,
                    repeat: 100,
                    symbol: L.Symbol.arrowHead({
                      pixelSize: 12,
                      polygon: false,
                      pathOptions: {
                        stroke: true,
                        color: '#4338ca',
                        weight: 3
                      }
                    })
                  }
                ]
              }).addTo(state.map);

              state.mapLayers.decorators.push(decorator);
              console.log('Added decorator to polyline');
            } catch (decoratorError) {
              console.error('Error adding polyline decorator:', decoratorError);
            }
          } catch (polylineError) {
            console.error('Error creating polyline:', polylineError);
          }
        } else {
          console.warn('Not enough valid points to create a polyline');
        }
      } catch (routeError) {
        console.error('Error creating route polyline:', routeError);
      }

      // Add sequence numbers
      try {
        sequence.forEach((locationIdx, sequenceIdx) => {
          // Skip invalid indices
          if (locationIdx < 0 || locationIdx >= locations.length) {
            console.warn(`Invalid location index ${locationIdx} for sequence label`);
            return;
          }
          
          // Skip the final return to depot in the labels
          if (sequenceIdx === sequence.length - 1 && locationIdx === 0) {
            return;
          }

          const location = locations[locationIdx];
          if (!location || typeof location !== 'object') {
            console.warn(`Missing location for sequence label at index ${locationIdx}`);
            return;
          }
          
          // Make sure latitude and longitude are valid numbers
          const lat = parseFloat(location.latitude);
          const lng = parseFloat(location.longitude);
          
          if (isNaN(lat) || isNaN(lng)) {
            console.warn(`Invalid coordinates for sequence label at index ${locationIdx}:`, location);
            return;
          }

          try {
            const label = L.divIcon({
              html: `<div class="w-5 h-5 rounded-full bg-white border border-gray-400 shadow flex items-center justify-center text-xs font-bold">${sequenceIdx + 1}</div>`,
              className: 'sequence-label',
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            });

            const marker = L.marker([lat, lng], {
              icon: label,
              zIndexOffset: 1000
            }).addTo(state.map);

            state.mapLayers.markers.push(marker);
            console.log(`Added sequence label ${sequenceIdx + 1} at location ${locationIdx}`);
          } catch (labelError) {
            console.error(`Error adding sequence label ${sequenceIdx}:`, labelError);
          }
        });
      } catch (sequenceError) {
        console.error('Error adding sequence labels:', sequenceError);
      }

      // Fit map to bounds
      try {
        if (bounds.length > 0) {
          console.log(`Fitting map to ${bounds.length} bounds`);
          
          // Create feature group with all visible elements
          const elements = state.mapLayers.markers.concat(state.mapLayers.polylines);
          if (elements.length > 0) {
            const layerGroup = L.featureGroup(elements);
            const mapBounds = layerGroup.getBounds();
            
            if (mapBounds.isValid()) {
              state.map.fitBounds(mapBounds, { 
                padding: [30, 30],
                animate: true,
                duration: 0.5
              });
              console.log('Map bounds set successfully');
              
              // Force a map update
              setTimeout(() => {
                state.map.invalidateSize();
                console.log('Map size invalidated after bounds');
              }, 200);
            } else {
              console.warn('Invalid bounds from layer group');
              // Fallback to reset view
              state.map.setView(config.mapDefaultView, config.mapDefaultZoom);
            }
          } else {
            console.warn('No elements to create bounds with');
            state.map.setView(config.mapDefaultView, config.mapDefaultZoom);
          }
        } else {
          console.warn('No bounds points collected');
          state.map.setView(config.mapDefaultView, config.mapDefaultZoom);
        }
      } catch (boundsError) {
        console.error('Error setting map bounds:', boundsError);
        // Emergency fallback
        try {
          state.map.setView(config.mapDefaultView, config.mapDefaultZoom);
        } catch (e) {
          console.error('Failed even to reset map view:', e);
        }
      }

      logger.info('Route displayed on map');
      console.log('Route display complete');
    }
  };

  // UI utilities
  const ui = {
    setStatus: (message, type = 'info') => {
      if (!state.elements.statusMessage) return;

      // Log the status change
      if (type === 'error') {
        logger.error(`Status: ${message}`);
      } else {
        logger.info(`Status: ${message}`);
      }

      // Update the status message
      state.elements.statusMessage.textContent = message;

      // Apply appropriate styling
      state.elements.statusMessage.className = 'mt-3 text-sm font-medium text-center h-6';

      switch (type) {
        case 'success':
          state.elements.statusMessage.classList.add('text-green-600');
          break;
        case 'error':
          state.elements.statusMessage.classList.add('text-red-600');
          break;
        case 'warning':
          state.elements.statusMessage.classList.add('text-yellow-600');
          break;
        default:
          state.elements.statusMessage.classList.add('text-gray-600');
      }
    },

    showToast: (message, isError = false) => {
      if (!state.elements.toast || !state.elements.toastMessage) return;

      state.elements.toastMessage.textContent = message;
      state.elements.toast.className = isError
        ? 'toast show bg-red-600'
        : 'toast show bg-indigo-600';

      setTimeout(() => {
        state.elements.toast.className = 'toast';
      }, config.toastDuration);
    },

    loadExampleData: (dataSet) => {
      if (!state.elements.locationsInput) return;

      try {
        const data = exampleData[dataSet];
        if (!data) {
          throw new Error(`Unknown example data set: ${dataSet}`);
        }

        state.elements.locationsInput.value = JSON.stringify(data, null, 2);
        ui.showToast(`${dataSet.charAt(0).toUpperCase() + dataSet.slice(1)} example data loaded`);
        logger.info(`Example data loaded: ${dataSet}`);
      } catch (error) {
        logger.error(`Failed to load example data: ${dataSet}`, error);
        ui.showToast('Failed to load example data', true);
      }
    },

    setLoading: (isLoading) => {
      if (state.elements.optimizeButton && state.elements.loadingOverlay) {
        if (isLoading) {
          state.elements.optimizeButton.disabled = true;
          state.elements.optimizeButton.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...';
          state.elements.loadingOverlay.classList.remove('hidden');
        } else {
          state.elements.optimizeButton.disabled = false;
          state.elements.optimizeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Optimize Route';
          state.elements.loadingOverlay.classList.add('hidden');
        }
      }
    },

    formatJson: () => {
      const responseElement = state.elements.apiResponse;
      if (!responseElement) return;

      try {
        const content = responseElement.textContent;
        if (content && content !== 'Response data will appear here...') {
          const jsonObj = JSON.parse(content);
          const formattedJson = JSON.stringify(jsonObj, null, 2);
          responseElement.textContent = formattedJson;
        }
      } catch (error) {
        logger.error('Failed to format JSON', error);
        ui.showToast('Failed to format JSON', true);
      }
    },

    copyToClipboard: () => {
      const responseElement = state.elements.apiResponse;
      if (!responseElement) return;

      const textToCopy = responseElement.textContent;
      if (textToCopy && textToCopy !== 'Response data will appear here...') {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            ui.showToast('Response copied to clipboard!');
          })
          .catch(error => {
            logger.error('Failed to copy to clipboard', error);
            ui.showToast('Failed to copy text', true);
          });
      }
    },

    updateRouteStats: (response) => {
      if (!state.elements.routeStatsCard) return;

      try {
        // Log what we're working with
        console.log('UPDATING ROUTE STATS WITH:', response);
        
        // Ensure route stats card is visible
        state.elements.routeStatsCard.classList.remove('hidden');

        // Check if we have summary data
        if (!response || !response.summary) {
          console.error('Missing summary data in response:', response);
          state.elements.totalDistance.textContent = 'Error';
          state.elements.totalDuration.textContent = 'Error';
          state.elements.locationsVisited.textContent = 'Error';
          return;
        }
        
        console.log('SUMMARY DATA:', response.summary);

        // Update total distance - defensively handle all possible null/undefined cases
        if (state.elements.totalDistance) {
          const totalDistance = response.summary.total_distance_meters;
          if (totalDistance !== null && totalDistance !== undefined) {
            const distanceKm = totalDistance / 1000;
            state.elements.totalDistance.textContent = `${distanceKm.toFixed(2)} km`;
            console.log(`Set distance to ${distanceKm.toFixed(2)} km`);
          } else {
            state.elements.totalDistance.textContent = 'N/A';
            console.log('No distance data available');
          }
        }

        // Update total duration - defensively handle all possible null/undefined cases
        if (state.elements.totalDuration) {
          const totalDuration = response.summary.total_duration_seconds;
          if (totalDuration !== null && totalDuration !== undefined) {
            const durationMinutes = totalDuration / 60;
            state.elements.totalDuration.textContent = `${durationMinutes.toFixed(1)} min`;
            console.log(`Set duration to ${durationMinutes.toFixed(1)} min`);
          } else {
            state.elements.totalDuration.textContent = 'N/A';
            console.log('No duration data available');
          }
        }

        // Update locations count - defensively handle all possible null/undefined cases
        if (state.elements.locationsVisited) {
          const count = response.summary.num_locations_optimized;
          if (count !== null && count !== undefined) {
            state.elements.locationsVisited.textContent = count.toString();
            console.log(`Set locations visited to ${count}`);
          } else {
            state.elements.locationsVisited.textContent = '0';
            console.log('No locations count available');
          }
        }
        
        logger.info('Route statistics updated successfully', response.summary);
      } catch (error) {
        console.error('Failed to update route statistics:', error);
        logger.error('Failed to update route statistics', error);
        
        // Set fallback values on error
        if (state.elements.totalDistance) state.elements.totalDistance.textContent = 'Error';
        if (state.elements.totalDuration) state.elements.totalDuration.textContent = 'Error';
        if (state.elements.locationsVisited) state.elements.locationsVisited.textContent = 'Error';
      }
    }
  };

  // API utilities
  const api = {
    optimizeRoute: async () => {
      // Validate inputs first
      let locations;
      try {
        locations = JSON.parse(state.elements.locationsInput.value);
        if (!Array.isArray(locations) || locations.length < 2) {
          throw new Error('Please provide at least 2 locations');
        }
      } catch (error) {
        throw new Error('Invalid JSON format for locations');
      }

      const apiKey = state.elements.apiKeyInput.value.trim();
      if (!apiKey) {
        throw new Error('API Key is required');
      }

      // DEBUG: Log all form elements directly
      console.log("DEBUG FORM VALUES DIRECTLY:");
      console.log("solverTimeLimit element exists:", !!state.elements.solverTimeLimit);
      if (state.elements.solverTimeLimit) {
        console.log("solverTimeLimit value:", state.elements.solverTimeLimit.value);
        console.log("solverTimeLimit value type:", typeof state.elements.solverTimeLimit.value);
        console.log("solverTimeLimit value length:", state.elements.solverTimeLimit.value.length);
        console.log("solverTimeLimit value numerical:", Number(state.elements.solverTimeLimit.value));
      }
      
      // Build request body - FIX THE FORMAT ISSUE
      // We need to match the actual format being sent
      const requestBody = {
        locations: locations,
        // Create options object since that's what the frontend is actually sending
        options: {}
      };

      // Add optional parameters if provided - with extensive validation and debugging
      
      // Check for average speed parameter
      const averageSpeed = state.elements.averageSpeed.value.trim();
      if (averageSpeed) {
        const speedValue = parseFloat(averageSpeed);
        console.log(`Average speed: value=${averageSpeed}, parsed=${speedValue}, type=${typeof speedValue}`);
        if (!isNaN(speedValue)) {
          // Add to options object not root
          requestBody.options.average_speed_kmh = speedValue;
        }
      }

      // Check for outlier threshold parameter
      const outlierThreshold = state.elements.outlierThreshold.value.trim();
      if (outlierThreshold !== '') {
        const thresholdValue = parseFloat(outlierThreshold);
        console.log(`Outlier threshold: value=${outlierThreshold}, parsed=${thresholdValue}, type=${typeof thresholdValue}`);
        if (!isNaN(thresholdValue)) {
          // Add to options object not root
          requestBody.options.outlier_threshold_km = thresholdValue;
        }
      }

      // Get solver time limit directly from form input
      const solverTimeLimit = state.elements.solverTimeLimit.value.trim();
      console.log(`Form solver time limit value: "${solverTimeLimit}"`);
      
      // Only add if not empty
      if (solverTimeLimit !== '') {
        // Convert to number (force integer)
        const timeLimitValue = parseInt(solverTimeLimit, 10);
        
        // Only use if valid
        if (!isNaN(timeLimitValue) && timeLimitValue > 0) {
          // Add to options object not root
          requestBody.options.solver_time_limit_seconds = timeLimitValue;
          console.log(`USING INPUT TIME LIMIT: options.solver_time_limit_seconds=${timeLimitValue} in request`);
        } else {
          console.warn(`Invalid time limit value: ${solverTimeLimit}, not using it`);
        }
      } else {
        console.log("No solver time limit provided in form");
      }
      
      // Log request details for debugging
      const reqKeys = Object.keys(requestBody);
      console.log(`Request body keys: ${reqKeys.join(', ')}`);
      console.log(`Options keys: ${Object.keys(requestBody.options).join(', ')}`);
      
      // Check time limit type if present in options
      if ('solver_time_limit_seconds' in requestBody.options) {
        console.log(`TIME LIMIT VALUE: ${requestBody.options.solver_time_limit_seconds}`);
        console.log(`TIME LIMIT TYPE: ${typeof requestBody.options.solver_time_limit_seconds}`);
        
        // Ensure it's a number
        if (typeof requestBody.options.solver_time_limit_seconds !== 'number') {
          console.error("TIME LIMIT IS NOT A NUMBER TYPE! Converting...");
          requestBody.options.solver_time_limit_seconds = Number(requestBody.options.solver_time_limit_seconds);
        }
      }

      // Check for local search strategy parameter
      const localSearchStrategy = state.elements.localSearchStrategy.value;
      if (localSearchStrategy) {
        console.log(`Local search strategy: ${localSearchStrategy}`);
        // Add to options object not root
        requestBody.options.local_search_strategy = localSearchStrategy;
      }

      // Check for first solution strategy parameter
      const firstSolutionStrategy = state.elements.firstSolutionStrategy.value;
      if (firstSolutionStrategy) {
        console.log(`First solution strategy: ${firstSolutionStrategy}`);
        // Add to options object not root
        requestBody.options.first_solution_strategy = firstSolutionStrategy;
      }

      logger.info('Optimizing route with parameters', { 
        solver_time_limit_seconds: requestBody.options.solver_time_limit_seconds,
        average_speed_kmh: requestBody.options.average_speed_kmh,
        outlier_threshold_km: requestBody.options.outlier_threshold_km,
        local_search_strategy: requestBody.options.local_search_strategy,
        first_solution_strategy: requestBody.options.first_solution_strategy
      });

      // Make actual API request
      try {
        const headers = new Headers({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': apiKey
        });

        // Convert request body to JSON and log it 
        const jsonBody = JSON.stringify(requestBody);
        console.log('EXACT REQUEST BEING SENT (JSON string):', jsonBody);
        console.log('EXACT REQUEST BEING SENT (parsed back):', JSON.parse(jsonBody));
        
        // Log all parameters for debugging
        logger.info(`Sending request to ${config.apiEndpoint}`, {
          solver_time_limit_seconds: requestBody.solver_time_limit_seconds,
          average_speed_kmh: requestBody.average_speed_kmh,
          outlier_threshold_km: requestBody.outlier_threshold_km,
          local_search_strategy: requestBody.local_search_strategy,
          first_solution_strategy: requestBody.first_solution_strategy
        });

        const response = await fetch(config.apiEndpoint, {
          method: 'POST',
          headers: headers,
          body: jsonBody
        });

        // Log response status
        logger.info(`Received response with status: ${response.status}`);

        // Get request ID from headers if present
        const requestId = response.headers.get('X-Request-ID');
        if (requestId) {
          logger.info(`Request ID: ${requestId}`);
        }

        // Handle non-OK responses
        if (!response.ok) {
          let errorMessage = `API error: ${response.status}`;

          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch (parseError) {
            logger.error('Failed to parse error response', parseError);
            // Try to get text instead
            const errorText = await response.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          }

          throw new Error(errorMessage);
        }

        // Parse successful response
        const responseData = await response.json();
        logger.info('API request successful', responseData);
        return responseData;

      } catch (fetchError) {
        logger.error('API request failed', fetchError);

        // Check if it's a network error
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          throw new Error('Network error: Please check your internet connection and ensure the API server is running.');
        }

        // Re-throw the error
        throw fetchError;
      }
    },

    saveApiKey: (apiKey) => {
      try {
        if (apiKey) {
          localStorage.setItem(config.storageKeyApiKey, apiKey);
          logger.info('API key saved to local storage');
        }
      } catch (error) {
        logger.error('Failed to save API key to local storage', error);
      }
    },

    loadApiKey: () => {
      try {
        return localStorage.getItem(config.storageKeyApiKey) || '';
      } catch (error) {
        logger.error('Failed to load API key from local storage', error);
        return '';
      }
    }
  };

  // Event handlers
  const events = {
    bindEvents: () => {
      // Map buttons
      if (state.elements.resetMapButton) {
        state.elements.resetMapButton.addEventListener('click', mapUtils.resetView);
      }

      if (state.elements.toggleSatelliteButton) {
        state.elements.toggleSatelliteButton.addEventListener('click', mapUtils.toggleSatellite);
      }

      // Example data buttons
      if (state.elements.loadNYCButton) {
        state.elements.loadNYCButton.addEventListener('click', () => ui.loadExampleData('nyc'));
      }

      if (state.elements.loadExampleButton) {
        state.elements.loadExampleButton.addEventListener('click', () => ui.loadExampleData('jacksonville'));
      }

      // API Key storage
      if (state.elements.apiKeyInput) {
        state.elements.apiKeyInput.addEventListener('change', () => {
          api.saveApiKey(state.elements.apiKeyInput.value.trim());
        });
      }

      // Response actions
      if (state.elements.formatJsonButton) {
        state.elements.formatJsonButton.addEventListener('click', ui.formatJson);
      }

      if (state.elements.copyResponseButton) {
        state.elements.copyResponseButton.addEventListener('click', ui.copyToClipboard);
      }

      // Optimize button
      if (state.elements.optimizeButton) {
        state.elements.optimizeButton.addEventListener('click', events.handleOptimize);
      }

      logger.info('Event listeners bound successfully');
    },

    handleOptimize: async () => {
      // Prevent multiple submissions
      if (state.optimization.inProgress) return;
      state.optimization.inProgress = true;

      // Clear previous results
      mapUtils.clearLayers();

      // Update UI to loading state
      ui.setLoading(true);
      ui.setStatus('Optimizing route...', 'info');

      if (state.elements.apiResponse) {
        state.elements.apiResponse.textContent = 'Processing request...';
      }

      try {
        // Call the API
        const response = await api.optimizeRoute();

        // Update response display
        if (state.elements.apiResponse) {
          state.elements.apiResponse.textContent = JSON.stringify(response, null, 2);
        }

        // Update route statistics
        ui.updateRouteStats(response);

        // Display route on map
        try {
          // Log the full response to debug the structure
          console.log('FULL API RESPONSE:', response);
          
          // Get the original locations from the input
          const inputLocations = JSON.parse(state.elements.locationsInput.value);
          console.log('INPUT LOCATIONS:', inputLocations);
          
          // Force map refresh (sometimes needed for visibility)
          if (state.map) {
            state.map.invalidateSize();
            console.log('Map invalidated before route display');
          }
          
          // Check response structure
          if (!response) {
            console.error('Response is empty or null');
            ui.setStatus('Error: Empty response from API', 'error');
            return;
          }
          
          // Check if route exists and is an array
          if (!response.route || !Array.isArray(response.route)) {
            console.error('Response missing route array or not an array:', response.route);
            ui.setStatus('Error: Invalid response format from API', 'error');
            return;
          }
          
          console.log('ROUTE POINTS FROM API:', response.route);
          
          // Check if we have route points
          if (response.route.length === 0) {
            console.warn('Route array is empty');
            ui.setStatus('Route is empty - nothing to display', 'warning');
            return;
          }
          
          // Check if route points have the expected structure
          const samplePoint = response.route[0];
          console.log('SAMPLE ROUTE POINT:', samplePoint);
          
          if (!samplePoint || typeof samplePoint !== 'object') {
            console.error('Route points are not objects:', samplePoint);
            ui.setStatus('Error: Invalid route point format', 'error');
            return;
          }
          
          // Be more flexible with property names - check what we have
          const hasOriginalIndex = samplePoint.hasOwnProperty('original_index');
          const hasVisitOrder = samplePoint.hasOwnProperty('visit_order');
          
          console.log(`Point properties: original_index=${hasOriginalIndex}, visit_order=${hasVisitOrder}`);
          
          if (!hasOriginalIndex) {
            console.error('Route points missing original_index property:', samplePoint);
            ui.setStatus('Error: Route points missing original_index', 'error');
            return;
          }
          
          // Sort route points by visit_order if available, otherwise keep original order
          let sortedPoints;
          if (hasVisitOrder) {
            sortedPoints = [...response.route].sort((a, b) => {
              // Handle missing visit_order by defaulting to index 0
              const aOrder = a.visit_order !== undefined ? a.visit_order : 0;
              const bOrder = b.visit_order !== undefined ? b.visit_order : 0;
              return aOrder - bOrder;
            });
          } else {
            // If visit_order isn't available, assume they're already in order
            sortedPoints = [...response.route];
          }
          
          console.log('SORTED ROUTE POINTS:', sortedPoints);
          
          // Create sequence of original indices
          const sequence = sortedPoints.map(point => {
            // Safely extract original_index with fallback to 0
            const idx = point.original_index;
            return idx !== undefined && idx !== null ? idx : 0;
          });
          
          console.log('SEQUENCE TO DISPLAY:', sequence);
          
          // Make sure the sequence indices are within bounds
          const validSequence = sequence.filter(idx => idx >= 0 && idx < inputLocations.length);
          
          if (validSequence.length !== sequence.length) {
            console.warn(`Filtered ${sequence.length - validSequence.length} invalid indices`);
          }
          
          if (validSequence.length === 0) {
            console.error('No valid sequence points to display');
            ui.setStatus('Error: No valid route points', 'error');
            return;
          }
          
          // Verify input locations have required properties
          const validatedLocations = inputLocations.map((loc, i) => {
            if (!loc || typeof loc !== 'object') {
              console.warn(`Location at index ${i} is not an object:`, loc);
              return null;
            }
            
            // Ensure latitude and longitude are numbers
            const lat = parseFloat(loc.latitude);
            const lng = parseFloat(loc.longitude);
            
            if (isNaN(lat) || isNaN(lng)) {
              console.warn(`Location at index ${i} has invalid coordinates:`, loc);
              return null;
            }
            
            // Return a validated location object
            return {
              ...loc,
              latitude: lat,
              longitude: lng
            };
          }).filter(loc => loc !== null);
          
          console.log('VALIDATED LOCATIONS:', validatedLocations);
          
          if (validatedLocations.length === 0) {
            console.error('No valid locations to display');
            ui.setStatus('Error: No valid locations', 'error');
            return;
          }
          
          // Call display function with a try-catch to ensure errors are caught
          try {
            mapUtils.displayRoute(validatedLocations, validSequence);
            logger.info('Route displayed on map', { 
              pointCount: response.route.length, 
              sequenceLength: validSequence.length 
            });
            
            // Force another map update after displaying the route
            setTimeout(() => {
              if (state.map) {
                state.map.invalidateSize();
                console.log('Map invalidated after route display');
              }
            }, 300);
          } catch (displayError) {
            console.error('Error in displayRoute function:', displayError);
            ui.setStatus('Error displaying route on map', 'error');
          }
        } catch (error) {
          console.error('Failed to display route on map:', error);
          logger.error('Failed to display route on map', error);
          ui.setStatus('Error displaying route on map', 'error');
        }

        // Update status
        ui.setStatus('Route optimized successfully!', 'success');

        logger.info('Route optimization completed successfully');
      } catch (error) {
        logger.error('Route optimization failed', error);

        // Update response area with error
        if (state.elements.apiResponse) {
          state.elements.apiResponse.textContent = JSON.stringify({
            status: "error",
            message: error.message
          }, null, 2);
        }

        // Update status
        ui.setStatus(error.message, 'error');
      } finally {
        // Reset loading state
        ui.setLoading(false);
        state.optimization.inProgress = false;
      }
    }
  };

  // Initialization
  const init = () => {
    logger.info('Initializing Route Optimizer application');

    // Get DOM elements
    state.elements = dom.getElements();

    // Initialize map
    if (!mapUtils.init()) {
      return false;
    }

    // Try to load saved API key
    const savedApiKey = api.loadApiKey();
    if (savedApiKey && state.elements.apiKeyInput) {
      state.elements.apiKeyInput.value = savedApiKey;
    }

    // Set default example data (NYC)
    ui.loadExampleData('nyc');

    // Bind event handlers
    events.bindEvents();

    // Ready!
    ui.setStatus('Ready to optimize routes');
    logger.info('Route Optimizer initialized successfully');

    return true;
  };

  // Public API
  return {
    init
  };
})();

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  RouteOptimizer.init();
});