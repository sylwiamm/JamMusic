// Function to create calendar heatmap
function createCalendarHeatmap(data) {
  d3.select("#calendar svg").remove();

  // Validate and clean date entries
  const validData = data.filter(d => {
    // Check if date exists and is in valid format (YYYY-MM-DD)
    if (!d.date) return false;

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(d.date)) return false;

    // Check if the date is valid and falls within 2024
    const parsedDate = new Date(d.date);
    return !isNaN(parsedDate) && parsedDate.getFullYear() === 2024;
  });

  // Count events by date
  const dateCount = {};
  validData.forEach(d => {
    if (dateCount[d.date]) {
      dateCount[d.date]++;
    } else {
      dateCount[d.date] = 1;
    }
  });

  // Parameters
  const cellSize = 15;
  const cellMargin = 2;
  const width = 960;
  const height = 150;

  // Date formats
  const formatMonth = d3.timeFormat("%b");
  const formatDate = d3.timeFormat("%Y-%m-%d");

  // Calculate year range
  const year = 2024;
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // Calculate day of week offset
  const firstDayOfYear = new Date(year, 0, 1);
  const firstDayOffset = firstDayOfYear.getDay();

  // Color scale
  const maxCount = d3.max(Object.values(dateCount)) || 1;
  const colorScale = d3.scaleSequential()
    .domain([0, maxCount])
    .interpolator(d => `rgba(255, 255, 255, ${d/maxCount * 20 + 0.2})`);  // White with opacity

  // Create the SVG element
  const svg = d3.select("#calendar")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("position", "relative");  // Override absolute positioning

  // Add tooltip
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  // Days of week labels (vertical)
  const dayLabels = svg.selectAll(".day-label")
    .data(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
    .enter()
    .append("text")
    .attr("class", "day-label")
    .attr("x", 20)
    .attr("y", (d, i) => (i * (cellSize + cellMargin)) + cellSize / 2 + 30)
    .style("text-anchor", "end")
    .text(d => d);

  // Month labels (horizontal)
  const monthLabels = svg.selectAll(".month-label")
    .data(d3.range(0, 12))
    .enter()
    .append("text")
    .attr("class", "month-label")
    .attr("x", d => {
      // Calculate x position for month labels
      const date = new Date(year, d, 1);
      const firstDayOfMonth = date.getDay() || 7; // Convert Sunday from 0 to 7
      const weekOfYear = Math.floor((d3.timeDay.count(d3.timeYear(date), date) + (firstDayOfMonth - 1)) / 7);
      return weekOfYear * (cellSize + cellMargin) + 30;
    })
    .attr("y", 20)
    .style("text-anchor", "start")
    .text(d => formatMonth(new Date(year, d, 1)));

  // Create a group for the day cells
  const dayGroup = svg.append("g")
    .attr("transform", `translate(30, 30)`);

  // Generate an array of all days in the year
  const days = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Draw the day cells
  const dayCells = dayGroup.selectAll(".day")
    .data(days)
    .enter()
    .append("rect")
    .attr("class", d => {
      const dateStr = formatDate(d);
      return dateCount[dateStr] ? "day" : "day no-data";
    })
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => {
      // Calculate the week number
      const dayOfYear = d3.timeDay.count(d3.timeYear(d), d);
      const weekNum = Math.floor((dayOfYear + (firstDayOffset - 1)) / 7);
      return weekNum * (cellSize + cellMargin);
    })
    .attr("y", d => {
      // Get the day of week (0 = Sunday, 1 = Monday, etc.)
      let dayOfWeek = d.getDay() || 7; // Convert Sunday from 0 to 7
      return (dayOfWeek-1) * (cellSize + cellMargin);
    })
    .attr("fill", d => {
      const dateStr = formatDate(d);
      return dateCount[dateStr] ? colorScale(dateCount[dateStr]) : "#2a2a2a";
    })
    .attr("rx", 2)
    .attr("ry", 2)
    .on("mouseover", function(event, d) {
      const dateStr = formatDate(d);

      // Find events for this date
      const eventsOnDate = validData.filter(item => item.date === dateStr);

      tooltip.transition()
        .duration(200)
        .style("opacity", 0.9);

      let tooltipContent = `<strong>${d.toDateString()}</strong><br>`;

      if (eventsOnDate.length > 0) {
        tooltipContent += `Events: ${eventsOnDate.length}<br><br>`;
        eventsOnDate.forEach(event => {
          tooltipContent += `${event.full_name} (${event.instrument_english})<br>`;
          tooltipContent += `${event.city}, ${event.country}<br><br>`;
        });
      } else {
        tooltipContent += "No performances";
      }

      tooltip.html(tooltipContent)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");

      d3.select(this)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);
    })
    .on("mouseout", function() {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);

      d3.select(this)
        .attr("stroke", "#3a3a3a")
        .attr("stroke-width", d => {
          const dateStr = formatDate(d);
          return dateCount[dateStr] ? 0 : 1;
        });
    });

  // Display a message if no valid data is found
  if (validData.length === 0) {
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#ccc")
      .style("font-size", "14px")
      .text("No performance data for 2024");
  }
}