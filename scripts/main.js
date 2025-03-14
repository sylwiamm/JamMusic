// Add this function to your main.js file to ensure it's called after the map is drawn
function initializeVisualization() {
  // Get current dimensions
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Clear any existing visualization
  d3.select("#mapSvg").html("");
  // These are repeated in individual scripts too
  d3.select("#calendar svg").remove();
  d3.select("#connections-container").remove();
  d3.select("#connections-svg").remove();

  // Set map dimensions
  d3.select("#mapSvg")
    .attr("width", width)
    .attr("height", height);

  // Load the data
  d3.csv("data/events.csv")
    .then(function(csvData) {
      console.log("CSV data loaded:", csvData.length, "rows");
      drawMap(width, height, csvData);
      createCalendarHeatmap(csvData);
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