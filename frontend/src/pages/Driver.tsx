import { useState, useEffect, useCallback, useRef } from 'react';
import './Driver.css';
import RouteMap from '../components/map/RouteMap';
import api from '../api/axios';

type Phase = 'searching' | 'active';

interface PendingRequest {
  request_id: number;
  rider_name: string;
  pickup_address: string;
  dropoff_address: string;
}

interface ActiveRide {
  ride_id: number;
  rider_name: string;
  rider_phone: string;
  pickup_address: string;
  dropoff_address: string;
}

export default function Driver() {
  const [phase, setPhase] = useState<Phase>('searching');
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [accepting, setAccepting] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
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
    return () => stopPolling();
  }, [pollActiveRide, pollPendingRequests, stopPolling]);

  const handleAccept = async (requestId: number) => {
    setAccepting(requestId);
    try {
      await api.post(`/api/rides/accept/${requestId}`);
      // Switch to active polling for the new ride
      stopPolling();
      const { data } = await api.get<ActiveRide | null>('/api/rides/my-ride');
      if (data) {
        setActiveRide(data);
        setPhase('active');
      }
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
      // Restart polling
      pollRef.current = setInterval(pollPendingRequests, 4000);
      pollPendingRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to complete ride');
    }
  };

  return (
    <div className="driver-container" style={{ display: 'flex', height: '100vh', flexDirection: 'row', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <div style={{ width: '380px', padding: '24px', backgroundColor: '#fff', boxShadow: '2px 0 10px rgba(0,0,0,0.06)', zIndex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ marginBottom: '4px' }}>Driver Dashboard</h2>

        {/* Active ride card */}
        {phase === 'active' && activeRide && (
          <div style={{ padding: '20px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 14px 0', color: '#389e0d' }}>🚗 Active Ride</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Rider:</span>
                <strong>{activeRide.rider_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666' }}>Phone:</span>
                <strong>{activeRide.rider_phone}</strong>
              </div>
              <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #eee' }} />
              <div>
                <span style={{ color: '#666' }}>Pickup:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>{activeRide.pickup_address.split(',')[0]}</p>
              </div>
              <div>
                <span style={{ color: '#666' }}>Drop-off:</span>
                <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>{activeRide.dropoff_address.split(',')[0]}</p>
              </div>
            </div>
            <button
              onClick={handleComplete}
              style={{ width: '100%', padding: '12px', backgroundColor: '#52c41a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px' }}
            >
              ✅ Complete Ride
            </button>
          </div>
        )}

        {/* Pending requests list */}
        {phase === 'searching' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#52c41a', animation: 'pulse 1.5s infinite' }} />
              <span style={{ color: '#555', fontSize: '14px' }}>Looking for ride requests...</span>
            </div>

            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#aaa' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                No requests nearby
              </div>
            ) : (
              requests.map(req => (
                <div key={req.request_id} style={{ padding: '16px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 10px 0', color: '#0050b3' }}>🧍 {req.rider_name}</h4>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}>
                    <span style={{ color: '#666' }}>From: </span>
                    <strong>{req.pickup_address.split(',')[0]}</strong>
                  </p>
                  <p style={{ margin: '0 0 14px 0', fontSize: '13px' }}>
                    <span style={{ color: '#666' }}>To: </span>
                    <strong>{req.dropoff_address.split(',')[0]}</strong>
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleAccept(req.request_id)}
                      disabled={accepting === req.request_id}
                      style={{ flex: 1, padding: '10px', backgroundColor: accepting === req.request_id ? '#aaa' : '#52c41a', color: '#fff', border: 'none', borderRadius: '4px', cursor: accepting === req.request_id ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      {accepting === req.request_id ? 'Accepting...' : 'Accept'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        <style>{`
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        `}</style>
      </div>

      {/* ── Map ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
        <RouteMap
          origin={activeRide ? null : null}
          destination={null}
        />
      </div>

    </div>
  );
}
