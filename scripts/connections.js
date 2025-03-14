// Function to create name - bubble connections in a form of brezier curves
function createNameConnections(csvData, projection) {
  d3.select("#connections-container").remove();
  d3.select("#connections-svg").remove();
  console.log("Starting createNameConnections with data:", csvData.length);

  if (!csvData || csvData.length === 0) {
    console.warn("No data available for name connections");
    return;
  }

  // Get the current dimensions
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Define the map margins
  const margin = {
    top: 125,
    right: 0,
    bottom: 0,
    left: -50
  };

  let connectionsContainer = d3.select(".container")
    .append("div")
    .attr("id", "connections-container");

  // Create a names container
  const namesContainer = connectionsContainer
    .append("div")
    .attr("class", "names-container");

  // Process the data to group by full_name
  const peopleMap = new Map();
  const instrumentColors = new Map();
  let colorIndex = 0;

  // Color palette for different instruments
  const colors = [
    "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
    "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22",
    "#17becf", "#aec7e8", "#ffbb78", "#98df8a"
  ];

  // Group data by person and collect their locations
  csvData.forEach(d => {
    if (!d.full_name || !d.latitude || !d.longitude) {
      console.log("Skipping incomplete data:", d);
      return;
    }

    // Assign color to instrument if not already assigned
    if (!instrumentColors.has(d.instrument)) {
      instrumentColors.set(d.instrument, colors[colorIndex % colors.length]);
      colorIndex++;
    }

    const personKey = d.full_name;
    if (!peopleMap.has(personKey)) {
      peopleMap.set(personKey, {
        name: d.full_name,
        instrument: d.instrument,
        locations: []
      });
    }

    // Add this location to the person's data
    peopleMap.get(personKey).locations.push({
      city: d.city,
      country: d.country,
      latitude: parseFloat(d.latitude),
      longitude: parseFloat(d.longitude)
    });
  });

  console.log("Processed data:", peopleMap.size, "people with locations");

  // Create a dedicated SVG just for the connections
  const connectionsSvg = connectionsContainer
    .append("svg")
    .attr("id", "connections-svg")
    .attr("width", width)
    .attr("height", height);

  // Create the lines layer
  const linesLayer = connectionsSvg
    .append("g")
    .attr("class", "connections-layer");

  // Create a mapping between person names and safe names for consistency
  const nameToSafeNameMap = new Map();

  peopleMap.forEach((person, name) => {
    const safeName = name.replace(/\s+/g, '-').toLowerCase().replace(/[^\w-]/g, '');
    nameToSafeNameMap.set(name, safeName);
  });

  // Add names and prepare for connecting to locations
  const nameElements = namesContainer.selectAll(".person-name")
    .data(Array.from(peopleMap.values()))
    .enter()
    .append("div")
    .attr("class", d => `person-name person-${nameToSafeNameMap.get(d.name)}`)
    .attr("data-person", d => nameToSafeNameMap.get(d.name))  // Add data attribute for direct access
    .html(d => `<span style="color:#ffffff">${d.name}</span>`);

  // Wait for the DOM to be updated
  setTimeout(() => {
    // Draw connections after names are rendered
    peopleMap.forEach((person, name) => {
      const safeName = nameToSafeNameMap.get(name);
      const nameElement = document.querySelector(`.person-${safeName}`);

      if (!nameElement) {
        console.warn(`Could not find element for ${name} (class: .person-${safeName})`);
        return;
      }

      console.log(`Processing person: ${name}, safeName: ${safeName}`);

      // Get positions
      const nameRect = nameElement.getBoundingClientRect();
      const containerRect = connectionsContainer.node().getBoundingClientRect();

      const sourceX = nameRect.left + nameRect.width/2 - containerRect.left;
      const sourceY = nameRect.bottom - containerRect.top;

      // Create a line for each location
      person.locations.forEach(location => {
        const targetCoords = projection([location.longitude, location.latitude]);
        if (!targetCoords) {
          console.warn(`Could not project coordinates for ${location.city}`);
          return;
        }

        // Apply map margins to the target coordinates
        const targetX = targetCoords[0] + margin.left;
        const targetY = targetCoords[1] + margin.top;

        // Calculate control points for the bezier curve
        const controlX1 = sourceX;
        const controlY1 = sourceY + 50;
        const controlX2 = targetX;
        const controlY2 = targetY - 50;

        // Draw the bezier curve
        linesLayer.append("path")
          .attr("class", `connection connection-${safeName}`)
          .attr("d", `M${sourceX},${sourceY} C${controlX1},${controlY1} ${controlX2},${controlY2} ${targetX},${targetY}`)
          .attr("fill", "none")
          .attr("stroke", instrumentColors.get(person.instrument))
      });
    });

    // Now add the event listeners
    document.querySelectorAll('.person-name').forEach(el => {
      // Use the data attribute directly - KEY FIX
      const personClass = el.getAttribute('data-person');

      console.log(`Adding listeners for ${personClass}`);

      // Check if this person has any connections
      const personConnections = document.querySelectorAll(`.connection-${personClass}`).length;
      console.log(`${personClass} has ${personConnections} connections`);

      // Mouseover event
      el.addEventListener('mouseover', function() {
        console.log(`Mouseover on ${personClass}`);

        // Scale up the name
        this.style.transform = 'scale(1.1)';

        // Try to highlight connections
        const connections = document.querySelectorAll(`.connection-${personClass}`);
        console.log(`Found ${connections.length} connections to highlight for ${personClass}`);

        connections.forEach(path => {
          path.style.opacity = '0.9';
          path.style.strokeWidth = '2px';
        });
      });

      // Mouseout event
      el.addEventListener('mouseout', function() {
        console.log(`Mouseout on ${personClass}`);

        // Scale back the name
        this.style.transform = 'scale(1)';

        // Reset connections
        const connections = document.querySelectorAll(`.connection-${personClass}`);
        connections.forEach(path => {
          path.style.opacity = '0.15';
          path.style.strokeWidth = '0.5px';
        });
      });
    });
  }, 500);
}