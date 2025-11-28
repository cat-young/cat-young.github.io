const client = FHIR.client("https://r3.smarthealthit.org");

function addRow(patient, appointment, practitioner, location) {
  console.log("patient:", patient);
  console.log("appointment:", appointment);
  console.log("practitioner:", practitioner);
  console.log("location:", location);

  var apptResults = document.querySelector("#apptResults");

  var tr = document.createElement("tr");

  var td = document.createElement("td");
  td.innerHTML = patient.name[0].given[0];
  tr.appendChild(td);

  var td = document.createElement("td");
  td.innerHTML = patient.name[0].family;
  tr.appendChild(td);

  var td = document.createElement("td");
  td.innerHTML = appointment.requestedPeriod[0].start.substring(0, 10);
  tr.appendChild(td);

  var td = document.createElement("td");
  td.innerHTML = appointment.specialty?.[0]?.coding?.[0]?.display;
  tr.appendChild(td);

  var td = document.createElement("td");
  td.innerHTML = practitioner?.name?.[0]?.family;
  tr.appendChild(td);

  var td = document.createElement("td");
  td.innerHTML = location?.name;
  tr.appendChild(td);

  apptResults.append(tr);
}

function handlePatient(patient) {
  client
    .request(`Appointment?patient=${patient.id}`)
    .then((bundle) => {
      if (!bundle.entry) return;

      bundle.entry.forEach(async (entry) => {
        const appointment = entry.resource;

        // Fetch practitioner
        let practitioner = null;
        let practitionerRef = appointment.participant.find((p) =>
          p.actor?.reference?.startsWith("Practitioner/"),
        );
        if (practitionerRef) {
          practitioner = await client.request(practitionerRef.actor.reference);
        }

        // Fetch location
        let location = null;
        let locationRef = appointment.participant.find((p) =>
          p.actor?.reference?.startsWith("Location/"),
        );
        if (locationRef) {
          location = await client.request(locationRef.actor.reference);
        }

        addRow(patient, appointment, practitioner, location);
      });
    })
    .catch(console.error);
}



var map = L.map('map');
map.setView([40, -90], 3);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
}).addTo(map);



// ---------------------
function addMarkers(locations) {
  for (let loc of locations) {
    const marker = L.marker([loc.latitude, loc.longitude]).addTo(map);

    marker.bindTooltip(loc.hospital);

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML =
      `<p>
        <strong>${loc.hospital}</strong><br>
        ${loc.latitude}, ${loc.longitude}<br>
        <em>${loc.sourceNote}</em>
      </p>`;

    marker.bindPopup(popupDiv);

    marker.on("click", function () {
      this._map.setView(this.getLatLng(), 6);
    });
  }
}


// ---------------------------------------
async function geocodeAddress(addressString) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}`;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "FHIR-Map-Demo" }
    });
    const results = await response.json();

    if (results.length > 0) {
      return {
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
    }
  } catch (err) {
    console.error("Geocoding error:", err);
  }

  return null;
}



// ---------------------------------------------------------
async function loadAppointmentLocations(n) {

  const apptBundle = await client.request(`Appointment?patient=${n}`);

  if (!apptBundle.entry) {
    alert("No appointments found for this patient.");
    return;
  }

  const locRefs = [];

  apptBundle.entry.forEach(e => {
    const appt = e.resource;

    (appt.participant || []).forEach(p => {
      if (p.actor?.reference?.startsWith("Location/")) {
        locRefs.push(p.actor.reference);
      }
    });
  });

  if (locRefs.length === 0) {
    alert("Appointments found but no Locations.");
    return;
  }

  const finalLocations = [];

  for (const ref of locRefs) {
    let loc;

    try {
      loc = await client.request(ref);
    } catch (err) {
      console.warn("Failed to load location:", ref);
      continue;
    }

    // A) Use direct coordinates if they exist
    if (loc.position?.latitude && loc.position?.longitude) {
      finalLocations.push({
        hospital: loc.name || "Appointment Location",
        latitude: loc.position.latitude,
        longitude: loc.position.longitude,
        sourceNote: "(from FHIR coordinates)"
      });
      continue;
    }

    // B) Try address geocoding
    if (loc.address) {
      const fullAddress = [
        loc.address.line?.join(" "),
        loc.address.city,
        loc.address.state,
        loc.address.postalCode,
        loc.address.country
      ].filter(Boolean).join(", ");

      const geo = await geocodeAddress(fullAddress);

      if (geo) {
        finalLocations.push({
          hospital: loc.name || "Appointment Location",
          latitude: geo.lat,
          longitude: geo.lon,
          sourceNote: `(geocoded from address: ${fullAddress})`
        });
        continue;
      }
    }

    // C) FALLBACK (no coords, no address)
    finalLocations.push({
      hospital: loc.name || "Sanford Health Hearing Center Dickinson",
      latitude: 46.87874,       
      longitude: -102.80961,     
      sourceNote: "(fallback location — no coordinates or address)"
    });
  }

  if (finalLocations.length === 0) {
    alert("No mappable locations found.");
    return;
  }

  addMarkers(finalLocations);
}

function showAppts() {
  var n = prompt(
    "Patient ID to search:",
    "2e27c71e-30c8-4ceb-8c1c-5641e066c0a4",
  );

  client
    .request("Patient/" + n)
    .then(handlePatient)
    .catch(console.error);

  loadAppointmentLocations(n)
  
}
