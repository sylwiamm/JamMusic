function updateSummary(csvData, personName = null, color = null) {
  let filteredData = csvData;

  let instrument = "";
  // If personName is provided, filter the data for that person
  if (personName) {
    filteredData = csvData.filter(row =>
      row["full_name"] && row["full_name"].toLowerCase() === personName.toLowerCase()
    );
    // Extract instrument_english from the first matching record (if found)
    if (filteredData.length > 0) {
      instrument = filteredData[0]["instrument_english"];
    }
  }

  // Calculate summary statistics
  const eventCount = filteredData.length;

  // Get unique cities - filtering out empty or null values
  const uniqueCities = [...new Set(filteredData
    .map(row => row.city)
    .filter(city => city && city.trim() !== "")
  )];
  const cityCount = uniqueCities.length;

  // Get unique countries - filtering out empty or null values
  const uniqueCountries = [...new Set(filteredData
    .map(row => row.country)
    .filter(country => country && country.trim() !== "")
  )];
  const countryCount = uniqueCountries.length;

  // Update the summary elements with new data
  const eventCountElement = document.getElementById('event-count');
  const cityCountElement = document.getElementById('city-count');
  const countryCountElement = document.getElementById('country-count');

  eventCountElement.textContent = eventCount;
  cityCountElement.textContent = cityCount;
  countryCountElement.textContent = countryCount;

  // Apply color, otherwise use default
  const numberColor = color || '#FFFFFF';

  eventCountElement.style.color = numberColor;
  cityCountElement.style.color = numberColor;
  countryCountElement.style.color = numberColor;

  // Format the additional info section
  const additionalInfoElement = document.getElementById('additional-info');

  if (personName) {
    // For person-specific view, list all places they performed
    // Group the data by city and country
    const locationCounts = {};

    filteredData.forEach(row => {
      if (row.city && row.city.trim() !== "" && row.country && row.country.trim() !== "") {
        const key = `${row.city}, ${row.country}`;
        locationCounts[key] = (locationCounts[key] || 0) + 1;
      }
    });

    // Create formatted lines for each location
    const locationLines = Object.entries(locationCounts).map(([location, count]) => {
      return `${location} (${count} event${count > 1 ? 's' : ''})`;
    }).sort();

    // Join with line breaks and set the content
    if (locationLines.length > 0) {
      additionalInfoElement.innerHTML = `<strong>${personName}'s performance (${instrument ? 
        `<span style="color:${numberColor}">${instrument}</span>` : 
        'Unknown instrument'}):</strong><br>` + locationLines.join('<br>');
    } else {
      additionalInfoElement.textContent = `No location data available for ${personName}.`;
    }
  } else {
    // For overall view, show countries
    const countriesList = uniqueCountries.sort().join(', ');
    if (uniqueCountries.length > 0) {
      additionalInfoElement.textContent = `Data includes events from: ${countriesList}`;
    } else {
      additionalInfoElement.textContent = "No country information available in the dataset.";
    }
  }
}