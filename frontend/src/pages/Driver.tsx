import { useState, useEffect, useCallback, useRef } from 'react';
import './Driver.css';
import { io, Socket } from 'socket.io-client';
import RouteMap from '../components/map/RouteMap';
import RideItem, { type RideData } from '../components/rides/RideItem';
import Chat from '../components/chat/Chat';
import api from '../api/axios';
import ReviewModal from '../components/reviews/ReviewModal';

type Phase = 'searching' | 'active';

interface PendingRequest {
  request_id: number;
  rider_id: number;
  rider_name: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  created_at: string;
  distance: number;
  fare: number;
  duration: number;
}

interface Transaction {
  transaction_id: string;
  type: 'credit' | 'debit';
  amount: number;
  status: string;
  timestamp: string;
  payment_method: string;
}

interface ActiveRide {
  ride_id: number;
  rider_id: number;
  rider_name: string;
  rider_phone: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance: number;
  fare: number;
  duration: number;
  request_id: number;
}

export default function Driver() {
  const [activeTab, setActiveTab] = useState<'find' | 'history' | 'earnings'>('find');
  const [phase, setPhase] = useState<Phase>('searching');
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [history, setHistory] = useState<RideData[]>([]);
  const [wallet, setWallet] = useState<{balance: number, currency: string, transactions: Transaction[]} | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<PendingRequest | null>(null);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [selfLocation, setSelfLocation] = useState<{lat: number, lng: number} | null>(null);
  const [viewingRiderId, setViewingRiderId] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
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
      } else {
        if (phase !== 'searching') {
          setPhase('searching');
          setActiveRide(null);
          if (!pollRef.current) {
            pollRef.current = setInterval(pollPendingRequests, 4000);
          }
        }
      }
    } catch (err) {
      console.error('Active ride poll error:', err);
    }
  }, [stopPolling]);

  const fetchWallet = useCallback(async () => {
    try {
      const { data } = await api.get('/api/wallet');
      setWallet(data);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  }, []);

  useEffect(() => {
    socketRef.current = io(api.defaults.baseURL || '', {
      auth: { token: localStorage.getItem('token') }
    });

    pollActiveRide().then(() => {
      pollRef.current = setInterval(pollPendingRequests, 4000);
      pollPendingRequests();
    });
    fetchHistory();
    fetchWallet();

    return () => {
      stopPolling();
      socketRef.current?.disconnect();
    };
  }, [pollActiveRide, pollPendingRequests, stopPolling, fetchHistory, fetchWallet]);

  useEffect(() => {
    if (activeRide?.request_id && socketRef.current) {
      const socket = socketRef.current;
      socket.emit('join_request', activeRide.request_id);

      socket.on('ride_status_update', (data: any) => {
        if (data.status === 'cancelled' || data.status === 'searching') {
          setPhase('searching');
          setActiveRide(null);
          fetchHistory();
          if (!pollRef.current) {
            pollRef.current = setInterval(pollPendingRequests, 4000);
          }
        }
      });

      return () => {
        socket.off('ride_status_update');
      };
    }
  }, [activeRide?.request_id, fetchHistory, pollPendingRequests]);

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
          <button
            className={`tab-btn ${activeTab === 'earnings' ? 'active' : ''}`}
            onClick={() => { setActiveTab('earnings'); fetchWallet(); }}
          >
            Earnings
          </button>
        </div>

        {activeTab === 'earnings' ? (
          <div className="tab-content">
            <h2 className="driver-title">My Earnings</h2>
            {wallet && (
              <div className="earnings-card">
                <div className="earnings-label">Available Balance</div>
                <h3 className="earnings-value">
                  {wallet.currency === 'USD' ? '$' : wallet.currency}
                  {Number(wallet.balance).toFixed(2)}
                </h3>
              </div>
            )}
            
            <div className="history-section">
               <h3 className="section-title">Recent Payouts</h3>
               {!wallet || wallet.transactions.length === 0 ? (
                 <p className="no-activity">No earnings yet. Complete rides to earn!</p>
               ) : (
                 <div className="transaction-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {wallet.transactions.map(tx => (
                     <div key={tx.transaction_id} className="tx-item">
                        <div className="tx-info">
                          <strong className="tx-type">
                            {tx.type === 'credit' ? '🟢 Ride Payment' : '🔴 Deduction'}
                          </strong>
                          <span className="tx-date">
                            {new Date(tx.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className={`tx-amount ${tx.type === 'credit' ? 'credit' : 'debit'}`}>
                          {tx.type === 'credit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                        </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        ) : activeTab === 'find' ? (
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
                  <hr className="active-ride-separator" />
                  <div className="active-ride-stats" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
                    <div className="stat-card" style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px' }}>
                      <span className="stat-label" style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Distance</span>
                      <strong className="stat-value" style={{ fontSize: '1.2em', color: '#fff' }}>{activeRide.distance} km</strong>
                    </div>
                    <div className="stat-card" style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px' }}>
                      <span className="stat-label" style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Time</span>
                      <strong className="stat-value" style={{ fontSize: '1.2em', color: '#fff' }}>{activeRide.duration} min</strong>
                    </div>
                    <div className="stat-card" style={{ flex: 1, textAlign: 'center', background: 'rgba(34,197,94,0.1)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(34,197,94,0.2)' }}>
                      <span className="stat-label" style={{ fontSize: '0.85em', color: '#22c55e', display: 'block', marginBottom: '4px' }}>Your Payout</span>
                      <strong className="stat-value" style={{ fontSize: '1.2em', color: '#22c55e' }}>${Number(activeRide.fare).toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
                <div className="active-ride-actions">
                  <button
                    onClick={handleComplete}
                    className="btn-primary"
                    style={{ width: '100%', marginBottom: '12px' }}
                  >
                    ✅ Complete Ride
                  </button>
                  <button
                    onClick={handleCancelRide}
                    className="btn-secondary"
                    style={{ width: '100%', color: '#ef4444', borderColor: '#ef4444' }}
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
                      <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span><strong>Rider:</strong> {selectedPreview.rider_name}</span>
                        <button 
                          className="btn-profile-preview"
                          onClick={() => setViewingRiderId(selectedPreview.rider_id)}
                          style={{ padding: '4px 10px', fontSize: '0.8em', borderRadius: '15px' }}
                        >
                          👤 View Reviews
                        </button>
                      </p>
                      <div className="preview-stats" style={{ display: 'flex', gap: '15px', margin: '15px 0', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <span style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Distance:</span>
                          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.2em' }}>{selectedPreview.distance} km</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <span style={{ fontSize: '0.85em', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Time:</span>
                          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.2em' }}>{selectedPreview.duration} min</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <span style={{ fontSize: '0.85em', color: '#22c55e', display: 'block', marginBottom: '4px' }}>Your Payout:</span>
                          <div style={{ fontWeight: 'bold', color: '#22c55e', fontSize: '1.4em' }}>${Number(selectedPreview.fare).toFixed(2)}</div>
                        </div>
                      </div>
                      <button
                        className="btn-primary"
                        style={{ width: '100%', marginTop: '12px' }}
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
                          rider_name: req.rider_name,
                          distance: req.distance,
                          duration: req.duration,
                          fare: Number(req.fare)
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

      <div className="map-viewport">
        <RouteMap
          origin={mapOrigin}
          destination={mapDestination}
          userLocation={selfLocation}
        />
      </div>

      {phase === 'active' && activeRide && (
        <Chat
          rideId={activeRide.ride_id}
          theirName={activeRide.rider_name}
          theirUserId={activeRide.rider_id}
          rideStatus="ongoing"
        />
      )}

      {viewingRiderId && (
        <ReviewModal 
          userId={viewingRiderId} 
          onClose={() => setViewingRiderId(null)}
        />
      )}
    </div>
  );
}
