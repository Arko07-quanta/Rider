import { useState, useEffect, useCallback, useRef } from 'react';
import './Driver.css';
import RouteMap from '../components/map/RouteMap';
import RideItem, { type RideData } from '../components/rides/RideItem';
import Chat from '../components/chat/Chat';
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

  const fetchWallet = useCallback(async () => {
    try {
      const { data } = await api.get('/api/wallet');
      setWallet(data);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  }, []);

  useEffect(() => {
    pollActiveRide().then(() => {
      pollRef.current = setInterval(pollPendingRequests, 4000);
      pollPendingRequests();
    });
    fetchHistory();
    fetchWallet();
    return () => stopPolling();
  }, [pollActiveRide, pollPendingRequests, stopPolling, fetchHistory, fetchWallet]);

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
                    <div className="stat-item">
                      <span className="stat-label" style={{ fontSize: '0.8em', color: '#666' }}>Distance</span>
                      <strong className="stat-value" style={{ display: 'block' }}>{Number(activeRide.distance).toFixed(1)} km</strong>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label" style={{ fontSize: '0.8em', color: '#666' }}>Time</span>
                      <strong className="stat-value" style={{ display: 'block' }}>{Math.round(activeRide.duration)} mins</strong>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label" style={{ fontSize: '0.8em', color: '#666' }}>Your Payout</span>
                      <strong className="stat-value" style={{ display: 'block', color: '#16a34a' }}>${(Number(activeRide.fare) * 0.8).toFixed(2)}</strong>
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
                      <p><strong>Rider:</strong> {selectedPreview.rider_name}</p>
                      <div className="preview-stats" style={{ display: 'flex', gap: '15px', margin: '10px 0', padding: '10px', background: '#f8fafc', borderRadius: '6px' }}>
                        <div>
                          <span style={{ fontSize: '0.8em', color: '#64748b' }}>Distance:</span>
                          <div style={{ fontWeight: 'bold' }}>{Number(selectedPreview.distance).toFixed(1)} km</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8em', color: '#64748b' }}>Time:</span>
                          <div style={{ fontWeight: 'bold' }}>{Math.round(selectedPreview.duration)} mins</div>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.8em', color: '#64748b' }}>Your Payout:</span>
                          <div style={{ fontWeight: 'bold', color: '#16a34a' }}>${(Number(selectedPreview.fare) * 0.8).toFixed(2)}</div>
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
                          fare: Number(req.fare) * 0.8
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
        <Chat rideId={activeRide.ride_id} theirName={activeRide.rider_name} />
      )}

    </div>
  );
}
