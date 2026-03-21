import { useState, useCallback, useEffect, useRef } from 'react';
import './Rider.css';
import LocationSearch from '../components/map/LocationSearch';
import type { LocationData } from '../components/map/LocationSearch';
import RouteMap from '../components/map/RouteMap';
import RideItem, { type RideData } from '../components/rides/RideItem';
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

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
      } else if (data.phase === 'pending') {
        setPhase('pending');
      } else {
        setPhase('idle');
      }
      fetchHistory();
    } catch (err) {
      console.error('CheckState error:', err);
    }
  }, [fetchHistory]);

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

            <div className="search-group">
              <h4 className="search-label">Pickup</h4>
              <LocationSearch placeholder="Enter pickup location" onSelect={setPickup} />
            </div>

            <div className="search-group">
              <h4 className="search-label">Drop-off</h4>
              <LocationSearch placeholder="Enter destination" onSelect={setDropoff} />
            </div>

            {distance && duration && (
              <div className="estimate-card">
                <h4 className="estimate-title">Trip Estimate</h4>
                <div className="estimate-row">
                  <span className="estimate-label">Distance:</span>
                  <strong className="estimate-value">{distance}</strong>
                </div>
                <div className="estimate-row" style={{ marginBottom: '20px' }}>
                  <span className="estimate-label">Duration:</span>
                  <strong className="estimate-value">{duration}</strong>
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

            {/* If the current interaction is pending, show a small status chip */}
            {running.length > 0 && (
              <div className="active-count-badge">
                You have {running.length} active request{running.length > 1 ? 's' : ''}. 
                <button onClick={() => setActiveTab('history')}>View All</button>
              </div>
            )}
          </div>
        ) : (
          <div className="tab-content">
            
            {selectedHistoryRide && (
              <div className="preview-card history-preview">
                <div className="preview-header">
                  <h4 className="preview-title">
                    {selectedHistoryRide.ride_status === 'completed' ? '🏁 Past Trip Path' : '⏳ Action Required'}
                  </h4>
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
                  {running.length === 0 ? (
                    <div className="no-activity">No active requests.</div>
                  ) : (
                    running.map(req => (
                      <RideItem 
                        key={req.request_id} 
                        ride={req} 
                        onClick={() => setSelectedHistoryRide(req)} 
                        active={selectedHistoryRide?.request_id === req.request_id}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="history-section" style={{ marginTop: '24px' }}>
                <h3 className="section-title">Completed</h3>
                <div className="request-list">
                  {completed.length === 0 ? (
                    <div className="no-activity">No past trips.</div>
                  ) : (
                    completed.map(req => (
                      <RideItem 
                        key={req.request_id} 
                        ride={req} 
                        onClick={() => setSelectedHistoryRide(req)}
                        active={selectedHistoryRide?.request_id === req.request_id}
                      />
                    ))
                  )}
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
          onRouteCalculated={handleRouteCalculated}
        />
      </div>

    </div>
  );
}

