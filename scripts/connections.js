// Function to create name-to-location connections with improved debugging
function createNameConnections(csvData, mapSvg) {
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

  // Clear any existing connections first
  d3.select("#connections-container").remove();
  d3.select("#connections-svg").remove();

  // Create or select dedicated container for connections
  let connectionsContainer = d3.select(".container")
    .append("div")
    .attr("id", "connections-container")
    .style("position", "absolute")
    .style("top", "0")
    .style("left", "0")
    .style("width", "100%")
    .style("height", "100%")
    .style("pointer-events", "none")
    .style("z-index", "10");

  console.log("Created new connections container");

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

  // Set up the projection to match the map
  const projection = d3.geoNaturalEarth1()
    .fitSize([width, height], {type: "Sphere"});

  // Create a dedicated SVG just for the connections
  const connectionsSvg = connectionsContainer
    .append("svg")
    .attr("id", "connections-svg")
    .attr("width", width)
    .attr("height", height)
    .style("position", "absolute")
    .style("top", "0")
    .style("left", "0")
    .style("z-index", "15");

  // Create the lines layer
  const linesLayer = connectionsSvg
    .append("g")
    .attr("class", "connections-layer");


  // Add names and prepare for connecting to locations
  const nameElements = namesContainer.selectAll(".person-name")
    .data(Array.from(peopleMap.values()))
    .enter()
    .append("div")
    .attr("class", d => `person-name person-${d.name.replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`)
    .html(d => `<span style="color:#ffffff">${d.name}</span>`);


  // Use a longer timeout to ensure DOM is fully rendered
  setTimeout(() => {
    console.log("Drawing connections after timeout");

    // Draw connections after names are rendered
    peopleMap.forEach((person, name) => {
      const safeName = person.name.replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const nameElement = document.querySelector(`.person-${safeName}`);

      if (!nameElement) {
        console.warn(`Could not find element for ${person.name} (class: .person-${safeName})`);
        return;
      }

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
        const targetY = targetCoords[1] + margin.top; // Adjust for vertical spacing and top margin

        console.log(`Location ${location.city} at position:`, targetX, targetY);

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
          .attr("stroke-width", "0.5px")
          .attr("opacity", "0.1");
      });
    });

    // After all connections are drawn, add the event listeners
    document.querySelectorAll('.person-name').forEach(el => {
      const className = el.className;
      const personClass = className.split(' ')
        .find(cls => cls.startsWith('person-'))
        ?.substring(7);

      if (!personClass) {
        console.warn("Could not extract person class from:", className);
        return;
      }

      // Mouseover event
      el.addEventListener('mouseover', () => {
        // Scale up the name
        el.style.transform = 'scale(1.1)';

        // Find and highlight only this person's connections
        document.querySelectorAll(`.connection-${personClass}`).forEach(path => {
            path.setAttribute("opacity", "1");
            path.setAttribute("stroke-width", "2.5px");
        });
      });

      // Mouseout event
      el.addEventListener('mouseout', () => {
        // Scale back the name
        el.style.transform = 'scale(1)';

        // Reset this person's connections
        document.querySelectorAll(`.connection-${personClass}`).forEach(path => {
          path.style.opacity = '0.1';
          path.style.strokeWidth = '0.5px';
        });
      });
    });
  }, 100); // Longer timeout for more reliable rendering
}