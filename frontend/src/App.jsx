import MapView from "./MapView"
import UI from "./ui"
import { useState, useEffect, useRef, useCallback } from "react";

const API = "http://10.180.0.161:6001";

function App() {
  // Shared state
  const [school, setSchool] = useState(null);
  const [schoolInput, setSchoolInput] = useState("");
  const [stops, setStops] = useState([]);
  const [numStudents, setNumStudents] = useState(20);
  const [addingStops, setAddingStops] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef();
  const [showFastest, setShowFastest] = useState(false);
  const [animatingBus, setAnimatingBus] = useState(null);

  const handleGeocodeSchool = async () => {
    console.log("---- Geocode School Triggered ----");
    if (!schoolInput.trim()) return;
    console.log("School input:", schoolInput);
    setError("");
    try {
      const url = `${API}/geocode?address=${encodeURIComponent(schoolInput)}`;
      console.log("Request URL:", url);
      const res = await fetch(url);
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response JSON:", data);
      if (data.error) {
        setError("Address not found.");
        return;
      }
      console.log("Parsed lat/lon:", data.lat, data.lon);
      setSchool({ lat: Number(data.lat), lon: Number(data.lon) });
      console.log("School state updated successfully.");
    } catch (err) {
      console.error("Fetch failed:", err);
      setError("Could not reach server.");
    }
  };

  const handleAddStop = useCallback((lat, lon) => {
    setStops(prev => [...prev, { lat, lon, label: `Stop ${prev.length + 1}` }]);
  }, []);

  const removeStop = (i) => setStops(prev => prev.filter((_, idx) => idx !== i));

  const clearAllStops = () => setStops([]);

  const handleCsv = (e) => {
    setCsvError("");
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n");
      const parsed = [];
      let invalidRow = null;

      lines.forEach((line, i) => {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length < 2) return;
        const first = cols[0].toLowerCase();
        const second = cols[1].toLowerCase();
        const isHeader =
          (first === "lat" && second === "lon") ||
          (first === "latitude" && second === "longitude") ||
          (first === "lon" && second === "lat") ||
          (first === "longitude" && second === "latitude");
        if (isHeader) return;
        let lat = parseFloat(cols[0]);
        let lon = parseFloat(cols[1]);
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
          const tmp = lat; lat = lon; lon = tmp;
        }
        if (isNaN(lat) || isNaN(lon)) {
          if (invalidRow === null) invalidRow = i + 1;
          return;
        }
        parsed.push({ lat, lon, label: cols[2]?.trim() || `Stop ${stops.length + parsed.length + 1}` });
      });

      if (invalidRow !== null) setCsvError(`Row ${invalidRow}: invalid coords (skipped)`);
      setStops(prev => [...prev, ...parsed]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCompute = async () => {
    console.log("=== COMPUTE ROUTE CLICKED ===");
    if (!school) { setError("Please set the school location first."); return; }
    if (stops.length === 0) { setError("Add at least one student stop."); return; }
    setError("");
    setLoading(true);
    setResult(null);
    setSelectedBus(null);
    const payload = { school, stops, num_students: numStudents };
    console.log("Sending payload:", payload);
    try {
      const res = await fetch(`${API}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Server returned error:", text);
        setError(`Server error: ${res.status}`);
        return;
      }
      const data = await res.json();
      console.log("Parsed JSON response:", data);
      setResult(data);
      console.log("Route successfully stored in state");
    } catch (err) {
      console.error("Fetch failed:", err);
      setError("Routing failed. Check the server.");
    } finally {
      setLoading(false);
      console.log("=== ROUTE COMPUTE FINISHED ===");
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <MapView
        school={school}
        stops={stops}
        addingStops={addingStops}
        onAddStop={handleAddStop}
        result={result}
        showFastest={showFastest}
        selectedBus={selectedBus}
        onSelectBus={setSelectedBus}
        animatingBus={animatingBus}
        onAnimateBus={setAnimatingBus}
      />
      <div style={{ position: "absolute", top: "20px", left: "20px", zIndex: 1000 }}>
        <UI
          school={school}
          schoolInput={schoolInput}
          onSchoolInputChange={setSchoolInput}
          onGeocodeSchool={handleGeocodeSchool}
          stops={stops}
          numStudents={numStudents}
          onNumStudentsChange={setNumStudents}
          addingStops={addingStops}
          onAddingStopsChange={setAddingStops}
          csvError={csvError}
          fileRef={fileRef}
          onCsv={handleCsv}
          onRemoveStop={removeStop}
          onClearAllStops={clearAllStops}
          loading={loading}
          onCompute={handleCompute}
          result={result}
          selectedBus={selectedBus}
          onSelectBus={setSelectedBus}
          error={error}
          onAnimateBus={setAnimatingBus}
          showFastest={showFastest}
          onShowFastestChange={setShowFastest}
        />
      </div>
    </div>
  );
}

export default App;
