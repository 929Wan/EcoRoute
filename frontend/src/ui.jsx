import { useState, useRef } from "react";

const _link = document.createElement("link");
_link.rel  = "stylesheet";
_link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap";
document.head.appendChild(_link);

const C = {
  bg:        "#090c10",
  surface:   "#0d1117",
  surfaceHi: "#161b22",
  border:    "#1e2530",
  accent:    "#34d058",
  accentDim: "#1a7f37",
  danger:    "#f85149",
  warn:      "#e3a008",
  text:      "#f0f6fc",
  muted:     "#7d8590",
};

const sans = `'Space Grotesk', 'Inter', system-ui, sans-serif`;
const body = `'Inter', system-ui, sans-serif`;

const BUS_COLORS = [
  "#34d058","#58a6ff","#ff7b72","#e3a008",
  "#bc8cff","#39d353","#ffa657","#79c0ff",
  "#56d364","#f78166"
];

function StatCard({ label, value, unit, highlight, warn }) {
  const col = highlight ? C.accent : warn ? C.warn : C.text;
  return (
    <div style={{
      background: highlight ? "rgba(52,208,88,0.07)" : warn ? "rgba(227,160,8,0.07)" : "rgba(255,255,255,0.02)",
      border: `1px solid ${highlight ? C.accentDim : warn ? "rgba(227,160,8,0.3)" : C.border}`,
      borderRadius: 8, padding: "8px 10px", flex: 1, minWidth: 56,
    }}>
      <div style={{ color: C.muted, fontSize: 9, letterSpacing: "0.09em", textTransform: "uppercase", fontFamily: body, marginBottom: 2 }}>{label}</div>
      <div style={{ color: col, fontSize: 14, fontWeight: 600, lineHeight: 1.2, fontFamily: sans }}>
        {value}<span style={{ fontSize: 9, color: C.muted, marginLeft: 2, fontWeight: 400 }}>{unit}</span>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      color: C.muted, fontSize: 10, letterSpacing: "0.12em",
      textTransform: "uppercase", marginBottom: 8, fontWeight: 600, fontFamily: body,
    }}>{children}</div>
  );
}

const inputStyle = {
  flex: 1, background: "rgba(255,255,255,0.04)",
  border: `1px solid #1e2530`, borderRadius: 8,
  padding: "8px 12px", color: "#f0f6fc",
  fontFamily: body, fontSize: 13, outline: "none",
};

const btnSmall = {
  background: "#161b22", border: "1px solid #1e2530",
  borderRadius: 8, color: "#f0f6fc", fontFamily: body,
  fontSize: 12, fontWeight: 500, padding: "8px 12px",
  cursor: "pointer", whiteSpace: "nowrap",
};

