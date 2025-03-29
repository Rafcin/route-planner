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

  const exampleData = {
    nycClassicTour: [
      {
        "id": "depot",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "name": "NYC Depot",
        "description": "Central starting point for the New York City Classic Tour."
      },
      {
        "id": "stop1",
        "latitude": 40.7484,
        "longitude": -73.9857,
        "name": "Empire State Building",
        "description": "Iconic skyscraper."
      },
      {
        "id": "stop2",
        "latitude": 40.7527,
        "longitude": -73.9772,
        "name": "Grand Central Terminal",
        "description": "Historic transportation hub."
      },
      {
        "id": "stop3",
        "latitude": 40.7587,
        "longitude": -73.9787,
        "name": "Rockefeller Center",
        "description": "Famous complex with art deco design."
      },
      {
        "id": "stop4",
        "latitude": 40.7484,
        "longitude": -73.9878,
        "name": "Times Square",
        "description": "Bright lights and bustling energy."
      },
      {
        "id": "stop5",
        "latitude": 40.7425,
        "longitude": -73.9891,
        "name": "Macy's Herald Square",
        "description": "Historic shopping destination."
      },
      {
        "id": "stop6",
        "latitude": 40.7061,
        "longitude": -74.0088,
        "name": "9/11 Memorial",
        "description": "Memorial and tribute to the events of 9/11."
      }
    ],
    jacksonvilleCityHighlights: [
      {
        "id": "depot",
        "latitude": 30.3322,
        "longitude": -81.6557,
        "name": "JAX Depot",
        "description": "Starting point for exploring Jacksonville."
      },
      {
        "id": "stop1",
        "latitude": 30.3243,
        "longitude": -81.6612,
        "name": "TIAA Bank Field",
        "description": "Modern stadium with a vibrant atmosphere."
      },
      {
        "id": "stop2",
        "latitude": 30.3241,
        "longitude": -81.6383,
        "name": "Veterans Memorial Arena",
        "description": "Venue for concerts and events."
      },
      {
        "id": "stop3",
        "latitude": 30.3099,
        "longitude": -81.6613,
        "name": "Museum of Science & History",
        "description": "Cultural and educational destination."
      },
      {
        "id": "stop4",
        "latitude": 30.3219,
        "longitude": -81.6390,
        "name": "Daily's Place Amphitheater",
        "description": "Outdoor venue for live performances."
      },
      {
        "id": "stop5",
        "latitude": 30.3250,
        "longitude": -81.6590,
        "name": "James Weldon Johnson Park",
        "description": "Urban park with recreational facilities."
      },
      {
        "id": "stop6",
        "latitude": 30.3197,
        "longitude": -81.6589,
        "name": "Main Library",
        "description": "Center for community learning and events."
      }
    ],
    sanFranciscoBayCircuit: [
      {
        "id": "depot",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "name": "Start",
        "description": "Route start in downtown San Francisco."
      },
      {
        "id": "stop1",
        "latitude": 37.7810,
        "longitude": -122.4114,
        "name": "Civic Center",
        "description": "Government and cultural hub."
      },
      {
        "id": "stop2",
        "latitude": 37.7898,
        "longitude": -122.3942,
        "name": "Union Square",
        "description": "Vibrant shopping district."
      },
      {
        "id": "stop3",
        "latitude": 37.7989,
        "longitude": -122.4078,
        "name": "North Beach",
        "description": "Italian-influenced neighborhood with cafes."
      },
      {
        "id": "stop4",
        "latitude": 37.8024,
        "longitude": -122.4058,
        "name": "Coit Tower",
        "description": "Historic landmark offering panoramic views."
      },
      {
        "id": "stop5",
        "latitude": 37.8100,
        "longitude": -122.4100,
        "name": "Fisherman's Wharf",
        "description": "Popular tourist destination with fresh seafood."
      },
      {
        "id": "stop6",
        "latitude": 37.8199,
        "longitude": -122.4783,
        "name": "Golden Gate Bridge",
        "description": "Iconic suspension bridge with breathtaking views."
      },
      {
        "id": "stop7",
        "latitude": 37.8079,
        "longitude": -122.4177,
        "name": "Presidio",
        "description": "Historic park and former military base."
      },
      {
        "id": "stop8",
        "latitude": 37.7694,
        "longitude": -122.4862,
        "name": "Golden Gate Park",
        "description": "Expansive park with museums, gardens, and lakes."
      },
      {
        "id": "stop9",
        "latitude": 37.7599,
        "longitude": -122.4148,
        "name": "Mission District",
        "description": "Neighborhood known for its vibrant murals."
      },
      {
        "id": "stop10",
        "latitude": 37.7689,
        "longitude": -122.4409,
        "name": "Haight-Ashbury",
        "description": "Historic counterculture district with unique shops."
      },
      {
        "id": "finish",
        "latitude": 37.7749,
        "longitude": -122.4194,
        "name": "Return to Start",
        "description": "Circuit completes its loop at the starting point."
      }
    ],
    pacificCoastExpedition: (function(){
      // Generate 40 stops from San Diego to San Francisco along the coast.
      const stops = [];
      const startLat = 32.7157, startLon = -117.1611;
      const finishLat = 37.7749, finishLon = -122.4194;
      const totalStops = 40;
      const segments = totalStops - 1;
      const latInc = (finishLat - startLat) / segments;
      const lonInc = (finishLon - startLon) / segments;

      for (let i = 0; i < totalStops; i++) {
        if (i === 0) {
          stops.push({
            "id": "depot",
            "latitude": startLat,
            "longitude": startLon,
            "name": "San Diego Harbor",
            "description": "Beginning of the Pacific Coast Expedition."
          });
        } else if (i === totalStops - 1) {
          stops.push({
            "id": "finish",
            "latitude": finishLat,
            "longitude": finishLon,
            "name": "San Francisco Bay",
            "description": "End of the scenic coastal journey."
          });
        } else {
          const lat = parseFloat((startLat + i * latInc).toFixed(4));
          const lon = parseFloat((startLon + i * lonInc).toFixed(4));
          stops.push({
            "id": "stop" + i,
            "latitude": lat,
            "longitude": lon,
            "name": "Coastal Stop " + i,
            "description": "Scenic coastal view stop number " + i + "."
          });
        }
      }
      return stops;
    })(),
    historicRoute66Adventure: (function(){
      // Generate 80 stops from Chicago to Los Angeles following a historic Route 66 vibe.
      const stops = [];
      const startLat = 41.8781, startLon = -87.6298;  // Chicago
      const finishLat = 34.0522, finishLon = -118.2437; // Los Angeles
      const totalStops = 80;
      const segments = totalStops - 1;
      const latInc = (finishLat - startLat) / segments;
      const lonInc = (finishLon - startLon) / segments;

      for (let i = 0; i < totalStops; i++) {
        if (i === 0) {
          stops.push({
            "id": "depot", // Change "start" to "depot" to match backend expectation
            "latitude": startLat,
            "longitude": startLon,
            "name": "Chicago Downtown",
            "description": "The vibrant start of the Route 66 adventure."
          });
        } else if (i === totalStops - 1) {
          stops.push({
            "id": "finish",
            "latitude": finishLat,
            "longitude": finishLon,
            "name": "LA Central",
            "description": "The grand finale in Los Angeles."
          });
        } else {
          const lat = parseFloat((startLat + i * latInc).toFixed(4));
          const lon = parseFloat((startLon + i * lonInc).toFixed(4));
          stops.push({
            "id": "stop" + i,
            "latitude": lat,
            "longitude": lon,
            "name": "Route 66 Stop " + i,
            "description": "Historic stop number " + i + " along Route 66."
          });
        }
      }
      return stops;
    })(),
    massiveClusterRoute: (function(){
      // Create a tightly clustered route with 100 items (1 depot + 99 stops)
      const stops = [];
      // Use a depot with a fixed id "depot" (to match backend expectations)
      const baseLat = 40.7128, baseLon = -74.0060;
      stops.push({
        "id": "depot",
        "latitude": baseLat,
        "longitude": baseLon,
        "name": "NYC Depot",
        "description": "Depot for the Massive Cluster Route."
      });
      let count = 1;
      // Build a 10x10 grid of stops (excluding the depot) within ~5km radius.
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          // Skip the top-left corner which is used as depot.
          if (i === 0 && j === 0) continue;
          const lat = baseLat + i * 0.005; // ~0.005° latitude increments (~0.55 km)
          const lon = baseLon + j * 0.005; // ~0.005° longitude increments
          stops.push({
            "id": "stop" + count,
            "latitude": parseFloat(lat.toFixed(4)),
            "longitude": parseFloat(lon.toFixed(4)),
            "name": "Cluster Stop " + count,
            "description": "Stop number " + count + " in the Massive Cluster Route."
          });
          count++;
          if (stops.length >= 100) break;
        }
        if (stops.length >= 100) break;
      }
      return stops;
    })(),
    orlandoSmokeShops: [
      {
        "id": "depot",
        "latitude": 28.384969,
        "longitude": -81.4995606,
        "name": "Smoke Shop 247 Inc",
        "description": "8484 Palm Pkwy, Orlando, FL"
      },
      {
        "id": "stop2",
        "latitude": 28.3853581,
        "longitude": -81.50761,
        "name": "Red Dragon LBV",
        "description": "12376 S Apopka Vineland Rd #103, Orlando, FL"
      },
      {
        "id": "stop3",
        "latitude": 28.3879181,
        "longitude": -81.5056776,
        "name": "Viva Smoke Shop",
        "description": "12195 S Apopka Vineland Rd Ste 103, Orlando, FL"
      },
      {
        "id": "stop4",
        "latitude": 28.4362798,
        "longitude": -81.4719379, 
        "name": "NY Smoke Shop",
        "description": "11945 S Apopka Vineland Rd, Orlando, FL"
      },
      {
        "id": "stop5",
        "latitude": 28.459005,
        "longitude": -81.4691447,
        "name": "Hywaze - 8957 International Dr",
        "description": "8957 International Dr Ste 301, Orlando, FL"
      },
      {
        "id": "stop6",
        "latitude": 28.4431336,
        "longitude": -81.4756662,
        "name": "Red Dragon Turkey Lake",
        "description": "8972 Turkey Lake Rd Ste A-600, Orlando, FL"
      },
      {
        "id": "stop7",
        "latitude": 28.4451377,
        "longitude": -81.4716027,
        "name": "Elite Vape & Smoke Shop - International Drive",
        "description": "8338 International Dr, Orlando, FL"
      },
      {
        "id": "stop8",
        "latitude": 28.4513394,
        "longitude": -81.4782455,
        "name": "Hywaze - Turkey Lake",
        "description": "7858 Turkey Lake Rd Ste 112, Orlando, FL"
      },
      {
        "id": "stop9",
        "latitude": 28.4591211,
        "longitude": -81.4684248,
        "name": "Hywaze - Near Universal",
        "description": "6450 International Dr, Orlando, FL"
      },
      {
        "id": "stop10",
        "latitude": 28.4591211,
        "longitude": -81.4684248,
        "name": "Zaman Smoke Shop",
        "description": "6400 International Dr Ste 150, Orlando, FL"
      },
      {
        "id": "stop11",
        "latitude": 28.4632592,
        "longitude": -81.4549557,
        "name": "Hywaze - Near Fun Spot",
        "description": "5531 International Dr, Orlando, FL"
      },
      {
        "id": "stop12",
        "latitude": 28.4621293,
        "longitude": -81.4532231,
        "name": "Universal Smoke Shop",
        "description": "5438 International Dr Ste A, Orlando, FL"
      },
      {
        "id": "stop13",
        "latitude": 28.4709596,
        "longitude": -81.4509775,
        "name": "Smoke Pharmacy",
        "description": "5135 International Dr Ste 14, Orlando, FL"
      },
      {
        "id": "stop14",
        "latitude": 28.4741946,
        "longitude": -81.451631,
        "name": "Camisteam",
        "description": "4965 International Dr, Orlando, FL"
      },
      {
        "id": "stop15",
        "latitude": 28.4844028,
        "longitude": -81.4595871,
        "name": "Hywaze - Kirkman Rd",
        "description": "5380 S Kirkman Rd, Orlando, FL"
      },
      {
        "id": "stop16",
        "latitude": 28.4833597,
        "longitude": -81.4562651,
        "name": "24/7 Smoke Shop",
        "description": "5661 Vineland Rd, Orlando, FL"
      },
      {
        "id": "stop17",
        "latitude": 28.485502,
        "longitude": -81.418724,
        "name": "Honey Smoke Shop",
        "description": "5348 S John Young Pkwy, Orlando, FL"
      },
      {
        "id": "stop18",
        "latitude": 28.4887007,
        "longitude": -81.4181775,
        "name": "USA Smoke Shop",
        "description": "5170 S John Young Pkwy, Orlando, FL"
      },
      {
        "id": "stop19",
        "latitude": 28.4891037,
        "longitude": -81.3967279,
        "name": "Hubci Smoke Shop",
        "description": "4945 S Orange Blossom Trail Unit 7, Orlando, FL"
      },
      {
        "id": "stop20",
        "latitude": 28.4732272,
        "longitude": -81.4019256,
        "name": "HYWAZE Smoke Shop - Oak Ridge",
        "description": "1725 W Oak Ridge Rd, Orlando, FL"
      },
      {
        "id": "stop21",
        "latitude": 28.4732272,
        "longitude": -81.4019256,
        "name": "Mr. Mojo's Smoke Shop",
        "description": "1725 W Oak Ridge Rd Unit 1725, Orlando, FL"
      },
      {
        "id": "stop22",
        "latitude": 28.4664684,
        "longitude": -81.3973309,
        "name": "ISmoke Outlet OBT",
        "description": "6220 S Orange Blossom Trl Ste 608, Orlando, FL"
      },
      {
        "id": "stop23",
        "latitude": 28.4493809,
        "longitude": -81.3968259,
        "name": "Cloud 07 Smoke Shop",
        "description": "1333 Florida Mall Ave, Orlando, FL"
      },
      {
        "id": "stop24",
        "latitude": 28.4460345,
        "longitude": -81.395459,
        "name": "Smoke Pro Gallery",
        "description": "8001 S Orange Blossom Trl, Orlando, FL"
      },
      {
        "id": "stop25",
        "latitude": 28.4504634,
        "longitude": -81.4039636,
        "name": "Hywaze - FL Mall",
        "description": "1937 Sand Lake Rd, Orlando, FL"
      },
      {
        "id": "stop26",
        "latitude": 28.4442958,
        "longitude": -81.4259058,
        "name": "McSmokin Smoke Shop",
        "description": "8373 S John Young Pkwy, Orlando, FL"
      },
      {
        "id": "stop27",
        "latitude": 28.428019,
        "longitude": -81.4040873,
        "name": "Toke Kings Smoke Shop",
        "description": "9251 S Orange Blossom Trl Ste 6, Orlando, FL"
      },
      {
        "id": "stop28",
        "latitude": 28.427133,
        "longitude": -81.4052813,
        "name": "Up In Smoke 2",
        "description": "9350 S Orange Blossom Trl #10, Orlando, FL"
      },
      {
        "id": "stop29",
        "latitude": 28.4209597,
        "longitude": -81.4042026,
        "name": "Hywaze - OBT",
        "description": "9521 S Orange Blossom Trail Ste 101, Orlando, FL"
      },
      {
        "id": "stop30",
        "latitude": 28.4024399,
        "longitude": -81.406121,
        "name": "Vip Smoke Shop Orlando",
        "description": "11218 S Orange Blossom Trail, Orlando, FL"
      },
      {
        "id": "stop31",
        "latitude": 28.3967685,
        "longitude": -81.4054249,
        "name": "Vape & Smoke Shop OBT",
        "description": "2120 Whisper Lakes Blvd, Orlando, FL"
      },
      {
        "id": "stop32",
        "latitude": 28.395067,
        "longitude": -81.4039436,
        "name": "Red Dragon Smoke Shop South OBT",
        "description": "11757 S Orange Blossom Trl Ste A, Orlando, FL"
      },
      {
        "id": "stop33",
        "latitude": 28.3926254,
        "longitude": -81.4033746,
        "name": "TruHemp CBD Store",
        "description": "11937 S Orange Blossom Trail, Orlando, FL"
      },
      {
        "id": "stop34",
        "latitude": 28.366423,
        "longitude": -81.4258285,
        "name": "eSmokerOnline",
        "description": "13651 Hunters Oak Dr #102, Orlando, FL"
      },
      {
        "id": "stop35",
        "latitude": 28.3807282,
        "longitude": -81.4247188,
        "name": "The Smoke Shop",
        "description": "12701 S John Young Pkwy Ste 116, Orlando, FL"
      },
      {
        "id": "stop36",
        "latitude": 28.4072706,
        "longitude": -81.4477047,
        "name": "Orlando Cigar and Tobacco Shop",
        "description": "5326 Central Florida Pkwy, Orlando, FL"
      },
      {
        "id": "stop37",
        "latitude": 28.4106008,
        "longitude": -81.455593,
        "name": "Dr Joker Smoke Shop",
        "description": "10725 International Dr, Orlando, FL"
      },
      {
        "id": "stop38",
        "latitude": 28.4045286,
        "longitude": -81.4570374,
        "name": "Hywaze - Near Seaworld",
        "description": "11062 International Dr Ste 108, Orlando, FL"
      },
      {
        "id": "stop39",
        "latitude": 28.3904046,
        "longitude": -81.4679778,
        "name": "Elite Vape & Smoke Shop - International Drive South",
        "description": "11951 International Dr #C6, Orlando, FL"
      },
      {
        "id": "stop40",
        "latitude": 28.3869706,
        "longitude": -81.488068,
        "name": "Smokers Dream",
        "description": "8139 Vineland Ave, Orlando, FL"
      },
      {
        "id": "stop41",
        "latitude": 28.38805,
        "longitude": -81.4919762,
        "name": "Electronic Cigarette",
        "description": "8200 Vineland Ave, Orlando, FL"
      }
    ]
  };

  console.log(exampleData);


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
        // Optionally add additional buttons for more routes:
        loadSFCircuitButton: document.getElementById('loadSFCircuitButton'),
        loadPacificCoastButton: document.getElementById('loadPacificCoastButton'),
        loadRoute66Button: document.getElementById('loadRoute66Button'),
        loadMassiveClusterButton: document.getElementById('loadMassiveClusterButton'),
        loadOrlandoSmokeShopsButton: document.getElementById('loadOrlandoSmokeShopsButton'),
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
        console.log('UPDATING ROUTE STATS WITH:', response);
        state.elements.routeStatsCard.classList.remove('hidden');

        if (!response || !response.summary) {
          console.error('Missing summary data in response:', response);
          state.elements.totalDistance.textContent = 'Error';
          state.elements.totalDuration.textContent = 'Error';
          state.elements.locationsVisited.textContent = 'Error';
          return;
        }

        console.log('SUMMARY DATA:', response.summary);

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
        if (state.elements.totalDistance) state.elements.totalDistance.textContent = 'Error';
        if (state.elements.totalDuration) state.elements.totalDuration.textContent = 'Error';
        if (state.elements.locationsVisited) state.elements.locationsVisited.textContent = 'Error';
      }
    }
  };

  // API utilities
  const api = {
    optimizeRoute: async () => {
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

      const requestBody = {
        locations: locations,
        options: {}
      };

      const averageSpeed = state.elements.averageSpeed.value.trim();
      if (averageSpeed) {
        const speedValue = parseFloat(averageSpeed);
        console.log(`Average speed: value=${averageSpeed}, parsed=${speedValue}, type=${typeof speedValue}`);
        if (!isNaN(speedValue)) {
          requestBody.options.average_speed_kmh = speedValue;
        }
      }

      // For Route 66 and other long routes, ensure we have a large enough outlier threshold
      const outlierThreshold = state.elements.outlierThreshold.value.trim();
      if (outlierThreshold !== '') {
        const thresholdValue = parseFloat(outlierThreshold);
        console.log(`Outlier threshold: value=${outlierThreshold}, parsed=${thresholdValue}, type=${typeof thresholdValue}`);
        if (!isNaN(thresholdValue)) {
          requestBody.options.outlier_threshold_km = thresholdValue;
        }
      } else {
        // Always provide a large default for Route 66 compatibility
        requestBody.options.outlier_threshold_km = 2000;
        console.log("Setting default large outlier threshold for compatibility with large routes");
      }

      const solverTimeLimit = state.elements.solverTimeLimit.value.trim();
      console.log(`Form solver time limit value: "${solverTimeLimit}"`);
      if (solverTimeLimit !== '') {
        const timeLimitValue = parseInt(solverTimeLimit, 10);
        if (!isNaN(timeLimitValue) && timeLimitValue > 0) {
          requestBody.options.solver_time_limit_seconds = timeLimitValue;
          console.log(`USING INPUT TIME LIMIT: options.solver_time_limit_seconds=${timeLimitValue} in request`);
        } else {
          console.warn(`Invalid time limit value: ${solverTimeLimit}, not using it`);
        }
      } else {
        console.log("No solver time limit provided in form");
      }

      const localSearchStrategy = state.elements.localSearchStrategy.value;
      if (localSearchStrategy) {
        console.log(`Local search strategy: ${localSearchStrategy}`);
        requestBody.options.local_search_strategy = localSearchStrategy;
      }

      const firstSolutionStrategy = state.elements.firstSolutionStrategy.value;
      if (firstSolutionStrategy) {
        console.log(`First solution strategy: ${firstSolutionStrategy}`);
        requestBody.options.first_solution_strategy = firstSolutionStrategy;
      }

      logger.info('Optimizing route with parameters', {
        solver_time_limit_seconds: requestBody.options.solver_time_limit_seconds,
        average_speed_kmh: requestBody.options.average_speed_kmh,
        outlier_threshold_km: requestBody.options.outlier_threshold_km,
        local_search_strategy: requestBody.options.local_search_strategy,
        first_solution_strategy: requestBody.options.first_solution_strategy
      });

      try {
        const headers = new Headers({
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'api-key': apiKey
        });

        // ALWAYS force the outlier threshold to be sufficiently large for all routes
        requestBody.options.outlier_threshold_km = 3000;
        console.log('!!! FORCING outlier_threshold_km to 3000 for Route 66 compatibility !!!');
        
        // Log the final request
        const jsonBody = JSON.stringify(requestBody);
        console.log('EXACT REQUEST BEING SENT (JSON string):', jsonBody);
        console.log('EXACT REQUEST BEING SENT (parsed back):', JSON.parse(jsonBody));
        console.log('OUTLIER THRESHOLD INCLUDED:', requestBody.options.outlier_threshold_km);

        logger.info(`Sending request to ${config.apiEndpoint}`, {
          solver_time_limit_seconds: requestBody.options.solver_time_limit_seconds,
          average_speed_kmh: requestBody.options.average_speed_kmh,
          outlier_threshold_km: requestBody.options.outlier_threshold_km,
          local_search_strategy: requestBody.options.local_search_strategy,
          first_solution_strategy: requestBody.options.first_solution_strategy
        });

        const response = await fetch(config.apiEndpoint, {
          method: 'POST',
          headers: headers,
          body: jsonBody
        });

        logger.info(`Received response with status: ${response.status}`);

        const requestId = response.headers.get('X-Request-ID');
        if (requestId) {
          logger.info(`Request ID: ${requestId}`);
        }

        if (!response.ok) {
          let errorMessage = `API error: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorData.message || errorMessage;
          } catch (parseError) {
            logger.error('Failed to parse error response', parseError);
            const errorText = await response.text();
            if (errorText) {
              errorMessage += ` - ${errorText}`;
            }
          }
          throw new Error(errorMessage);
        }

        const responseData = await response.json();
        logger.info('API request successful', responseData);
        return responseData;

      } catch (fetchError) {
        logger.error('API request failed', fetchError);
        if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
          throw new Error('Network error: Please check your internet connection and ensure the API server is running.');
        }
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

      // Example data buttons - updated to use our new keys
      if (state.elements.loadNYCButton) {
        state.elements.loadNYCButton.addEventListener('click', () => ui.loadExampleData('nycClassicTour'));
      }

      if (state.elements.loadExampleButton) {
        state.elements.loadExampleButton.addEventListener('click', () => ui.loadExampleData('jacksonvilleCityHighlights'));
      }

      // Optionally, if your HTML has buttons for additional routes, bind them here:
      if (state.elements.loadSFCircuitButton) {
        state.elements.loadSFCircuitButton.addEventListener('click', () => ui.loadExampleData('sanFranciscoBayCircuit'));
      }
      if (state.elements.loadPacificCoastButton) {
        state.elements.loadPacificCoastButton.addEventListener('click', () => ui.loadExampleData('pacificCoastExpedition'));
      }
      if (state.elements.loadRoute66Button) {
        state.elements.loadRoute66Button.addEventListener('click', () => {
          ui.loadExampleData('historicRoute66Adventure');
          // Ensure the threshold is set high enough for this route
          if (state.elements.outlierThreshold) {
            state.elements.outlierThreshold.value = "3000";
          }
        });
      }
      if (state.elements.loadMassiveClusterButton) {
        state.elements.loadMassiveClusterButton.addEventListener('click', () => {
          ui.loadExampleData('massiveClusterRoute');
          // Ensure the threshold is set high enough for this route
          if (state.elements.outlierThreshold) {
            state.elements.outlierThreshold.value = "3000";
          }
        });
      }
      if (state.elements.loadOrlandoSmokeShopsButton) {
        state.elements.loadOrlandoSmokeShopsButton.addEventListener('click', () => {
          ui.loadExampleData('orlandoSmokeShops');
          // Ensure the threshold is set high enough for this route
          if (state.elements.outlierThreshold) {
            state.elements.outlierThreshold.value = "100";
          }
        });
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
      if (state.optimization.inProgress) return;
      state.optimization.inProgress = true;

      mapUtils.clearLayers();
      ui.setLoading(true);
      ui.setStatus('Optimizing route...', 'info');

      if (state.elements.apiResponse) {
        state.elements.apiResponse.textContent = 'Processing request...';
      }

      try {
        const response = await api.optimizeRoute();

        if (state.elements.apiResponse) {
          state.elements.apiResponse.textContent = JSON.stringify(response, null, 2);
        }

        ui.updateRouteStats(response);

        try {
          console.log('FULL API RESPONSE:', response);
          const inputLocations = JSON.parse(state.elements.locationsInput.value);
          console.log('INPUT LOCATIONS:', inputLocations);

          if (state.map) {
            state.map.invalidateSize();
            console.log('Map invalidated before route display');
          }

          if (!response) {
            console.error('Response is empty or null');
            ui.setStatus('Error: Empty response from API', 'error');
            return;
          }

          if (!response.route || !Array.isArray(response.route)) {
            console.error('Response missing route array or not an array:', response.route);
            ui.setStatus('Error: Invalid response format from API', 'error');
            return;
          }

          console.log('ROUTE POINTS FROM API:', response.route);

          if (response.route.length === 0) {
            console.warn('Route array is empty');
            ui.setStatus('Route is empty - nothing to display', 'warning');
            return;
          }

          const samplePoint = response.route[0];
          console.log('SAMPLE ROUTE POINT:', samplePoint);

          if (!samplePoint || typeof samplePoint !== 'object') {
            console.error('Route points are not objects:', samplePoint);
            ui.setStatus('Error: Invalid route point format', 'error');
            return;
          }

          const hasOriginalIndex = samplePoint.hasOwnProperty('original_index');
          const hasVisitOrder = samplePoint.hasOwnProperty('visit_order');

          console.log(`Point properties: original_index=${hasOriginalIndex}, visit_order=${hasVisitOrder}`);

          if (!hasOriginalIndex) {
            console.error('Route points missing original_index property:', samplePoint);
            ui.setStatus('Error: Route points missing original_index', 'error');
            return;
          }

          let sortedPoints;
          if (hasVisitOrder) {
            sortedPoints = [...response.route].sort((a, b) => {
              const aOrder = a.visit_order !== undefined ? a.visit_order : 0;
              const bOrder = b.visit_order !== undefined ? b.visit_order : 0;
              return aOrder - bOrder;
            });
          } else {
            sortedPoints = [...response.route];
          }

          console.log('SORTED ROUTE POINTS:', sortedPoints);
          const sequence = sortedPoints.map(point => {
            const idx = point.original_index;
            return idx !== undefined && idx !== null ? idx : 0;
          });

          console.log('SEQUENCE TO DISPLAY:', sequence);
          const validSequence = sequence.filter(idx => idx >= 0 && idx < inputLocations.length);

          if (validSequence.length !== sequence.length) {
            console.warn(`Filtered ${sequence.length - validSequence.length} invalid indices`);
          }

          if (validSequence.length === 0) {
            console.error('No valid sequence points to display');
            ui.setStatus('Error: No valid route points', 'error');
            return;
          }

          const validatedLocations = inputLocations.map((loc, i) => {
            if (!loc || typeof loc !== 'object') {
              console.warn(`Location at index ${i} is not an object:`, loc);
              return null;
            }

            const lat = parseFloat(loc.latitude);
            const lng = parseFloat(loc.longitude);

            if (isNaN(lat) || isNaN(lng)) {
              console.warn(`Location at index ${i} has invalid coordinates:`, loc);
              return null;
            }

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

          try {
            mapUtils.displayRoute(validatedLocations, validSequence);
            logger.info('Route displayed on map', {
              pointCount: response.route.length,
              sequenceLength: validSequence.length
            });

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

        ui.setStatus('Route optimized successfully!', 'success');
        logger.info('Route optimization completed successfully');
      } catch (error) {
        logger.error('Route optimization failed', error);
        if (state.elements.apiResponse) {
          state.elements.apiResponse.textContent = JSON.stringify({
            status: "error",
            message: error.message
          }, null, 2);
        }
        ui.setStatus(error.message, 'error');
      } finally {
        ui.setLoading(false);
        state.optimization.inProgress = false;
      }
    }
  };

  // Initialization
  const init = () => {
    logger.info('Initializing Route Optimizer application');
    state.elements = dom.getElements();

    if (!mapUtils.init()) {
      return false;
    }

    const savedApiKey = api.loadApiKey();
    if (savedApiKey && state.elements.apiKeyInput) {
      state.elements.apiKeyInput.value = savedApiKey;
    }

    // Set default example data to NYC Classic Tour
    ui.loadExampleData('nycClassicTour');

    events.bindEvents();

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