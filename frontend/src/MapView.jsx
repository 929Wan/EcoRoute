import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useEffect, useState } from "react";

function MapView() {
  const [nodes, setNodes] = useState([]);
  const [bounds, setBounds] = useState(null);

  useEffect(() => {
    fetch("http://10.180.0.161:6001/nodes")
      .then(res => res.json())
      .then(data => {
        setNodes(data.slice(0, 500)); // limit for performance

        // calculate bounding box
        const lats = data.map(n => n.y);
        const lngs = data.map(n => n.x);
        const southWest = [Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01];
        const northEast = [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01];
        setBounds([southWest, northEast]);
      });
  }, []);

  // don't render map until bounds are ready
  if (!bounds) return <div>Loading map...</div>;

  // initial center is middle of bounds
  const center = [
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2
  ];

  return (
    <MapContainer
      center={center}
      zoom={11}
      minZoom={10}
      maxZoom={15}
      maxBounds={bounds}           // restrict panning to county
      maxBoundsViscosity={1.0}    // prevents any dragging outside bounds
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {nodes.map((node, i) => (
        <Marker key={i} position={[node.y, node.x]}>
          <Popup>Elevation: {node.elevation}</Popup>
        </Marker>
      ))}

    </MapContainer>
  );
}

export default MapView;