function UI({
  school, schoolInput, onSchoolInputChange, onGeocodeSchool,
  stops, numStudents, onNumStudentsChange,
  addingStops, onAddingStopsChange,
  csvError, fileRef, onCsv, onRemoveStop, onClearAllStops,
  loading, onCompute,
  result, selectedBus, onSelectBus, onAnimateBus,
  showFastest, onShowFastestChange,
  error,
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [busViewMode, setBusViewMode] = useState({});
  const W = 300;

  return (
    <>
      {/* Hamburger */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          position: "fixed", top: 16,
          left: isOpen ? W + 12 : 16,
          background: C.accent, border: "none", borderRadius: 8,
          width: 36, height: 36, cursor: "pointer", zIndex: 1001,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 5,
          transition: "left 0.28s cubic-bezier(.4,0,.2,1)",
          boxShadow: "0 2px 12px rgba(52,208,88,0.3)",
        }}
      >
        {[0,1,2].map(n => <div key={n} style={{ width: 16, height: 2, background: "#000", borderRadius: 2 }} />)}
      </button>

      {/* Sidebar */}
      <div style={{
        width: W, height: "100vh", overflowY: "auto", overflowX: "hidden",
        background: C.surface, borderRight: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 1000,
        transform: isOpen ? "translateX(0)" : `translateX(-${W}px)`,
        transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
        fontFamily: body,
      }}>

        {/* Logo */}
        <div style={{
          padding: "22px 20px 16px", borderBottom: `1px solid ${C.border}`,
          background: "linear-gradient(180deg,rgba(52,208,88,0.06) 0%,transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginBottom: 3 }}>
            <span style={{ color: C.accent, fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", fontFamily: sans }}>
              EcoRoute
            </span>
            <span style={{
              background: C.accentDim, color: C.accent,
              fontSize: 9, fontWeight: 600, padding: "2px 6px",
              borderRadius: 4, letterSpacing: "0.08em", fontFamily: body,
            }}>BETA</span>
          </div>
          <div style={{ color: C.muted, fontSize: 11, fontFamily: body }}>Carbon-efficient school bus routing</div>
        </div>

        <div style={{ padding: "16px 16px 0", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* School */}
          <section>
            <SectionLabel>School Location</SectionLabel>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={schoolInput}
                onChange={e => onSchoolInputChange(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onGeocodeSchool()}
                placeholder="Enter school address…"
                style={inputStyle}
              />
              <button onClick={onGeocodeSchool} style={{
                ...btnSmall, background: C.accent, color: "#000", fontWeight: 700, border: "none",
              }}>Set</button>
            </div>
            {school && (
              <div style={{ color: C.accent, fontSize: 11, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <span>✓</span>
                <span>{school.lat.toFixed(4)}, {school.lon.toFixed(4)}</span>
              </div>
            )}
          </section>

          {/* Students */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <SectionLabel>Total Students</SectionLabel>
              <span style={{ color: C.text, fontSize: 14, fontWeight: 700, fontFamily: sans }}>{numStudents}</span>
            </div>
            <input
              type="range" min={1} max={540} value={numStudents}
              onChange={e => onNumStudentsChange(parseInt(e.target.value))}
              style={{ width: "100%", accentColor: C.accent, cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
              <span style={{ color: C.muted, fontSize: 10 }}>1</span>
              <span style={{ color: C.muted, fontSize: 10 }}>540</span>
            </div>
          </section>

          {/* Stops */}
          <section>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <SectionLabel>Student Stops</SectionLabel>
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  onClick={() => onAddingStopsChange(!addingStops)}
                  style={{
                    ...btnSmall,
                    background: addingStops ? C.accent : C.surfaceHi,
                    color: addingStops ? "#000" : C.text,
                    fontWeight: addingStops ? 700 : 500,
                    border: `1px solid ${addingStops ? C.accent : C.border}`,
                  }}
                >{addingStops ? "✓ Placing" : "+ Map"}</button>
                <button onClick={() => fileRef.current.click()} style={btnSmall}>CSV</button>
                <input ref={fileRef} type="file" accept=".csv" onChange={onCsv} style={{ display: "none" }} />
              </div>
            </div>
            {csvError && <div style={{ color: C.danger, fontSize: 11, marginBottom: 6 }}>{csvError}</div>}
            {addingStops && (
              <div style={{
                background: "rgba(52,208,88,0.07)", border: `1px solid ${C.accentDim}`,
                borderRadius: 7, padding: "7px 11px", fontSize: 11, color: C.accent, marginBottom: 8,
              }}>📍 Click the map to place stops</div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
              {stops.length === 0
                ? <div style={{ color: C.muted, fontSize: 12 }}>No stops added yet.</div>
                : stops.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
                    borderRadius: 7, padding: "5px 10px",
                  }}>
                    <span style={{ color: C.text, fontSize: 12 }}>
                      <span style={{ color: C.accent, fontWeight: 600 }}>#{i+1}</span>{" "}{s.label}
                    </span>
                    <button onClick={() => onRemoveStop(i)} style={{
                      background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 15,
                    }}>×</button>
                  </div>
                ))
              }
            </div>
            {stops.length > 0 && (
              <button onClick={onClearAllStops} style={{
                ...btnSmall, marginTop: 8,
                background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.3)",
                color: C.danger, width: "100%", textAlign: "center",
              }}>Clear all stops</button>
            )}
          </section>

          {/* CSV hint */}
          <div style={{
            background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "7px 11px", fontSize: 10, color: C.muted,
          }}>
            CSV: <span style={{ color: C.text, fontWeight: 500 }}>lat, lon, label</span> — one stop per row
          </div>

          {error && (
            <div style={{
              background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.3)",
              borderRadius: 7, padding: "9px 12px", color: C.danger, fontSize: 12,
            }}>{error}</div>
          )}

          {/* Compute */}
          <button
            onClick={onCompute} disabled={loading}
            style={{
              background: loading ? C.surfaceHi : "linear-gradient(135deg,#34d058 0%,#2ea043 100%)",
              color: loading ? C.muted : "#000",
              border: "none", borderRadius: 9, padding: "13px 0",
              fontFamily: sans, fontWeight: 700, fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer", letterSpacing: "0.04em",
              width: "100%", boxShadow: loading ? "none" : "0 4px 16px rgba(52,208,88,0.28)",
              transition: "all 0.2s",
            }}
          >{loading ? "⟳  Computing routes…" : "🚌  Compute Routes"}</button>

          {/* Results */}
          {result && result.buses && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 32 }}>

              {/* Fleet summary */}
              <div style={{
                background: "linear-gradient(135deg,rgba(52,208,88,0.08) 0%,rgba(52,208,88,0.03) 100%)",
                border: `1px solid ${C.accentDim}`, borderRadius: 10, padding: 14,
              }}>
                <div style={{ color: C.accent, fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", marginBottom: 10, fontFamily: sans }}>
                  FLEET SUMMARY
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <StatCard label="Buses" value={result.num_buses} unit="" highlight />
                  <StatCard label="Fleet CO₂" value={result.total_carbon_kg} unit="kg" highlight />
                  {result.carbon_saved_pct > 0 && (
                    <StatCard label="Saved" value={`${result.carbon_saved_pct}%`} unit="" highlight />
                  )}
                </div>
              </div>

              {/* Bus cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <SectionLabel>Bus Routes</SectionLabel>
                {result.buses.map((bus, i) => {
                  const color = BUS_COLORS[i % BUS_COLORS.length];
                  const isSelected = selectedBus === bus.bus_id;
                  const mode = busViewMode[bus.bus_id] ?? "carbon";
                  const stats = mode === "carbon" ? bus.carbon_route.stats : bus.fastest_route.stats;
                  const rawSaved = bus.fastest_route.stats.carbon_kg - bus.carbon_route.stats.carbon_kg;
                  const savedKg = Math.abs(rawSaved).toFixed(2);
                  const savedPct = bus.fastest_route.stats.carbon_kg > 0
                    ? Math.abs((rawSaved / bus.fastest_route.stats.carbon_kg) * 100).toFixed(1)
                    : "0.0";

                  return (
                    <div
                      key={bus.bus_id}
                      onClick={() => onSelectBus(isSelected ? null : bus.bus_id)}
                      style={{
                        background: isSelected ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                        border: `1px solid ${isSelected ? color : C.border}`,
                        borderRadius: 10, padding: "11px 13px", cursor: "pointer",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}99`, flexShrink: 0 }} />
                        <span style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: sans }}>Bus {bus.bus_id}</span>
                        <span style={{ color: C.muted, fontSize: 11, marginLeft: "auto" }}>
                          {bus.num_students} students · {bus.stop_indices.length} stops
                        </span>
                      </div>

                      {/* Toggle */}
                      <div style={{ display: "flex", gap: 3, marginBottom: 10, background: C.bg, borderRadius: 7, padding: 3 }}>
                        {[
                          { key: "carbon",  label: "🌿 Eco",     bg: C.accent, col: "#000" },
                          { key: "fastest", label: "⚡ Fastest", bg: C.warn,   col: "#000" },
                        ].map(({ key, label, bg, col }) => {
                          const active = mode === key;
                          return (
                            <button
                              key={key}
                              onClick={e => {
                                e.stopPropagation();
                                setBusViewMode(prev => ({ ...prev, [bus.bus_id]: key }));
                                if (onShowFastestChange) onShowFastestChange(key === "fastest");
                              }}
                              style={{
                                flex: 1, padding: "5px 0",
                                background: active ? bg : "none",
                                border: "none", borderRadius: 5, cursor: "pointer",
                                color: active ? col : C.muted,
                                fontFamily: body, fontSize: 11,
                                fontWeight: active ? 700 : 400,
                                transition: "all 0.15s",
                              }}
                            >{label}</button>
                          );
                        })}
                      </div>

                      {/* Stats */}
                      <div style={{ display: "flex", gap: 5 }}>
                        <StatCard label="CO₂" value={stats.carbon_kg} unit="kg" highlight={mode==="carbon"} warn={mode==="fastest"} />
                        <StatCard label="Dist" value={stats.distance_km} unit="km" />
                        <StatCard label="Time" value={stats.time_min} unit="min" />
                      </div>

                      {/* Savings pill */}
                      <div style={{
                        marginTop: 8, padding: "5px 9px", borderRadius: 6, fontSize: 10, fontFamily: body,
                        background: mode === "carbon" ? "rgba(52,208,88,0.07)" : "rgba(227,160,8,0.07)",
                        border: `1px solid ${mode === "carbon" ? C.accentDim : "rgba(227,160,8,0.25)"}`,
                        color: mode === "carbon" ? C.accent : C.warn,
                      }}>
                        {mode === "carbon"
                          ? `🌿 Saves ${savedKg} kg CO₂ (${savedPct}%) vs fastest`
                          : `⚡ Uses ${savedKg} kg more CO₂ than eco route`}
                      </div>

                      {/* Animate */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onSelectBus(bus.bus_id);
                          onAnimateBus({
                            coords: mode === "carbon" ? bus.carbon_route.coords : bus.fastest_route.coords,
                            color, key: Date.now(),
                          });
                        }}
                        style={{
                          marginTop: 8, width: "100%", background: "none",
                          border: `1px solid ${color}55`, borderRadius: 7,
                          color, fontFamily: body, fontSize: 11, fontWeight: 600,
                          padding: "6px 0", cursor: "pointer", letterSpacing: "0.04em",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${color}15`}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}
                      >▶ Animate {mode === "carbon" ? "Eco" : "Fastest"} Route</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Annual CO₂ savings badge ── failed attempt doesn't appear
      {result && result.carbon_saved_kg_year > 0 && (
        <div style={{
          position: "fixed", bottom: 24,
          left: isOpen ? W + 16 : 16,
          zIndex: 1002,
          transition: "left 0.28s cubic-bezier(.4,0,.2,1)",
          background: "linear-gradient(135deg,rgba(9,12,16,0.97) 0%,rgba(13,17,23,0.97) 100%)",
          border: `1px solid ${C.accentDim}`,
          borderRadius: 14, padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 12,
          boxShadow: "0 4px 24px rgba(52,208,88,0.15), 0 0 0 1px rgba(52,208,88,0.05)",
          backdropFilter: "blur(12px)",
          fontFamily: body,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(52,208,88,0.1)", border: `1px solid ${C.accentDim}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
          }}>🌍</div>
          <div>
            <div style={{ color: C.muted, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 2 }}>
              Estimated annual CO₂ savings
            </div>
            <div style={{ color: C.accent, fontSize: 23, fontWeight: 700, lineHeight: 1.1, fontFamily: sans, letterSpacing: "-0.02em" }}>
              {result.carbon_saved_kg_year >= 1000
                ? `${(result.carbon_saved_kg_year / 1000).toFixed(2)} t`
                : `${result.carbon_saved_kg_year} kg`}
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 400, marginLeft: 5, fontFamily: body }}>CO₂</span>
            </div>
            <div style={{ color: C.muted, fontSize: 9, marginTop: 2 }}>
              vs fastest routing · 180 school days × 2 trips
            </div>
          </div>
        </div>
      )} */}
    </>
  );
}

export default UI;
