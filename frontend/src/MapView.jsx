import {
  MapContainer, TileLayer, Marker, Popup,
  ZoomControl, useMap, Polyline, useMapEvents
} from "react-leaflet";
import { useEffect, useState, useRef, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Palette & style ───────────────────────────────────────────────────────────
const C = {
  bg:       "#0d1117",
  surface:  "#161b22",
  border:   "#21262d",
  accent:   "#3fb950",
  accentDim:"#238636",
  danger:   "#f85149",
  warn:     "#d29922",
  text:     "#e6edf3",
  muted:    "#8b949e",
  panel:    "rgba(13,17,23,0.93)",
};

const fontStack = `'IBM Plex Mono', 'Fira Code', monospace`;

// Fix default leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const schoolIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:4px;
    background:#f0c040;border:2px solid #d4a800;
    display:flex;align-items:center;justify-content:center;
    font-size:16px;box-shadow:0 0 8px rgba(240,192,64,0.6);">🏫</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

const stopIcon = (n) => L.divIcon({
  className: "",
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#3fb950;border:2px solid #2ea043;
    display:flex;align-items:center;justify-content:center;
    color:#0d1117;font-weight:700;font-size:11px;font-family:monospace;
    box-shadow:0 0 6px rgba(63,185,80,0.5);">${n}</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

// ── Terrain overlay ────────────────────────────────────────────────────────────
// function TerrainOverlay({ topography }) {
//   const map = useMap();
//   useEffect(() => {
//     if (!topography) return;
//     const canvas = document.createElement("canvas");
//     const { elevations, bounds } = topography;
//     const rows = elevations.length, cols = elevations[0].length;
//     canvas.width = cols; canvas.height = rows;
//     const ctx = canvas.getContext("2d");
//     const flat = elevations.flat();
//     const min = Math.min(...flat), max = Math.max(...flat);
//     for (let y = 0; y < rows; y++) {
//       for (let x = 0; x < cols; x++) {
//         const v = (elevations[y][x] - min) / (max - min);
//         const r = Math.floor(v * 80 + 20);
//         const g = Math.floor(v * 100 + 30);
//         const b = Math.floor(v * 60 + 10);
//         ctx.fillStyle = `rgba(${r},${g},${b},0.1)`;
//         ctx.fillRect(x, y, 1, 1);
//       }
//     }
//     const overlay = L.imageOverlay(
//       canvas.toDataURL(),
//       [[bounds.bottom, bounds.left], [bounds.top, bounds.right]],
//       { opacity: 0.6 }
//     ).addTo(map);
//     return () => map.removeLayer(overlay);
//   }, [topography, map]);
//   return null;
// }

// ── Click handler to add stops ─────────────────────────────────────────────────
function ClickHandler({ addingStops, onAddStop }) {
  useMapEvents({
    click(e) {
      if (addingStops) onAddStop(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, highlight }) {
  return (
    <div style={{
      background: highlight ? "rgba(63,185,80,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${highlight ? C.accentDim : C.border}`,
      borderRadius: 6, padding: "8px 12px", flex: 1, minWidth: 80
    }}>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: highlight ? C.accent : C.text, fontSize: 18, fontWeight: 700, lineHeight: 1.3 }}>
        {value}<span style={{ fontSize: 11, color: C.muted, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

// ── Main map view ──────────────────────────────────────────────────────────────
function MapView() {
  const [topography,   setTopography]   = useState(null);
  const [school,       setSchool]       = useState(null);  // {lat, lon}
  const [schoolInput,  setSchoolInput]  = useState("");
  const [stops,        setStops]        = useState([]);    // [{lat,lon,label}]
  const [numStudents,  setNumStudents]  = useState(20);
  const [addingStops,  setAddingStops]  = useState(false);
  const [csvError,     setCsvError]     = useState("");
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);  // route result
  const [showFastest,  setShowFastest]  = useState(false);
  const [error,        setError]        = useState("");
  const fileRef = useRef();


  useEffect(() => {
    fetch(`http://10.180.0.161:6001/topography`).then(r => r.json()).then(setTopography);
  }, []);

  const center = topography
    ? [(topography.bounds.top + topography.bounds.bottom) / 2,
       (topography.bounds.left + topography.bounds.right) / 2]
    : [36.08, -81.9];

  // ── Geocode school ────────────────────────────────────────────────────────
  const handleGeocodeSchool = async () => {
    if (!schoolInput.trim()) return;
    setError("");
    try {
      const res  = await fetch(`${API}/geocode?address=${encodeURIComponent(schoolInput)}`);
      const data = await res.json();
      if (data.error) { setError("Address not found."); return; }
      setSchool({ lat: data.lat, lon: data.lon });
    } catch {
      setError("Could not reach server.");
    }
  };

  // ── Add stop from map click ────────────────────────────────────────────────
  const handleAddStop = useCallback((lat, lon) => {
    setStops(prev => [...prev, { lat, lon, label: `Stop ${prev.length + 1}` }]);
  }, []);

  const removeStop = (i) => setStops(prev => prev.filter((_, idx) => idx !== i));

  // ── CSV upload ────────────────────────────────────────────────────────────
  const handleCsv = (e) => {
    setCsvError("");
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const lines = ev.target.result.trim().split("\n");
      const parsed = [];
      lines.forEach((line, i) => {
        const cols = line.split(",");
        if (cols.length < 2) return;
        const lat = parseFloat(cols[0]), lon = parseFloat(cols[1]);
        if (isNaN(lat) || isNaN(lon)) {
          setCsvError(`Row ${i + 1}: invalid coords`);
          return;
        }
        parsed.push({ lat, lon, label: cols[2]?.trim() || `Stop ${stops.length + i + 1}` });
      });
      setStops(prev => [...prev, ...parsed]);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Compute routes ────────────────────────────────────────────────────────
  const handleCompute = async () => {
    if (!school) { setError("Please set the school location first."); return; }
    if (stops.length === 0) { setError("Add at least one student stop."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res  = await fetch(`${API}/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ school, stops, num_students: numStudents }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Routing failed. Check the server.");
    } finally {
      setLoading(false);
    }
  };

  if (!topography) return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: C.bg, color: C.text, fontFamily: fontStack,
      flexDirection: "column", gap: 16
    }}>
      <div style={{ fontSize: 28 }}>⟳</div>
      <div style={{ color: C.muted, fontSize: 13 }}>Loading terrain data…</div>
    </div>
  );

  const displayRoute = result
    ? (showFastest ? result.fastest_route : result.carbon_route)
    : null;

  return (
    <div style={{ height: "100vh", width: "100vw", display: "flex", background: C.bg, fontFamily: fontStack }}>

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div style={{
        width: 320, minWidth: 320, height: "100vh", overflowY: "auto",
        background: C.surface, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", zIndex: 1000
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 12px", borderBottom: `1px solid ${C.border}`
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🚌</span>
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 15, letterSpacing: "0.04em" }}>
              BUS ROUTER
            </span>
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>Carbon-efficient school bus routing</div>
        </div>

        <div style={{ padding: "16px 16px 0", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* School address */}
          <section>
            <Label>🏫 School Address</Label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={schoolInput}
                onChange={e => setSchoolInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGeocodeSchool()}
                placeholder="e.g. Avery County High School"
                style={inputStyle}
              />
              <button onClick={handleGeocodeSchool} style={btnSmall}>Set</button>
            </div>
            {school && (
              <div style={{ color: C.accent, fontSize: 11, marginTop: 4 }}>
                ✓ {school.lat.toFixed(5)}, {school.lon.toFixed(5)}
              </div>
            )}
          </section>

          {/* Student count */}
          <section>
            <Label>👥 Students on Bus</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range" min={1} max={50} value={numStudents}
                onChange={e => setNumStudents(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: C.accent }}
              />
              <span style={{ color: C.text, fontSize: 14, fontWeight: 700, width: 28 }}>{numStudents}</span>
            </div>
          </section>

          {/* Stops */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>📍 Student Stops</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setAddingStops(v => !v)}
                  style={{
                    ...btnSmall,
                    background: addingStops ? C.accent : C.border,
                    color: addingStops ? C.bg : C.text,
                  }}
                >
                  {addingStops ? "✓ Click map" : "+ Map"}
                </button>
                <button onClick={() => fileRef.current.click()} style={btnSmall}>CSV</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCsv} style={{ display: "none" }} />
              </div>
            </div>
            {csvError && <div style={{ color: C.danger, fontSize: 11, marginBottom: 4 }}>{csvError}</div>}
            {addingStops && (
              <div style={{
                background: "rgba(63,185,80,0.08)", border: `1px solid ${C.accentDim}`,
                borderRadius: 6, padding: "6px 10px", fontSize: 11, color: C.accent, marginBottom: 6
              }}>
                Click anywhere on the map to add stops
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
              {stops.length === 0 && (
                <div style={{ color: C.muted, fontSize: 12 }}>No stops added yet.</div>
              )}
              {stops.map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                  borderRadius: 5, padding: "5px 10px"
                }}>
                  <span style={{ color: C.text, fontSize: 12 }}>
                    <span style={{ color: C.accent }}>#{i + 1}</span> {s.label}
                  </span>
                  <button onClick={() => removeStop(i)}
                    style={{ background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
            {stops.length > 0 && (
              <button onClick={() => setStops([])}
                style={{ ...btnSmall, marginTop: 6, background: "rgba(248,81,73,0.1)", borderColor: C.danger, color: C.danger, width: "100%" }}>
                Clear all stops
              </button>
            )}
          </section>

          {/* CSV format hint */}
          <div style={{
            background: "rgba(139,148,158,0.06)", border: `1px solid ${C.border}`,
            borderRadius: 5, padding: "7px 10px", fontSize: 10, color: C.muted
          }}>
            CSV format: <span style={{ color: C.text }}>lat,lon,label</span> (one stop per row)
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: "rgba(248,81,73,0.08)", border: `1px solid ${C.danger}`,
              borderRadius: 6, padding: "8px 12px", color: C.danger, fontSize: 12
            }}>
              {error}
            </div>
          )}

          {/* Compute */}
          <button
            onClick={handleCompute}
            disabled={loading}
            style={{
              background: loading ? C.border : C.accent,
              color: loading ? C.muted : C.bg,
              border: "none", borderRadius: 7, padding: "11px 0",
              fontFamily: fontStack, fontWeight: 700, fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.06em", transition: "background 0.2s",
              width: "100%"
            }}
          >
            {loading ? "⟳  Computing…" : "⚡ COMPUTE ROUTES"}
          </button>

          {/* Results */}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: 20 }}>
              <div style={{
                background: "rgba(63,185,80,0.06)", border: `1px solid ${C.accentDim}`,
                borderRadius: 8, padding: 12
              }}>
                <div style={{ color: C.accent, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  🌿 Carbon Saved vs Fastest
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                  <StatCard label="CO₂ Saved" value={result.carbon_saved_kg} unit="kg" highlight />
                  <StatCard label="Reduction" value={result.carbon_saved_pct} unit="%" highlight />
                </div>
              </div>

              {/* Toggle */}
              <div style={{
                display: "flex", border: `1px solid ${C.border}`,
                borderRadius: 7, overflow: "hidden"
              }}>
                {[["🌿 Carbon Route", false], ["⚡ Fastest Route", true]].map(([label, isFastest]) => (
                  <button key={label}
                    onClick={() => setShowFastest(isFastest)}
                    style={{
                      flex: 1, padding: "8px 4px", border: "none",
                      background: showFastest === isFastest ? (isFastest ? C.warn : C.accent) : "transparent",
                      color: showFastest === isFastest ? C.bg : C.muted,
                      fontFamily: fontStack, fontSize: 11, fontWeight: 700, cursor: "pointer",
                      transition: "background 0.15s"
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Active route stats */}
              {displayRoute && (
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: 12
                }}>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {showFastest ? "Fastest Route Stats" : "Carbon Route Stats"}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <StatCard label="CO₂" value={displayRoute.stats.carbon_kg} unit="kg" />
                    <StatCard label="Dist" value={displayRoute.stats.distance_km} unit="km" />
                    <StatCard label="Time" value={displayRoute.stats.time_min} unit="min" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={center} zoom={11} minZoom={9} maxZoom={16}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            attribution="© OpenStreetMap contributors"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}
"
          />
          <ZoomControl position="topright" />
          
          <ClickHandler addingStops={addingStops} onAddStop={handleAddStop} />

          {/* School marker */}
          {school && (
            <Marker position={[school.lat, school.lon]} icon={schoolIcon}>
              <Popup>🏫 School</Popup>
            </Marker>
          )}

          {/* Stop markers */}
          {stops.map((s, i) => (
            <Marker key={i} position={[s.lat, s.lon]} icon={stopIcon(i + 1)}>
              <Popup>{s.label}<br />{s.lat.toFixed(5)}, {s.lon.toFixed(5)}</Popup>
            </Marker>
          ))}

          {/* Route polylines */}
          {result && result.fastest_route.coords.length > 0 && (
            <Polyline
              positions={result.fastest_route.coords.map(c => [c.lat, c.lon])}
              pathOptions={{ color: "#d29922", weight: showFastest ? 4 : 2, opacity: showFastest ? 0.9 : 0.3, dashArray: "6 4" }}
            />
          )}
          {result && result.carbon_route.coords.length > 0 && (
            <Polyline
              positions={result.carbon_route.coords.map(c => [c.lat, c.lon])}
              pathOptions={{ color: "#3fb950", weight: showFastest ? 2 : 4, opacity: showFastest ? 0.3 : 0.9 }}
            />
          )}
        </MapContainer>

        {/* Map legend */}
        {result && (
          <div style={{
            position: "absolute", bottom: 20, right: 20, zIndex: 999,
            background: C.panel, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: "10px 14px", fontFamily: fontStack,
            display: "flex", flexDirection: "column", gap: 6
          }}>
            <LegendRow color={C.accent} label="Carbon-efficient route" />
            <LegendRow color={C.warn}   label="Fastest route" dashed />
          </div>
        )}

        {/* Adding stops hint overlay */}
        {addingStops && (
          <div style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999,
            background: C.panel, border: `1px solid ${C.accent}`,
            borderRadius: 20, padding: "8px 18px",
            color: C.accent, fontFamily: fontStack, fontSize: 12, fontWeight: 700,
            pointerEvents: "none"
          }}>
            📍 Click map to place student stops
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const inputStyle = {
  flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid #30363d`,
  borderRadius: 6, padding: "7px 10px", color: "#e6edf3",
  fontFamily: `'IBM Plex Mono', monospace`, fontSize: 12, outline: "none"
};

const btnSmall = {
  background: "#21262d", border: "1px solid #30363d", borderRadius: 6,
  color: "#e6edf3", fontFamily: `'IBM Plex Mono', monospace`,
  fontSize: 11, padding: "7px 10px", cursor: "pointer", whiteSpace: "nowrap"
};

function Label({ children }) {
  return (
    <div style={{
      color: "#8b949e", fontSize: 10, letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 6, fontWeight: 700
    }}>{children}</div>
  );
}

function LegendRow({ color, label, dashed }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 28, height: 3,
        background: dashed ? "none" : color,
        borderTop: dashed ? `2px dashed ${color}` : "none",
      }} />
      <span style={{ color: "#8b949e", fontSize: 11 }}>{label}</span>
    </div>
  );
}

export default MapView;
