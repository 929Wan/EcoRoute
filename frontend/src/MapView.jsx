import {
  MapContainer, TileLayer, Marker, Popup,
  ZoomControl, useMap, Polyline, useMapEvents
} from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const BUS_COLORS = [
  "#3fb950", "#58a6ff", "#f78166", "#d29922",
  "#bc8cff", "#39d353", "#ff7b72", "#79c0ff",
  "#56d364", "#ffa657"
];

const fontStack = `'IBM Plex Mono', 'Fira Code', monospace`;

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

const busIcon = (color) => L.divIcon({
  className: "",
  html: `<div style="
    width:28px;height:28px;border-radius:50%;
    background:${color};border:2px solid white;
    display:flex;align-items:center;justify-content:center;
    font-size:16px;box-shadow:0 0 8px ${color}88;
    z-index:9999;">🚌</div>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

function TerrainOverlay({ topography }) {
  const map = useMap();
  useEffect(() => {
    if (!topography) return;
    const canvas = document.createElement("canvas");
    const { elevations, bounds } = topography;
    const rows = elevations.length, cols = elevations[0].length;
    canvas.width = cols; canvas.height = rows;
    const ctx = canvas.getContext("2d");
    const flat = elevations.flat();
    const min = Math.min(...flat), max = Math.max(...flat);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = (elevations[y][x] - min) / (max - min);
        ctx.fillStyle = `rgba(0,0,0,${(1 - v) * 0.0})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const overlay = L.imageOverlay(
      canvas.toDataURL(),
      [[bounds.bottom, bounds.left], [bounds.top, bounds.right]],
      { opacity: 1 }
    ).addTo(map);
    return () => map.removeLayer(overlay);
  }, [topography, map]);
  return null;
}

