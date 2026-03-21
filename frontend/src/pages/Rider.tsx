import { useState, useCallback } from 'react';
import './Rider.css';
import LocationSearch from '../components/map/LocationSearch';
import type { LocationData } from '../components/map/LocationSearch';
import RouteMap from '../components/map/RouteMap';

export default function Rider() {

  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  const handleRouteCalculated = useCallback((distText: string, durText: string) => {
    setDistance(distText);
    setDuration(durText);
  }, []);

  const handleRequestRide = () => {
    if(!pickup || !dropoff) return;
    alert(`Requesting ride from ${pickup.address} to ${dropoff.address}`);
    // Will hook into backend API 
  };

  return (
    <div className="rider-container" style={{ display: 'flex', height: '100vh', flexDirection: 'row', overflow: 'hidden' }}>
      
      <div className="rider-sidebar" style={{ width: '380px', padding: '24px', backgroundColor: '#ffffff', boxShadow: '2px 0 10px rgba(0,0,0,0.05)', zIndex: 1, overflowY: "auto" }}>
        <h2 style={{ marginBottom: '24px' }}>Where to?</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '8px', color: '#555' }}>Pickup</h4>
          <LocationSearch 
            placeholder="Enter pickup location" 
            onSelect={(loc) => setPickup(loc)} 
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '8px', color: '#555' }}>Drop-off</h4>
          <LocationSearch 
            placeholder="Enter destination" 
            onSelect={(loc) => setDropoff(loc)} 
          />
        </div>

        {distance && duration && (
          <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Trip Estimate</h4>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={{ color: "#666" }}>Distance:</span>
              <strong>{distance}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <span style={{ color: "#666" }}>Duration:</span>
              <strong>{duration}</strong>
            </div>
            
            <button 
              onClick={handleRequestRide}
              style={{ width: '100%', padding: '14px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
            >
              Confirm Ride
            </button>
          </div>
        )}
      </div>

      <div className="rider-map" style={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
        <RouteMap 
          origin={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
          destination={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null}
          onRouteCalculated={handleRouteCalculated}
        />
      </div>

    </div>
  );
}
