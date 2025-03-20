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
  const instrumentFamilyColors = new Map();
  let colorIndex = 0;

  // Color palette for different instrument family
  const colors = [
    "#ea5d28", "#2b5ba7", "#9ad0d0",
    "#c60204", "#fdca01", "#d84162",
    "#5eb300", "#692673", "#d6d96d"
  ];

  // Group data by person and collect their locations
  csvData.forEach(d => {
    if (!d.full_name || !d.latitude || !d.longitude) {
      console.log("Skipping incomplete data:", d);
      return;
    }

    if (!instrumentFamilyColors.has(d.instrument_family_english)) {
      if (d.instrument_family_english === "") {
        instrumentFamilyColors.set(d.instrument_family_english, "#DDDDDD"); // assign pale grey for nan
      } else {
        instrumentFamilyColors.set(d.instrument_family_english, colors[colorIndex % colors.length]);
        colorIndex++;
      }
    }

    const personKey = d.full_name;
    if (!peopleMap.has(personKey)) {
      peopleMap.set(personKey, {
        name: d.full_name,
        instrument_family: d.instrument_family_english,
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
  namesContainer.selectAll(".person-name")
  .data(Array.from(peopleMap.values()))
  .enter()
  .append("div")
  .attr("class", d => `person-name person-${nameToSafeNameMap.get(d.name)}`)
  .attr("data-person", d => nameToSafeNameMap.get(d.name))
  .html(d => `<span style="color:#ffffff">${d.name}</span>`);

  // Create a map to store location coordinates by person
  const personToLocations = new Map();

  // Cache city bubbles for better performance
  const cityBubbleCache = [];

  // Find and cache all city bubbles and their original states
  d3.selectAll(".city-bubble").each(function(d) {
    if (!d) return;

    const element = d3.select(this);
    cityBubbleCache.push({
      element: element,
      node: this,
      data: d,
      originalFill: element.style("fill") || element.attr("fill") || "#555",
      originalOpacity: element.style("opacity") || element.attr("opacity") || "1"
    });
  });

  console.log(`Cached ${cityBubbleCache.length} city bubbles`);

  // Store a reference to all bubbles by coordinates for quick lookup
  const bubblesByCoords = new Map();
  cityBubbleCache.forEach(bubble => {
    if (!bubble.data) return;

    const key = `${bubble.data.longitude}-${bubble.data.latitude}`;
    if (!bubblesByCoords.has(key)) {
      bubblesByCoords.set(key, []);
    }
    bubblesByCoords.get(key).push(bubble);
  });

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

      // Keep track of this person's locations
      if (!personToLocations.has(name)) {
        personToLocations.set(name, []);
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

        // Store this location for this person for filtering later
        personToLocations.get(name).push({
          latitude: location.latitude,
          longitude: location.longitude
        });

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
          .attr("stroke", instrumentFamilyColors.get(person.instrument_family))
          .attr("opacity", "0.15")
          .attr("stroke-width", "0.5px");
      });
    });

    // Now add the event listeners
    document.querySelectorAll('.person-name').forEach(el => {
      const personClass = el.getAttribute('data-person');
      const personName = el.textContent.trim();
      const personData = peopleMap.get(personName);

      if (!personData) {
        console.warn(`Could not find data for person: ${personName}`);
        return;
      }

      const personColor = instrumentFamilyColors.get(personData.instrument_family);

      console.log(`Adding listeners for ${personClass}`);

      // Mouseover event - filter to show only this person's bubbles
      el.addEventListener('mouseover', function() {
        console.log(`Mouseover on ${personClass}`);

        // Scale up the name
        this.style.transform = 'scale(1.1)';

        // Highlight connections
        const connections = document.querySelectorAll(`.connection-${personClass}`);
        console.log(`Found ${connections.length} connections to highlight for ${personClass}`);

        connections.forEach(path => {
          path.style.opacity = '0.9';
          path.style.strokeWidth = '2px';
        });

        // Get this person's locations
        const personLocations = personToLocations.get(personName) || [];

        // First hide all bubbles
        cityBubbleCache.forEach(bubble => {
          bubble.element.style("opacity", "0.1");
        });

        // Then only highlight this person's bubbles
        personLocations.forEach(location => {
          const locationKey = `${location.longitude}-${location.latitude}`;
          const matchingBubbles = bubblesByCoords.get(locationKey);

          if (matchingBubbles && matchingBubbles.length > 0) {
            matchingBubbles.forEach(bubble => {
              // Set color and make fully visible
              bubble.element.style("fill", personColor);
              bubble.element.style("stroke", personColor);
              bubble.element.style("opacity", "1");
            });
          }
        });

        // Update calendar to show per person events
        const calendarData = csvData.filter(row => row["full_name"] === personName);
        createCalendarHeatmap(calendarData, personColor);
        updateSummary(csvData, personName, personColor);
      });

      // Mouseout event - restore all bubbles
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

        // Reset all city bubbles to original state
        cityBubbleCache.forEach(bubble => {
          bubble.element.style("fill", bubble.originalFill);
          bubble.element.style("stroke", bubble.originalFill);
          bubble.element.style("opacity", bubble.originalOpacity);
        });

        // Reset calendar and summary to the original state
        createCalendarHeatmap(csvData);
        updateSummary(csvData);
      });
    });
  }, 500);
}