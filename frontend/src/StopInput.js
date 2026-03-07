// frontend/src/components/StopInput.js
import React, { useState } from 'react';

function StopInput({ onSubmit }) {
  const [stops, setStops] = useState([
    { id: 1, name: 'Stop A', lat: 40.1234, lon: -75.1234, students: 0 }
  ]);

  const addStop = () => {
    const newStop = {
      id: Math.max(...stops.map(s => s.id)) + 1,
      name: '',
      lat: 40.1234,
      lon: -75.1234,
      students: 0
    };
    setStops([...stops, newStop]);
  };

  const updateStop = (id, field, value) => {
    setStops(
      stops.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      )
    );
  };

  const removeStop = (id) => {
    setStops(stops.filter(s => s.id !== id));
  };

  const handleSubmit = () => {
    const stopsDict = {};
    stops.forEach(s => {
      stopsDict[`stop_${s.id}`] = {
        lat: parseFloat(s.lat),
        lon: parseFloat(s.lon),
        students: parseInt(s.students),
        name: s.name
      };
    });
    onSubmit(stopsDict);
  };

  return (
    <div className="stop-input-panel">
      <h2>School Bus Stops</h2>
      {stops.map(stop => (
        <div key={stop.id} className="stop-form">
          <input
            placeholder="Stop Name"
            value={stop.name}
            onChange={e => updateStop(stop.id, 'name', e.target.value)}
          />
          <input
            type="number"
            placeholder="Latitude"
            value={stop.lat}
            onChange={e => updateStop(stop.id, 'lat', e.target.value)}
          />
          <input
            type="number"
            placeholder="Longitude"
            value={stop.lon}
            onChange={e => updateStop(stop.id, 'lon', e.target.value)}
          />
          <input
            type="number"
            placeholder="Students"
            min="0"
            max="72"
            value={stop.students}
            onChange={e => updateStop(stop.id, 'students', e.target.value)}
          />
          <button onClick={() => removeStop(stop.id)}>Remove</button>
        </div>
      ))}
      <button onClick={addStop}>+ Add Stop</button>
      <button onClick={handleSubmit} className="optimize-btn">
        Optimize Routes
      </button>
    </div>
  );
}

export default StopInput;