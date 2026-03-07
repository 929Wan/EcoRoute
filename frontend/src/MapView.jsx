import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";

function MapView() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:5000/nodes")
      .then(res => res.json())
      .then(data => setNodes(data.slice(0, 500))); // limit for performance
  }, []);

  const center = [36.0606, -81.9021]; // Avery County

  return (
    <MapContainer center={center} zoom={10} style={{ height: "100vh", width: "100%" }}>
      
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {nodes.map((node, i) => (
        <Marker key={i} position={[node.y, node.x]}>
          <Popup>
            Elevation: {node.elevation}
          </Popup>
        </Marker>
      ))}

    </MapContainer>
  );
}

export default MapView;