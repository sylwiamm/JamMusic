function drawMap(width, height) {
  // Define margins
  const margin = {
    top: 125,
    right: 0,
    bottom: 0,
    left: -50
  };

  // Get SVG element
  const svg = d3.select("#mapSvg");

  // Create a group for the map with margins applied
  const mapGroup = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

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

      d3.csv("data/events.csv")
        .then(function(csvData) {
          if (!csvData || csvData.length === 0) {
            console.warn("CSV data is empty:", csvData);
            return;
          }

          console.log("CSV data loaded successfully:", csvData);

          createCalendarHeatmap(csvData);

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
            console.log("Processed city data:", cityData);

            if (cityData.length === 0) {
              console.log("No valid city data found in CSV.");
              return;
            }

            console.log(`Displaying ${cityData.length} cities from CSV...`);

            // Define bubble size scale
            const bubbleScale = d3.scaleSqrt()
              .domain([1, d3.max(cityData, d => d.count) || 10])
              .range([4, 15]); // Min and max radius

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

          } catch (err) {
            console.error("Error processing CSV data:", err);
          }
        })
        .catch(function(error) {
          console.error("Error loading CSV data:", error);
        });
    })
    .catch(function(error) {
      console.error("Error loading world data:", error);
    });
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
        console.warn("Row missing required data:", d);
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
    if (!valid) console.warn("Filtering out invalid row:", d);
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


// Export the functions
window.drawMap = drawMap;
window.processCSVData = processCSVData;
window.generateDotPattern = generateDotPattern;