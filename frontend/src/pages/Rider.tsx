import { useState, useCallback, useEffect, useRef } from 'react';
import './Rider.css';
import LocationSearch from '../components/map/LocationSearch';
import type { LocationData } from '../components/map/LocationSearch';
import RouteMap from '../components/map/RouteMap';
import RideItem, { type RideData } from '../components/rides/RideItem';
import Chat from '../components/chat/Chat';
import api from '../api/axios';

type Phase = 'idle' | 'pending' | 'matched';

export default function Rider() {
  const [activeTab, setActiveTab] = useState<'book' | 'history'>('book');
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [requests, setRequests] = useState<RideData[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedHistoryRide, setSelectedHistoryRide] = useState<RideData | null>(null);
  const [selfLocation, setSelfLocation] = useState<{lat: number, lng: number} | null>(null);
  const [activeDriverLocation, setActiveDriverLocation] = useState<{lat: number, lng: number} | null>(null);
  const [pickingMode, setPickingMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [isLocationEstimated, setIsLocationEstimated] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      return data.display_name;
    } catch (err) {
      console.error('Reverse geocode error:', err);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  const handleMapClick = async (latlng: { lat: number, lng: number }) => {
    if (!pickingMode) return;
    const address = await reverseGeocode(latlng.lat, latlng.lng);
    const loc = { address, lat: latlng.lat, lng: latlng.lng };
    if (pickingMode === 'pickup') setPickup(loc);
    else setDropoff(loc);
    setPickingMode(null);
  };

  const handleUseMyLocation = async (target: 'pickup' | 'dropoff') => {
    if (!selfLocation) return;
    const address = await reverseGeocode(selfLocation.lat, selfLocation.lng);
    const loc = { address, lat: selfLocation.lat, lng: selfLocation.lng };
    if (target === 'pickup') setPickup(loc);
    else setDropoff(loc);
  };

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/api/rides/my-requests');
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []); 

  const checkState = useCallback(async () => {
    try {
      const { data } = await api.get('/api/rides/my-request');
      if (data.phase === 'matched') {
        setPhase('matched');
        if (data.ride.driver_lat && data.ride.driver_lng) {
          setActiveDriverLocation({ lat: Number(data.ride.driver_lat), lng: Number(data.ride.driver_lng) });
        }
      } else if (data.phase === 'pending') {
        setPhase('pending');
        setActiveDriverLocation(null);
      } else {
        setPhase('idle');
        setActiveDriverLocation(null);
      }
      fetchHistory();
    } catch (err) {
      console.error('CheckState error:', err);
    }
  }, [fetchHistory]);

  // Self location tracking with IP fallback
  useEffect(() => {
    const fetchIPLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          setSelfLocation({ lat: data.latitude, lng: data.longitude });
          setIsLocationEstimated(true);
        }
      } catch (err) {
        console.error('IP location fallback failed:', err);
      }
    };

    if (!navigator.geolocation) {
      fetchIPLocation();
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => setSelfLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        console.error('Rider geolocation error:', err);
        fetchIPLocation();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Polling logic: if any request is active, keep polling
  useEffect(() => {
    const hasActive = requests.some(r => r.request_status === 'pending' || (r.request_status === 'accepted' && r.ride_status === 'ongoing'));
    if (hasActive || phase !== 'idle') {
      if (!pollRef.current) {
        pollRef.current = setInterval(checkState, 3000);
      }
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [requests, phase, checkState, stopPolling]);

  useEffect(() => {
    fetchHistory();
    const fetchVehicles = async () => {
      try {
        const { data } = await api.get('/api/rides/vehicle-types');
        setVehicleTypes(data);
        if (data.length > 0) setSelectedVehicleType(data[0].vehicle_type_id);
      } catch (err) {
        console.error('Failed to fetch vehicle types:', err);
      }
    };
    fetchVehicles();
  }, [fetchHistory]);

  const handleRouteCalculated = (dist: string, dur: string) => {
    setDistance(dist);
    setDuration(dur);
  };

  const handleRequestRide = async () => {
    if (!pickup || !dropoff) return;
    setStatusMsg('');
    try {
      await api.post('/api/rides/request', {
        pickup_address: pickup.address,
        dropoff_address: dropoff.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        vehicle_type_id: selectedVehicleType,
      });
      // Reset for next request
      setPhase('idle');
      setPickup(null);
      setDropoff(null);
      setDistance('');
      setDuration('');
      fetchHistory();
      setActiveTab('history');
    } catch (err: any) {
      setStatusMsg(err.response?.data?.message || 'Failed to request ride');
    }
  };

  const handleCancel = async () => {
    try {
      await api.delete('/api/rides/cancel');
      setPhase('idle');
      fetchHistory();
    } catch (_) {}
  };

  const running = requests.filter(r => r.request_status === 'pending' || (r.request_status === 'accepted' && r.ride_status === 'ongoing'));
  const completed = requests.filter(r => r.request_status === 'cancelled' || r.ride_status === 'completed' || r.ride_status === 'cancelled' || r.request_status === 'rejected');

  // Map logic: switch coordinates based on tab and selection
  const mapOrigin = activeTab === 'book' 
    ? (pickup ? { lat: pickup.lat, lng: pickup.lng } : null)
    : (selectedHistoryRide ? { lat: Number(selectedHistoryRide.pickup_lat), lng: Number(selectedHistoryRide.pickup_lng) } : null);

  const mapDestination = activeTab === 'book'
    ? (dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null)
    : (selectedHistoryRide ? { lat: Number(selectedHistoryRide.dropoff_lat), lng: Number(selectedHistoryRide.dropoff_lng) } : null);

  return (
    <div className="rider-container">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="rider-sidebar">
        
        <div className="tab-header">
          <button 
            className={`tab-btn ${activeTab === 'book' ? 'active' : ''}`}
            onClick={() => setActiveTab('book')}
          >
            Book a Ride
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
          >
            My Activity
          </button>
        </div>

        {activeTab === 'book' ? (
          <div className="tab-content">
            <h2 className="rider-title">Where to?</h2>

            {isLocationEstimated && (
              <div className="location-warning-banner animated fadeIn">
                ⚠️ Location sensor unavailable. Using network estimation.
              </div>
            )}

            <div className="search-group">
              <h4 className="search-label">Pickup</h4>
              <div className="search-row-wrapper">
                <LocationSearch 
                  placeholder="Enter pickup location" 
                  onSelect={setPickup} 
                  value={pickup?.address}
                />
                <div className="search-addons">
                  <button 
                    className={`addon-btn ${pickingMode === 'pickup' ? 'active' : ''}`}
                    onClick={() => setPickingMode(pickingMode === 'pickup' ? null : 'pickup')}
                    title="Pick on map"
                  >📍</button>
                  <button 
                    className="addon-btn"
                    onClick={() => handleUseMyLocation('pickup')}
                    title="Use my location"
                  >🏠</button>
                </div>
              </div>
            </div>

            <div className="search-group">
              <h4 className="search-label">Drop-off</h4>
              <div className="search-row-wrapper">
                <LocationSearch 
                  placeholder="Enter destination" 
                  onSelect={setDropoff} 
                  value={dropoff?.address}
                />
                <div className="search-addons">
                  <button 
                    className={`addon-btn ${pickingMode === 'dropoff' ? 'active' : ''}`}
                    onClick={() => setPickingMode(pickingMode === 'dropoff' ? null : 'dropoff')}
                    title="Pick on map"
                  >📍</button>
                  <button 
                    className="addon-btn"
                    onClick={() => handleUseMyLocation('dropoff')}
                    title="Use my location"
                  >🏠</button>
                </div>
              </div>
            </div>

            {pickingMode && (
              <div className="picking-indicator">
                🎯 Click on the map to set <strong>{pickingMode}</strong>...
              </div>
            )}

            {distance && duration && (
              <div className="estimate-card">
                <h4 className="estimate-title">Trip Estimate</h4>
                <div className="estimate-row">
                  <span className="estimate-label">Distance:</span>
                  <strong className="estimate-value">{distance}</strong>
                </div>
                <div className="estimate-row">
                  <span className="estimate-label">Duration:</span>
                  <strong className="estimate-value">{duration}</strong>
                </div>
                <div className="estimate-row" style={{ marginBottom: '20px', alignItems: 'center' }}>
                  <span className="estimate-label">Vehicle Type:</span>
                  <select 
                    value={selectedVehicleType}
                    onChange={(e) => setSelectedVehicleType(e.target.value)}
                    style={{ padding: '6px', borderRadius: '4px', flex: 1, marginLeft: '10px' }}
                  >
                    {vehicleTypes.map(v => (
                      <option key={v.vehicle_type_id} value={v.vehicle_type_id}>
                        {v.type_name} ({v.max_passengers} pax)
                      </option>
                    ))}
                  </select>
                </div>
                {statusMsg && <p className="error-msg">{statusMsg}</p>}
                <button
                  onClick={handleRequestRide}
                  className="confirm-btn"
                >
                  Confirm Ride
                </button>
              </div>
            )}

            {running.length > 0 && (
              <div className="active-count-badge">
                You have {running.length} active request{running.length > 1 ? 's' : ''}. 
                <button onClick={() => setActiveTab('history')}>View All</button>
              </div>
            )}
          </div>
        ) : (
          <div className="tab-content">
            <h2 className="rider-title">My Activity</h2>
            
            {selectedHistoryRide && (
              <div className="preview-card history-preview">
                <div className="preview-header">
                  <h4 className="preview-title">Past Trip Path</h4>
                  <button className="close-preview" onClick={() => setSelectedHistoryRide(null)}>✕</button>
                </div>
                <div className="preview-body">
                  <div className="preview-meta">
                    {selectedHistoryRide.distance && <span>{selectedHistoryRide.distance} km trip</span>}
                    {selectedHistoryRide.driver_name && <span>Driver: {selectedHistoryRide.driver_name}</span>}
                  </div>
                  {selectedHistoryRide.request_status === 'pending' && (
                    <button className="inline-cancel-btn" onClick={handleCancel}>Cancel This Request</button>
                  )}
                </div>
              </div>
            )}

            <div className="history-sections">
              <div className="history-section">
                <h3 className="section-title">Running</h3>
                <div className="request-list">
                  {running.length === 0 ? <p className="no-activity">No active requests.</p> : 
                    running.map(req => (
                      <RideItem 
                        key={req.request_id} 
                        ride={req} 
                        onClick={() => setSelectedHistoryRide(req)} 
                        active={selectedHistoryRide?.request_id === req.request_id}
                      />
                    ))
                  }
                </div>
              </div>

              <div className="history-section" style={{ marginTop: '24px' }}>
                <h3 className="section-title">Completed</h3>
                <div className="request-list">
                  {completed.length === 0 ? <p className="no-activity">No past trips.</p> : 
                    completed.map(req => (
                      <RideItem 
                        key={req.request_id} 
                        ride={req} 
                        onClick={() => setSelectedHistoryRide(req)}
                        active={selectedHistoryRide?.request_id === req.request_id}
                      />
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Map ─────────────────────────────────────────────── */}
      <div className="map-viewport">
        <RouteMap
          origin={mapOrigin}
          destination={mapDestination}
          userLocation={selfLocation}
          driverLocation={activeDriverLocation}
          onMapClick={handleMapClick}
          onRouteCalculated={handleRouteCalculated}
        />
      </div>

      {phase === 'matched' && running.find(r => r.ride_status === 'ongoing') && (
        <Chat 
          rideId={running.find(r => r.ride_status === 'ongoing')!.ride_id!} 
          theirName={running.find(r => r.ride_status === 'ongoing')!.driver_name || 'Driver'} 
        />
      )}

    </div>
  );
}

