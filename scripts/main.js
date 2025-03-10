// Add this function to your main.js file to ensure it's called after the map is drawn
function initializeVisualization() {
  // Get current dimensions
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear any existing visualization
  d3.select("#mapSvg").html("");
  d3.select("#connections-svg").remove();

  // Set dimensions
  d3.select("#mapSvg")
    .attr("width", width)
    .attr("height", height);

  // Draw the map first
  drawMap(width, height);

  // Load the data and create connections
  d3.csv("data/events.csv")
    .then(function(csvData) {
      console.log("CSV data loaded:", csvData.length, "rows");
      createNameConnections(csvData, d3.select("#mapSvg"));
    })
    .catch(function(error) {
      console.error("Error loading CSV data:", error);
    });
}

window.addEventListener('load', function() {
  initializeVisualization();
  console.log("Window loaded, visualization initialized");
});

window.addEventListener('resize', function() {
  initializeVisualization();
  console.log("Window resized, visualization reinitialized");
});