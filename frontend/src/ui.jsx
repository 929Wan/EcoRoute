import { useState, useRef } from "react";

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

const BUS_COLORS = [
  "#3fb950", "#58a6ff", "#f78166", "#d29922",
  "#bc8cff", "#39d353", "#ff7b72", "#79c0ff",
  "#56d364", "#ffa657"
];

function StatCard({ label, value, unit, highlight }) {
  return (
    <div style={{
      background: highlight ? "rgba(63,185,80,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${highlight ? C.accentDim : C.border}`,
      borderRadius: 6, padding: "8px 12px", flex: 1, minWidth: 60
    }}>
      <div style={{ color: C.muted, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      <div style={{ color: highlight ? C.accent : C.text, fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
        {value}<span style={{ fontSize: 10, color: C.muted, marginLeft: 3 }}>{unit}</span>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      color: C.muted, fontSize: 10, letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 6, fontWeight: 700
    }}>{children}</div>
  );
}

const inputStyle = {
  flex: 1, background: "rgba(255,255,255,0.05)", border: `1px solid #30363d`,
  borderRadius: 6, padding: "7px 10px", color: C.text,
  fontFamily: fontStack, fontSize: 12, outline: "none"
};

const btnSmall = {
  background: C.border, border: `1px solid #30363d`, borderRadius: 6,
  color: C.text, fontFamily: fontStack,
  fontSize: 11, padding: "7px 10px", cursor: "pointer", whiteSpace: "nowrap"
};

function UI({
  school,
  schoolInput,
  onSchoolInputChange,
  onGeocodeSchool,
  stops,
  numStudents,
  onNumStudentsChange,
  addingStops,
  onAddingStopsChange,
  csvError,
  fileRef,
  onCsv,
  onRemoveStop,
  onClearAllStops,
  loading,
  onCompute,
  result,
  selectedBus,
  onSelectBus,
  onAnimateBus,
  error
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [busViewMode, setBusViewMode] = useState({});
  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          top: "20px",
          left: isOpen ? "330px" : "20px",
          backgroundColor: C.accent,
          border: "none",
          color: "white",
          fontSize: "24px",
          cursor: "pointer",
          zIndex: 1001,
          padding: "8px 12px",
          borderRadius: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          transition: "left 0.3s ease"
        }}
      >
        <div style={{ width: "24px", height: "2px", backgroundColor: "white" }}></div>
        <div style={{ width: "24px", height: "2px", backgroundColor: "white" }}></div>
        <div style={{ width: "24px", height: "2px", backgroundColor: "white" }}></div>
      </button>

      {/* Sidebar Panel */}
      <div style={{
        width: 320,
        minWidth: 320,
        height: "100vh",
        overflowY: "auto",
        background: C.surface,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
        visibility: isOpen ? "visible" : "hidden"
      }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 4 }}>
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 35, letterSpacing: "0.04em", fontFamily: "'Segoe UI', 'Helvetica', sans-serif" }}>
              ECOROUTE
            </span>
          </div>
          <div style={{ color: C.muted, fontSize: 11 }}>Carbon-efficient school bus routing</div>
        </div>

        <div style={{ padding: "16px 16px 0", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* School address */}
          <section>
            <Label>School Address</Label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={schoolInput}
                onChange={e => onSchoolInputChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onGeocodeSchool()}
                placeholder="e.g. Avery County High School"
                style={inputStyle}
              />
              <button onClick={onGeocodeSchool} style={btnSmall}>Set</button>
            </div>
            {school && (
              <div style={{ color: C.accent, fontSize: 11, marginTop: 4 }}>
                ✓ {school.lat.toFixed(5)}, {school.lon.toFixed(5)}
              </div>
            )}
          </section>

          {/* Student count */}
          <section>
            <Label>Total Students</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="range" min={1} max={540}
                value={numStudents}
                onChange={e => onNumStudentsChange(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: C.accent }}
              />
              <span style={{ color: C.text, fontSize: 14, fontWeight: 700, width: 36 }}>{numStudents}</span>
            </div>
          </section>

          {/* Stops */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Label>Student Stops</Label>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => onAddingStopsChange(!addingStops)}
                  style={{
                    ...btnSmall,
                    background: addingStops ? C.accent : C.border,
                    color: addingStops ? C.bg : C.text,
                  }}
                >
                  {addingStops ? "✓ Click map" : "+ Map"}
                </button>
                <button onClick={() => fileRef.current.click()} style={btnSmall}>CSV</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={onCsv} style={{ display: "none" }} />
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
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 160, overflowY: "auto" }}>
              {stops.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>No stops added yet.</div>}
              {stops.map((s, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`,
                  borderRadius: 5, padding: "5px 10px"
                }}>
                  <span style={{ color: C.text, fontSize: 12 }}>
                    <span style={{ color: C.accent }}>#{i + 1}</span> {s.label}
                  </span>
                  <button onClick={() => onRemoveStop(i)} style={{
                    background: "none", border: "none", color: C.danger, cursor: "pointer", fontSize: 14
                  }}>×</button>
                </div>
              ))}
            </div>
            {stops.length > 0 && (
              <button onClick={onClearAllStops} style={{
                ...btnSmall, marginTop: 6,
                background: "rgba(248,81,73,0.1)", borderColor: C.danger, color: C.danger, width: "100%"
              }}>
                Clear all stops
              </button>
            )}
          </section>

          {/* CSV hint */}
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
            onClick={onCompute}
            disabled={loading}
            style={{
              background: loading ? C.border : C.accent,
              color: loading ? C.muted : C.bg,
              border: "none", borderRadius: 7, padding: "11px 0",
              fontFamily: fontStack, fontWeight: 700, fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.06em", transition: "background 0.2s", width: "100%"
            }}
          >
            {loading ? "⟳  Computing…" : "🚌 COMPUTE ROUTES"}
          </button>

          {/* Results */}
          {result && result.buses && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 24 }}>

              {/* Summary */}
              <div style={{
                background: "rgba(63,185,80,0.06)", border: `1px solid ${C.accentDim}`,
                borderRadius: 8, padding: "12px"
              }}>
                <div style={{ color: C.accent, fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
                  FLEET SUMMARY
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <StatCard label="Buses" value={result.num_buses} unit="" highlight />
                  <StatCard label="Total CO₂" value={result.total_carbon_kg} unit="kg" highlight />
                </div>
              </div>

              {/* Per-bus cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Label>Bus Routes</Label>
                {result.buses.map((bus, i) => {
                  const color = BUS_COLORS[i % BUS_COLORS.length];
                  const isSelected = selectedBus === bus.bus_id;
                  return (
                    <div
                      key={bus.bus_id}
                      onClick={() => onSelectBus(isSelected ? null : bus.bus_id)}
                      style={{
                        background: isSelected ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isSelected ? color : C.border}`,
                        borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                        transition: "border-color 0.15s"
                      }}
                    >
                      {/* Bus header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 12, height: 12, borderRadius: "50%",
                          background: color, flexShrink: 0
                        }} />
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 12 }}>
                          Bus {bus.bus_id}
                        </span>
                        <span style={{ color: C.muted, fontSize: 11, marginLeft: "auto" }}>
                          {bus.num_students} students · {bus.stop_indices.length} stops
                        </span>
                      </div>
                      {/* Mode toggle */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                        {["carbon", "fastest"].map(mode => {
                          const active = (busViewMode[bus.bus_id] ?? "carbon") === mode;
                          return (
                            <button
                              key={mode}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBusViewMode(prev => ({ ...prev, [bus.bus_id]: mode }));
                              }}
                              style={{
                                flex: 1, padding: "4px 0",
                                background: active ? (mode === "carbon" ? C.accentDim : "rgba(210,153,34,0.2)") : "none",
                                border: `1px solid ${active ? (mode === "carbon" ? C.accent : C.warn) : C.border}`,
                                borderRadius: 4, cursor: "pointer",
                                color: active ? (mode === "carbon" ? C.accent : C.warn) : C.muted,
                                fontFamily: fontStack, fontSize: 10,
                                letterSpacing: "0.06em", textTransform: "uppercase"
                              }}
                            >
                              {mode === "carbon" ? "🌿 Eco" : "⚡ Fastest"}
                            </button>
                          );
                        })}
                      </div>

                      {/* Stats — dynamic based on mode */}
                      {(() => {
                        const mode = busViewMode[bus.bus_id] ?? "carbon";
                        const stats = mode === "carbon"
                          ? bus.carbon_route.stats
                          : bus.fastest_route.stats;
                        const savedKg = (bus.fastest_route.stats.carbon_kg - bus.carbon_route.stats.carbon_kg).toFixed(2);
                        const savedPct = ((savedKg / bus.fastest_route.stats.carbon_kg) * 100).toFixed(1);
                        return (
                          <>
                            <div style={{ display: "flex", gap: 6 }}>
                              <StatCard label="CO₂" value={stats.carbon_kg} unit="kg" highlight={mode === "carbon"} />
                              <StatCard label="Dist" value={stats.distance_km} unit="km" />
                              <StatCard label="Time" value={stats.time_min} unit="min" />
                            </div>
                            <div style={{
                              marginTop: 6, padding: "4px 8px", borderRadius: 4, fontSize: 10,
                              background: mode === "carbon" ? "rgba(63,185,80,0.06)" : "rgba(210,153,34,0.06)",
                              border: `1px solid ${mode === "carbon" ? C.accentDim : C.warn}`,
                              color: mode === "carbon" ? C.accent : C.warn
                            }}>
                              {mode === "carbon"
                                ? `🌿 Saves ${savedKg} kg CO₂ (${savedPct}%) vs fastest`
                                : `⚡ ${savedKg} kg more CO₂ than eco route`}
                            </div>
                          </>
                        );
                      })()}

                      {/* Animate button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const mode = busViewMode[bus.bus_id] ?? "carbon";
                          onSelectBus(bus.bus_id);
                          onAnimateBus({
                            coords: mode === "carbon"
                              ? bus.carbon_route.coords
                              : bus.fastest_route.coords,
                            color,
                            key: Date.now()
                          });
                        }}
                        style={{
                          marginTop: 8, width: "100%", background: "none",
                          border: `1px solid ${color}`, borderRadius: 5, color,
                          fontFamily: fontStack, fontSize: 11,
                          padding: "5px 0", cursor: "pointer", letterSpacing: "0.06em"
                        }}
                      >
                        ▶ ANIMATE {(busViewMode[bus.bus_id] ?? "carbon") === "carbon" ? "ECO" : "FASTEST"} ROUTE
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default UI;
