import MapView from "./MapView"
import UI from "./ui"
import { useEffect, useState } from "react";

function App() {
  return (
    
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <MapView />
      <div style={{ position: "absolute", top: "20px", left: "20px", zIndex: 1000 }}>
        <UI />
      </div>
    </div>
  )
}

export default App