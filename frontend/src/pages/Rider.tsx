import { useState, useCallback, useEffect, useRef } from 'react';
import './Rider.css';
import LocationSearch from '../components/map/LocationSearch';
import type { LocationData } from '../components/map/LocationSearch';
import RouteMap from '../components/map/RouteMap';
import api from '../api/axios';

type Phase = 'idle' | 'pending' | 'matched';

interface ActiveRide {
  ride_id: number;
  driver_name: string;
  driver_phone: string;
  pickup_address: string;
  dropoff_address: string;
}

export default function Rider() {
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get('/api/rides/my-request');
        if (data.phase === 'matched') {
          setPhase('matched');
          setActiveRide(data.ride);
          stopPolling();
        } else if (data.phase === 'idle') {
          // Request was cancelled externally
          setPhase('idle');
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleRouteCalculated = useCallback((distText: string, durText: string) => {
    setDistance(distText);
    setDuration(durText);
  }, []);

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
      setPhase('pending');
      startPolling();
    } catch (err: any) {
      setStatusMsg(err.response?.data?.message || 'Failed to request ride');
    }
  };

  const handleCancel = async () => {
    try {
      await api.delete('/api/rides/cancel');
    } catch (_) {}
    stopPolling();
    setPhase('idle');
  };

  return (
    <div className="rider-container" style={{ display: 'flex', height: '100vh', flexDirection: 'row', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div style={{ width: '380px', padding: '24px', backgroundColor: '#fff', boxShadow: '2px 0 10px rgba(0,0,0,0.06)', zIndex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0px' }}>
        <h2 style={{ marginBottom: '20px' }}>Where to?</h2>

        {phase === 'idle' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px', color: '#555' }}>Pickup</h4>
              <LocationSearch placeholder="Enter pickup location" onSelect={setPickup} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ marginBottom: '8px', color: '#555' }}>Drop-off</h4>
              <LocationSearch placeholder="Enter destination" onSelect={setDropoff} />
            </div>

            {distance && duration && (
              <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
                <h4 style={{ margin: '0 0 15px 0', borderBottom: '1px solid #ddd', paddingBottom: '10px' }}>Trip Estimate</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ color: '#666' }}>Distance:</span>
                  <strong>{distance}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <span style={{ color: '#666' }}>Duration:</span>
                  <strong>{duration}</strong>
                </div>
                {statusMsg && <p style={{ color: 'red', marginBottom: '8px', fontSize: '14px' }}>{statusMsg}</p>}
                <button
                  onClick={handleRequestRide}
                  style={{ width: '100%', padding: '14px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}
                >
                  Confirm Ride
                </button>
              </div>
            )}
          </>
        )}

        {phase === 'pending' && (
          <div style={{ padding: '24px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <h3 style={{ margin: '0 0 8px 0' }}>Looking for a driver...</h3>
            <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
              From: <strong>{pickup?.address.split(',')[0]}</strong><br />
              To: <strong>{dropoff?.address.split(',')[0]}</strong>
            </p>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', border: '4px solid #e0e0e0', borderTopColor: '#1890ff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
            </div>
            <button
              onClick={handleCancel}
              style={{ padding: '10px 24px', backgroundColor: '#fff', border: '1px solid #ff4d4f', color: '#ff4d4f', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Cancel Request
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {phase === 'matched' && activeRide && (
          <div style={{ padding: '24px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px', textAlign: 'center' }}>🚗</div>
            <h3 style={{ margin: '0 0 16px 0', textAlign: 'center', color: '#389e0d' }}>Driver En Route!</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Driver:</span>
                <strong>{activeRide.driver_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Phone:</span>
                <strong>{activeRide.driver_phone}</strong>
              </div>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #eee' }} />
              <div>
                <span style={{ color: '#666' }}>Pickup:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>{activeRide.pickup_address.split(',')[0]}</p>
              </div>
              <div>
                <span style={{ color: '#666' }}>Drop-off:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>{activeRide.dropoff_address.split(',')[0]}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Map ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
        <RouteMap
          origin={pickup ? { lat: pickup.lat, lng: pickup.lng } : null}
          destination={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null}
          onRouteCalculated={handleRouteCalculated}
        />
      </div>

    </div>
  );
}
