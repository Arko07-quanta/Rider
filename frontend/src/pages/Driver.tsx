import { useState, useEffect, useCallback, useRef } from 'react';
import './Driver.css';
import RouteMap from '../components/map/RouteMap';
import RideItem, { type RideData } from '../components/rides/RideItem';
import api from '../api/axios';

type Phase = 'searching' | 'active';

interface PendingRequest {
  request_id: number;
  rider_name: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  created_at: string;
}

interface ActiveRide {
  ride_id: number;
  rider_name: string;
  rider_phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
}

export default function Driver() {
  const [activeTab, setActiveTab] = useState<'find' | 'history'>('find');
  const [phase, setPhase] = useState<Phase>('searching');
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [history, setHistory] = useState<RideData[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<PendingRequest | null>(null);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [selfLocation, setSelfLocation] = useState<{lat: number, lng: number} | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const { data } = await api.get('/api/rides/activity');
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  const pollPendingRequests = useCallback(async () => {
    try {
      const { data } = await api.get<PendingRequest[]>('/api/rides/pending');
      setRequests(data);
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, []);

  const pollActiveRide = useCallback(async () => {
    try {
      const { data } = await api.get<ActiveRide | null>('/api/rides/my-ride');
      if (data) {
        setActiveRide(data);
        setPhase('active');
        setSelectedPreview(null);
        stopPolling();
      }
    } catch (err) {
      console.error('Active ride poll error:', err);
    }
  }, [stopPolling]);

  // On mount: check if there's already an active ride first, then start polling
  useEffect(() => {
    pollActiveRide().then(() => {
      pollRef.current = setInterval(pollPendingRequests, 4000);
      pollPendingRequests();
    });
    fetchHistory();
    return () => stopPolling();
  }, [pollActiveRide, pollPendingRequests, stopPolling, fetchHistory]);

  // Real-time location sync with IP fallback
  useEffect(() => {
    const fetchIPLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const lat = data.latitude;
          const lng = data.longitude;
          setSelfLocation({ lat, lng });
          await api.post('/api/rides/location', { lat, lng });
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
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setSelfLocation({ lat, lng });
        try {
          await api.post('/api/rides/location', { lat, lng });
        } catch (err) {
          console.error('Location sync error:', err);
        }
      },
      (err) => {
        console.error('Driver geolocation error:', err);
        fetchIPLocation();
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleAccept = async (requestId: number) => {
    setAccepting(requestId);
    try {
      await api.post(`/api/rides/accept/${requestId}`);
      stopPolling();
      const { data } = await api.get<ActiveRide | null>('/api/rides/my-ride');
      if (data) {
        setActiveRide(data);
        setPhase('active');
        setSelectedPreview(null);
      }
      fetchHistory();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to accept ride');
    } finally {
      setAccepting(null);
    }
  };

  const handleComplete = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/api/rides/complete/${activeRide.ride_id}`);
      setActiveRide(null);
      setPhase('searching');
      setRequests([]);
      fetchHistory();
      // Restart polling
      pollRef.current = setInterval(pollPendingRequests, 4000);
      pollPendingRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete ride');
    }
  };

  const handleCancelRide = async () => {
    if (!activeRide || !window.confirm('Are you sure you want to cancel this ride?')) return;
    try {
      await api.post(`/api/rides/driver-cancel/${activeRide.ride_id}`);
      setActiveRide(null);
      setPhase('searching');
      setRequests([]);
      fetchHistory();
      // Restart polling
      pollRef.current = setInterval(pollPendingRequests, 4000);
      pollPendingRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to cancel ride');
    }
  };

  const mapOrigin = activeRide 
    ? { lat: Number(activeRide.pickup_lat), lng: Number(activeRide.pickup_lng) } 
    : selectedPreview 
      ? { lat: Number(selectedPreview.pickup_lat), lng: Number(selectedPreview.pickup_lng) } 
      : null;

  const mapDestination = activeRide 
    ? { lat: Number(activeRide.dropoff_lat), lng: Number(activeRide.dropoff_lng) } 
    : selectedPreview 
      ? { lat: Number(selectedPreview.dropoff_lat), lng: Number(selectedPreview.dropoff_lng) } 
      : null;

  return (
    <div className="driver-container">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div className="driver-sidebar">
        
        <div className="tab-header">
          <button 
            className={`tab-btn ${activeTab === 'find' ? 'active' : ''}`}
            onClick={() => setActiveTab('find')}
          >
            Find Rides
          </button>
          <button 
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
          >
            My Activity
          </button>
        </div>

        {activeTab === 'find' ? (
          <div className="tab-content">
            {phase === 'active' && activeRide ? (
              <div className="active-ride-card">
                <h4 className="active-ride-header">🚗 Active Ride</h4>
                <div className="active-ride-details">
                  <div className="active-ride-row">
                    <span className="active-ride-label">Rider:</span>
                    <strong className="active-ride-value">{activeRide.rider_name}</strong>
                  </div>
                  <div className="active-ride-row">
                    <span className="active-ride-label">Phone:</span>
                    <strong className="active-ride-value">{activeRide.rider_phone}</strong>
                  </div>
                  <hr className="active-ride-separator" />
                  <div className="active-ride-address-block">
                    <span className="active-ride-address-label">Pickup:</span>
                    <p className="active-ride-address-value">{activeRide.pickup_address.split(',')[0]}</p>
                  </div>
                  <div className="active-ride-address-block">
                    <span className="active-ride-address-label">Drop-off:</span>
                    <p className="active-ride-address-value">{activeRide.dropoff_address.split(',')[0]}</p>
                  </div>
                </div>
                <div className="active-ride-actions">
                  <button
                    onClick={handleComplete}
                    className="complete-btn"
                  >
                    ✅ Complete Ride
                  </button>
                  <button
                    onClick={handleCancelRide}
                    className="cancel-ride-btn"
                  >
                    ✖ Cancel Ride
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="searching-indicator">
                  <div className="status-dot" />
                  <span className="searching-text">Looking for ride requests...</span>
                </div>

                {selectedPreview && (
                  <div className="preview-card">
                    <div className="preview-header">
                      <h4 className="preview-title">Previewing Route</h4>
                      <button className="close-preview" onClick={() => setSelectedPreview(null)}>✕</button>
                    </div>
                    <div className="preview-body">
                      <p><strong>Rider:</strong> {selectedPreview.rider_name}</p>
                      <button 
                        className="accept-btn full-width"
                        onClick={() => handleAccept(selectedPreview.request_id)}
                        disabled={accepting === selectedPreview.request_id}
                      >
                        {accepting === selectedPreview.request_id ? 'Accepting...' : 'Accept This Ride'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="request-list">
                  {requests.length === 0 ? (
                    <div className="no-requests">
                      <div className="no-requests-icon">🔍</div>
                      No requests nearby
                    </div>
                  ) : (
                    requests.map(req => (
                      <RideItem 
                        key={req.request_id} 
                        ride={{
                          request_id: req.request_id,
                          request_status: 'pending',
                          ride_status: null,
                          created_at: req.created_at,
                          pickup_address: req.pickup_address,
                          dropoff_address: req.dropoff_address,
                          rider_name: req.rider_name
                        }} 
                        showRider
                        onClick={() => setSelectedPreview(req)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="tab-content">
            <h2 className="driver-title">Past Earnings</h2>
            <div className="request-list">
              {history.length === 0 ? (
                <div className="no-activity">No completed rides yet.</div>
              ) : (
                history.map(ride => (
                  <RideItem 
                    key={ride.ride_id} 
                    ride={ride} 
                    showRider
                    onClick={(r) => alert(`Ride #${r.ride_id} with ${r.rider_name}\nStatus: ${r.ride_status}`)} 
                  />
                ))
              )}
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
        />
      </div>

    </div>
  );
}
