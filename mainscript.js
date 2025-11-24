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

