function drawMap(width, height, csvData) {
  // Define margins
  const margin = {
    top: 125,
    right: 0,
    bottom: 0,
    left: -50
  };

  // Get SVG element
  const svg = d3.select("#mapSvg");

  // Make sure any previous content is cleared
  svg.selectAll("g.zoom-controls").remove();

  // Create a group for the map with margins applied
  const mapGroup = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`)
    .attr("id", "map-content"); // Add ID for zoom handling

  // Set initial zoom state tracker
  let isZoomed = false;
  // Flag to track if we're in the original position or a reset state
  let isInOriginalPosition = true;

  // Create zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([1, 8]) // Set minimum and maximum zoom levels
    .on("zoom", handleZoom);

  // Zoom event handler function (defined separately for clarity)
  function handleZoom(event) {
    // Update map transform
    mapGroup.attr("transform", `translate(${event.transform.x}, ${event.transform.y}) scale(${event.transform.k})`);

    // Check if we've moved from original position
    if (isInOriginalPosition &&
        (event.transform.x !== margin.left ||
         event.transform.y !== margin.top ||
         event.transform.k !== 1)) {
      isInOriginalPosition = false;
    }

    // Toggle connections visibility based on zoom level
    if (event.transform.k > 1.2 && !isZoomed) {
      // Hide connections when zoomed in
      d3.select("#connections-container").style("opacity", 0);
      d3.select("#connections-svg").style("opacity", 0);
      isZoomed = true;
    } else if (event.transform.k <= 1.2 && isZoomed) {
      // Only show connections if we're in reset state (after double click)
      // Don't show just because we're zoomed out
      if (isInOriginalPosition) {
        d3.select("#connections-container").style("opacity", 1);
        d3.select("#connections-svg").style("opacity", 1);
      }
      isZoomed = false;
    }
  }

  // Precise reset function to ensure repeatability
  function resetZoomExact() {
    svg.transition()
      .duration(750)
      .call(zoom.transform, d3.zoomIdentity
        .translate(margin.left, margin.top)
        .scale(1))
      .on("end", function() {
        // Ensure proper state after animation finishes
        isZoomed = false;
        isInOriginalPosition = true;

        // Explicitly force connections to be visible when reset to original position
        d3.select("#connections-container").style("opacity", 1);
        d3.select("#connections-svg").style("opacity", 1);
      });
  }

  // Add zoom behavior to SVG element - with proper initialization
  svg.call(zoom)
     .on("dblclick.zoom", resetZoomExact);

  // Initialize zoom transform to match initial margins
  // This is critical to prevent the first zoom from being relative to 0,0
  svg.call(zoom.transform, d3.zoomIdentity
    .translate(margin.left, margin.top)
    .scale(1));

  // Load world map data first
  d3.json("data/world.json")
    .then(function(world) {
      console.log("World data loaded successfully:", world);

      // Generate dot pattern points
      const points = generateDotPattern(width, height, world);

      // Draw the dots
      mapGroup.selectAll(".map-dot")
        .data(points)
        .join("circle")
        .attr("class", "map-dot")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.avg / 255 * 2) // Adjust the size based on the average value
        .attr("fill", "#636363");

      // Set up the projection for the bubbles
      const projection = d3.geoNaturalEarth1()
        .fitSize([innerWidth, innerHeight], {type: "Sphere"});

      if (!csvData || csvData.length === 0) {
        console.warn("CSV data is empty:", csvData);
        return;
      }

      console.log("CSV data loaded successfully:", csvData);

      // Process CSV data
      try {
        // Check if CSV has the expected columns
        const firstRow = csvData[0];
        if (!firstRow.hasOwnProperty('latitude') || !firstRow.hasOwnProperty('longitude') ||
            !firstRow.hasOwnProperty('city') || !firstRow.hasOwnProperty('country')) {
          console.error("CSV missing required columns. Expected: latitude, longitude, city, country");
          console.log("Available columns:", Object.keys(firstRow));

          // List all available columns
          const availableColumns = Object.keys(firstRow).join(", ");
          svg.append("text")
            .attr("x", width / 2)
            .attr("y", 80)
            .attr("text-anchor", "middle")
            .text(`Available columns: ${availableColumns}`);

          return;
        }

        const cityData = processCSVData(csvData);

        if (cityData.length === 0) {
          console.log("No valid city data found in CSV.");
          return;
        }

        // Define bubble size scale
        const bubbleScale = d3.scaleSqrt()
          .domain([1, d3.max(cityData, d => d.count) || 10])
          .range([2, 6]); // Min and max radius

        // Add city bubbles
        const cities = mapGroup.selectAll(".city-bubble")
          .data(cityData)
          .enter()
          .append("g")
          .attr("class", "city-group");

        // Draw city bubbles
        cities.append("circle")
          .attr("class", "city-bubble")
          .attr("cx", d => {
            const coords = projection([d.longitude, d.latitude]);
            console.log(`City: ${d.city}, Longitude: ${d.longitude}, Latitude: ${d.latitude}, Projected coords:`, coords);
            return coords ? coords[0] : 0;
          })
          .attr("cy", d => {
            const coords = projection([d.longitude, d.latitude]);
            return coords ? coords[1] : 0;
          })
          .attr("r", d => bubbleScale(d.count));

        createNameConnections(csvData, projection);

        // Add zoom controls with reference to external CSS
        addZoomControls(svg, zoom, width, height, resetZoomExact, margin);

        // Ensure connections are initially visible
        d3.select("#connections-container").style("opacity", 1);
        d3.select("#connections-svg").style("opacity", 1);

      } catch (err) {
        console.error("Error processing CSV data:", err);
      }

    })
    .catch(function(error) {
      console.error("Error loading world data:", error);
    });
}

// Function to add zoom controls - simplified with CSS
function addZoomControls(svg, zoom, width, height, resetZoomExact, margin) {
  // Position controls in the bottom left corner
  const controlsGroup = svg.append("g")
    .attr("class", "zoom-controls")
    .attr("transform", `translate(20, 200)`); // Position near bottom

  // Zoom in button
  const zoomIn = controlsGroup.append("g")
    .attr("class", "zoom-button zoom-in")
    .style("cursor", "pointer")
    .on("click", function() {
      svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 1.5);
    });

  zoomIn.append("rect")
    .attr("width", 30)
    .attr("height", 30)
    .attr("rx", 5);

  zoomIn.append("text")
    .attr("x", 15)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("+");

  // Zoom out button
  const zoomOut = controlsGroup.append("g")
    .attr("class", "zoom-button zoom-out")
    .attr("transform", "translate(0, 35)")
    .style("cursor", "pointer")
    .on("click", function() {
      svg.transition()
        .duration(300)
        .call(zoom.scaleBy, 0.75);
    });

  zoomOut.append("rect")
    .attr("width", 30)
    .attr("height", 30)
    .attr("rx", 5);

  zoomOut.append("text")
    .attr("x", 15)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("−");

  // Reset zoom button
  const resetZoom = controlsGroup.append("g")
    .attr("class", "zoom-button reset-zoom")
    .attr("transform", "translate(0, 70)")
    .style("cursor", "pointer")
    .on("click", resetZoomExact);

  resetZoom.append("rect")
    .attr("width", 30)
    .attr("height", 30)
    .attr("rx", 5);

  resetZoom.append("text")
    .attr("x", 15)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("⟲");
}

// Parse CSV data and convert to proper format
function processCSVData(csvData) {
  console.log("First row of CSV data:", csvData[0]);

  // Create a deep copy of the data to avoid modifying the original
  const processedData = JSON.parse(JSON.stringify(csvData));

  // Clean the latitude and longitude values
  processedData.forEach(d => {
    try {
      // Handle missing values
      if (!d.latitude || !d.longitude || !d.city || !d.country) {
        console.log("Row missing required data:", d);
        d.valid = false;
        return;
      }

      d.valid = true;
      // Extract numeric values from latitude and longitude strings
      if (typeof d.latitude === 'string') {
        if (d.latitude.includes('°')) {
          // Handle DMS format
          let lat = d.latitude.replace(/°\s*[NS]/, '');
          d.latitude = parseFloat(lat);

          // Adjust for hemisphere
          if (d.latitude.includes('S')) d.latitude = -d.latitude;
        } else {
          // Handle standard format
          d.latitude = parseFloat(d.latitude);
        }
      }

      if (typeof d.longitude === 'string') {
        if (d.longitude.includes('°')) {
          // Handle DMS format
          let lon = d.longitude.replace(/°\s*[EW]/, '');
          d.longitude = parseFloat(lon);

          // Adjust for hemisphere
          if (d.longitude.includes('W')) d.longitude = -d.longitude;
        } else {
          // Handle standard format
          d.longitude = parseFloat(d.longitude);
        }
      }

      // Validate the coordinates are within reasonable bounds
      if (d.latitude < -90 || d.latitude > 90 || d.longitude < -180 || d.longitude > 180) {
        console.warn("Coordinates out of range:", d);
        d.valid = false;
      }
    } catch (err) {
      console.error("Error processing coordinates for row:", d, err);
      d.valid = false;
    }
  });

  // Filter out any rows with invalid coordinates
  const validData = processedData.filter(d => {
    const valid = d.valid && !isNaN(d.latitude) && !isNaN(d.longitude);
    if (!valid) console.log("Filtering out invalid row:", d);
    return valid;
  });

  console.log(`Filtered data: ${validData.length} valid entries out of ${processedData.length}`);

  if (validData.length === 0) {
    console.warn("No valid data entries found after filtering");
    return [];
  }

  // Group data by city to count frequencies
  const cityMap = new Map();

  validData.forEach(d => {
    const key = `${d.city}, ${d.country}`;
    if (!cityMap.has(key)) {
      cityMap.set(key, {
        city: d.city,
        country: d.country,
        latitude: d.latitude,
        longitude: d.longitude,
        count: 1
      });
    } else {
      cityMap.get(key).count += 1;
    }
  });

  const cityData = Array.from(cityMap.values());
  console.log("Final city data:", cityData);

  return cityData;
}

function generateDotPattern(width, height, world) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.canvas.width = width;
  ctx.canvas.height = height;

  // Set up the projections
  const projection = d3.geoNaturalEarth1().fitSize([width, height], { type: "Sphere" });
  const path = d3.geoPath(projection, ctx);

  // Create a land shape | Filter out Antarctica
  const land = topojson.merge(world, world.objects.countries.geometries.filter(d => d.id !== "010"));

  // Make the fill canvas black
  ctx.fillRect(0, 0, width, height);

  // Initialize the context's path with the desired boundary
  ctx.beginPath();
  path(land);
  // Also fill it white
  ctx.fillStyle = "white";
  ctx.fill();

  // Iterate over the grid and test whether points are inside
  const size = 6; // Adjust the size of the grid
  let points = [];
  for (let y = size / 2; y <= height + size / 2; y += size) {
    for (let x = size / 2; x <= width + size / 2; x += size) {
      if (ctx.isPointInPath(x, y)) {
        // Get the average pixel value of the rectangle around the x, and y point
        let data = ctx.getImageData(x - size / 2, y - size / 2, size, size).data;
        // Since it is all black or white, I only need either the r, g, or b (not the a (alpha)) value of each pixel
        data = data.filter((_, i) => (i - 1) % 4 === 0);
        // Average it all out, so get "the average amount of white of the pixel"
        const avg = d3.mean(data);

        points.push({ x: x, y: y, avg: avg });
      }
    }
  }

  return points;
}