function ClickHandler({ addingStops, onAddStop }) {
  useMapEvents({
    click(e) {
      if (addingStops) onAddStop(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

function AnimatedBus({ coords, color }) {
  const map = useMap();
  const stateRef = useRef({ cancelled: false, marker: null, raf: null });

  useEffect(() => {
    if (!coords || coords.length < 2) return;

    const state = { cancelled: false, marker: null, raf: null };
    stateRef.current = state;

    const icon = busIcon(color);
    const marker = L.marker([coords[0].lat, coords[0].lon], {
      icon,
      zIndexOffset: 9000,
    }).addTo(map);
    state.marker = marker;

    const dists = [0];
    for (let i = 1; i < coords.length; i++) {
      const dlat = coords[i].lat - coords[i - 1].lat;
      const dlon = coords[i].lon - coords[i - 1].lon;
      dists.push(dists[i - 1] + Math.sqrt(dlat * dlat + dlon * dlon));
    }
    const totalDist = dists[dists.length - 1];

    const DURATION = Math.max(6000, Math.min(30000, totalDist * 80000));

    const startTime = performance.now();

    function animate(now) {
      if (state.cancelled) return;

      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const target = t * totalDist;

      let lo = 0, hi = dists.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (dists[mid] <= target) lo = mid; else hi = mid;
      }

      const segLen = dists[hi] - dists[lo];
      const segT = segLen > 0 ? (target - dists[lo]) / segLen : 0;
      const lat = coords[lo].lat + segT * (coords[hi].lat - coords[lo].lat);
      const lon = coords[lo].lon + segT * (coords[hi].lon - coords[lo].lon);

      marker.setLatLng([lat, lon]);

      if (t < 1) {
        state.raf = requestAnimationFrame(animate);
      }
    }

    state.raf = requestAnimationFrame(animate);

    return () => {
      state.cancelled = true;
      if (state.raf) cancelAnimationFrame(state.raf);
      if (state.marker) map.removeLayer(state.marker);
    };
  }, [coords, color, map]);

  return null;
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

function CountyBoundary() {
  const map = useMap();

  useEffect(() => {
    let layer = null;

    fetch("http://10.180.0.161:6001/county-boundary")
      .then(r => r.json())
      .then(data => {
        if (!data?.[0]?.geojson) return;
        layer = L.geoJSON(data[0].geojson, {
          style: {
            color: "#3fb950",
            weight: 2.5,
            opacity: 0.9,
            fillColor: "#3fb950",
            fillOpacity: 0.04,
          }
        }).addTo(map);
      })
      .catch(err => console.error("County boundary fetch failed:", err));

    return () => {
      if (layer) map.removeLayer(layer);
    };
  }, [map]);

  return null;
}

// main map
function MapView({
  school,
  stops,
  addingStops,
  onAddStop,
  result,
  showFastest,
  selectedBus,
  onSelectBus,
  animatingBus,
  onAnimateBus
}) {
  const [topography, setTopography] = useState(null);

  useEffect(() => {
    fetch(`http://10.180.0.161:6001/topography`).then(r => r.json()).then(setTopography);
  }, []);


  const center = topography
    ? [(topography.bounds.top + topography.bounds.bottom) / 2,
       (topography.bounds.left + topography.bounds.right) / 2]
    : [36.08, -81.9];

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

  const handlePolylineClick = (bus, color) => {
  onSelectBus(bus.bus_id);
  const coords = showFastest ? bus.fastest_route.coords : bus.carbon_route.coords;
  onAnimateBus({ coords, color, key: Date.now() });
  };


  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative", background: C.bg, fontFamily: fontStack }}>
      <MapContainer
        center={center} zoom={11} minZoom={9} maxZoom={16}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
        />
        <ZoomControl position="topright" />
        <TerrainOverlay topography={topography} />
        <CountyBoundary />
        <ClickHandler addingStops={addingStops} onAddStop={onAddStop} />

        {school && (
          <Marker position={[school.lat, school.lon]} icon={schoolIcon}>
            <Popup>🏫 School</Popup>
          </Marker>
        )}

        {stops.map((s, i) => (
          <Marker key={i} position={[s.lat, s.lon]} icon={stopIcon(i + 1)}>
            <Popup>{s.label}<br />{s.lat.toFixed(5)}, {s.lon.toFixed(5)}</Popup>
          </Marker>
        ))}

        {result && result.buses && result.buses.map((bus, i) => {
          const color = BUS_COLORS[i % BUS_COLORS.length];
          const isSelected = selectedBus === bus.bus_id;
          const carbonCoords = bus.carbon_route.coords;
          const fastestCoords = bus.fastest_route.coords;
          const activeCoords = showFastest ? fastestCoords : carbonCoords;

          return (
            <Polyline
              key={`${bus.bus_id}-${showFastest}`}
              positions={activeCoords.map(c => [c.lat, c.lon])}
              eventHandlers={{
                click: () => handlePolylineClick(bus, color)
              }}
              pathOptions={{
                color,
                weight: isSelected ? 6 : 4,
                opacity: isSelected ? 1.0 : 0.75,
              }}
            />
          );
        })}

        {animatingBus && (
          <AnimatedBus
            key={animatingBus.key}
            coords={animatingBus.coords}
            color={animatingBus.color}
          />
        )}
      </MapContainer>

      {result && (
        <div style={{
          position: "absolute", bottom: 20, right: 20, zIndex: 999,
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: "10px 14px", fontFamily: fontStack,
          display: "flex", flexDirection: "column", gap: 6
        }}>
          {result.buses && result.buses.map((bus, i) => (
            <LegendRow
              key={bus.bus_id}
              color={BUS_COLORS[i % BUS_COLORS.length]}
              label={`Bus ${bus.bus_id}`}
            />
          ))}
        </div>
      )}

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

      {result && !animatingBus && (
        <div style={{
          position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          background: C.panel, border: `1px solid ${C.border}`,
          borderRadius: 20, padding: "8px 18px",
          color: C.muted, fontFamily: fontStack, fontSize: 11,
          pointerEvents: "none"
        }}>
          🚌 Click a route to animate it
        </div>
      )}
    </div>
  );
}

export default MapView;
