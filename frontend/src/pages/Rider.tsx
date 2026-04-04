import { useState, useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import './Rider.css';
import LocationSearch from '../components/map/LocationSearch';
import type { LocationData } from '../components/map/LocationSearch';
import RouteMap from '../components/map/RouteMap';
import RideItem, { type RideData } from '../components/rides/RideItem';
import Chat from '../components/chat/Chat';
import api from '../api/axios';
import ReviewModal from '../components/reviews/ReviewModal';

type Phase = 'idle' | 'pending' | 'matched';

interface Transaction {
  transaction_id: string;
  type: 'credit' | 'debit';
  amount: number;
  status: string;
  timestamp: string;
  payment_method: string;
}

export default function Rider() {
  const [activeTab, setActiveTab] = useState<'book' | 'history' | 'wallet'>('book');
  const [wallet, setWallet] = useState<{balance: number, currency: string, transactions: Transaction[]} | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [pickup, setPickup] = useState<LocationData | null>(null);
  const [dropoff, setDropoff] = useState<LocationData | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [requests, setRequests] = useState<RideData[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedHistoryRide, setSelectedHistoryRide] = useState<RideData | null>(null);
  const [selfLocation, setSelfLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [activeDriverLocation, setActiveDriverLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [pickingMode, setPickingMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [isLocationEstimated, setIsLocationEstimated] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<any[]>([]);
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>('');
  const [shareCopied, setShareCopied] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [matchNotification, setMatchNotification] = useState<{ name: string, rideId: number } | null>(null);
  const [reviewRideData, setReviewRideData] = useState<{userId: number, rideId: number} | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selfLocationRef = useRef<{ lat: number, lng: number } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const requestsRef = useRef<any[]>([]);
  const lastHandledReviewRideId = useRef<number | null>(null);
  const newRequestRef = useRef<number | null>(null);

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
      return data;
    } catch (err) {
      console.error('Failed to fetch history:', err);
      return [];
    }
  }, []);

  const running = requests.filter(r => r.request_status === 'pending' || (r.request_status === 'accepted' && r.ride_status === 'ongoing'));
  const completed = requests.filter(r => r.request_status === 'cancelled' || r.ride_status === 'completed' || r.ride_status === 'cancelled' || r.request_status === 'rejected');
  const phase: Phase = running.length > 0 ? (running.some(r => r.ride_status === 'ongoing') ? 'matched' : 'pending') : 'idle';

  useEffect(() => {
    if (selectedHistoryRide) {
      const updatedMatch = requests.find(r => r.request_id === selectedHistoryRide.request_id);
      if (updatedMatch) {
         if (selectedHistoryRide.ride_status === 'ongoing' && (updatedMatch.ride_status === 'completed' || updatedMatch.ride_status === 'cancelled')) {
             setSelectedHistoryRide(null); 
         } else if (
           updatedMatch.ride_status !== selectedHistoryRide.ride_status || 
           updatedMatch.request_status !== selectedHistoryRide.request_status
         ) {
           setSelectedHistoryRide(updatedMatch);
         }
      }
    }
  }, [requests, selectedHistoryRide]);

  const checkState = useCallback(async () => {
    try {
      const { data } = await api.get('/api/rides/my-request');
      if (data.phase === 'matched') {
        if (data.ride.driver_lat && data.ride.driver_lng) {
          setActiveDriverLocation({ lat: Number(data.ride.driver_lat), lng: Number(data.ride.driver_lng) });
        }
      } else {
        setActiveDriverLocation(null);
      }
      fetchHistory();
    } catch (err) {
      console.error('CheckState error:', err);
    }
  }, [fetchHistory]);

  useEffect(() => { selfLocationRef.current = selfLocation; }, [selfLocation]);

  useEffect(() => { requestsRef.current = requests; }, [requests]);

  const syncRooms = useCallback((socket: Socket) => {
    if (!socket || !socket.connected) return;
    const reqs = requestsRef.current;
    reqs.forEach(req => {
      socket.emit("join_request", req.request_id);
      if (req.ride_id) {
        socket.emit("join_ride", req.ride_id);
      }
    });
  }, []);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', { 
      withCredentials: true 
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      syncRooms(socket);
    });
    
    socket.on("ride_status_update", (data: any) => {
      fetchHistory();
      if (data.status === 'accepted') {
        setMatchNotification({ 
          name: data.driver_name || 'A driver', 
          rideId: data.ride_id 
        });
        setTimeout(() => setMatchNotification(null), 10000);
      } else if (data.status === 'completed' && data.ride_id && data.driver_id) {
        setReviewRideData({ userId: data.driver_id, rideId: data.ride_id });
        lastHandledReviewRideId.current = data.ride_id;
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchHistory, syncRooms]);

  useEffect(() => {
    if (socketRef.current?.connected) {
      syncRooms(socketRef.current);
    }
  }, [requests, syncRooms]);

  // Redundancy Trigger for Review Modal (if socket event is missed)
  useEffect(() => {
    const checkAndShowReviewModal = async () => {
      const completedRide = requests.find(r => r.ride_status === 'completed' && r.ride_id && r.driver_user_id);
      if (!completedRide || !completedRide.ride_id || !completedRide.driver_user_id || reviewRideData) {
        return;
      }
      
      // Check if we've already shown the modal for this ride this session
      if (completedRide.ride_id === lastHandledReviewRideId.current) {
        return;
      }
      
      // Check if the ride was already reviewed on the server
      try {
        const url = `/api/rides/profile/${completedRide.driver_user_id}?rideId=${completedRide.ride_id}`;
        const { data } = await api.get(url);
        
        // Only show modal if the user hasn't reviewed this ride yet
        if (!data.has_reviewed) {
          setReviewRideData({ userId: completedRide.driver_user_id, rideId: completedRide.ride_id });
          lastHandledReviewRideId.current = completedRide.ride_id;
        }
      } catch (err) {
        console.error('Failed to check review status:', err);
      }
    };
    
    checkAndShowReviewModal();
  }, [requests, reviewRideData]);

  // Scroll to new request when it appears (with delay for DOM render)
  useEffect(() => {
    if (newRequestRef.current) {
      const targetId = newRequestRef.current;
      newRequestRef.current = null;
      // Small delay to allow React to render the history tab
      setTimeout(() => {
        const element = document.getElementById(`ride-item-${targetId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Flash animation to draw attention
          element.style.transition = 'box-shadow 0.3s ease';
          element.style.boxShadow = '0 0 0 2px var(--color-primary)';
          setTimeout(() => { element.style.boxShadow = ''; }, 2000);
        }
      }, 300);
    }
  }, [requests, activeTab]);

  useEffect(() => {
    const isActive = phase === 'pending' || phase === 'matched';
    if (isActive) {
      if (!locationSyncRef.current) {
        locationSyncRef.current = setInterval(async () => {
          const loc = selfLocationRef.current;
          if (!loc) return;
          try {
            await api.post('/api/rides/rider-location', { lat: loc.lat, lng: loc.lng });
          } catch (_) { }
        }, 5000);
      }
    } else {
      if (locationSyncRef.current) {
        clearInterval(locationSyncRef.current);
        locationSyncRef.current = null;
      }
    }
    return () => {
      if (locationSyncRef.current) {
        clearInterval(locationSyncRef.current);
        locationSyncRef.current = null;
      }
    };
  }, [phase]);

  const fetchWallet = useCallback(async () => {
    try {
      const { data } = await api.get('/api/wallet');
      setWallet(data);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
    }
  }, []);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositAmount || isNaN(Number(depositAmount))) return;
    try {
      await api.post('/api/wallet/deposit', { amount: Number(depositAmount) });
      setDepositAmount('');
      fetchWallet();
    } catch (err) {
      console.error('Deposit failed:', err);
    }
  };

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

  const handleShareLocation = () => {
    if (!selfLocation) return;
    const link = `https://www.google.com/maps?q=${selfLocation.lat},${selfLocation.lng}`;
    navigator.clipboard.writeText(link).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 3000);
    });
  };

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
    fetchWallet();
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

  const fetchCoupons = useCallback(async () => {
    try {
      const { data } = await api.get('/api/rides/coupons');
      setAvailableCoupons(data);
    } catch (err) {
      console.error('Failed to fetch coupons:', err);
    }
  }, []);

  useEffect(() => {
    if (showCouponModal) fetchCoupons();
  }, [showCouponModal, fetchCoupons]);

  useEffect(() => {
    if (!showCouponModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowCouponModal(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCouponModal]);

  const handleRouteCalculated = (dist: string, dur: string, distVal: number, durVal: number) => {
    setDistance(dist);
    setDuration(dur);
    setDistanceKm(distVal / 1000);
    setDurationMin(Math.round(durVal / 60));
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
        distance_km: distanceKm,
        coupon_code: couponCode,
        duration: durationMin
      });
      setPickup(null);
      setDropoff(null);
      setDistance('');
      setDuration('');
      setCouponCode('');
      setDiscount(0);
      setDurationMin(0);
      const data = await fetchHistory();
      setActiveTab('history');
      // Auto-select and scroll to the newest request
      if (data.length > 0) {
        const newest = data[0];
        setSelectedHistoryRide(newest);
        newRequestRef.current = newest.request_id;
      }
    } catch (err: any) {
      setStatusMsg(err.response?.data?.message || 'Failed to request ride');
    }
  };

  const handleCancel = async (requestId: number) => {
    try {
      await api.delete(`/api/rides/cancel/${requestId}`);
      fetchHistory();
    } catch (_) { }
  };
 
  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponError('');
    
    // Calculate current base fare for validation
    const v = vehicleTypes.find(v => String(v.vehicle_type_id) === String(selectedVehicleType));
    if (!v) return;
    
    const calculatedFare = Number(v.base_fare) + (distanceKm * Number(v.fare_per_km));
    const currentFare = Math.max(calculatedFare, Number(v.minimum_fare));

    try {
      const { data } = await api.post('/api/rides/validate-coupon', {
        code: couponCode,
        fare: currentFare
      });
      setDiscount(data.discount);
      setCouponError('');
    } catch (err: any) {
      setCouponError(err.response?.data?.message || 'Invalid coupon');
      setDiscount(0);
    }
  };

  const selectCoupon = (code: string) => {
    setCouponCode(code);
    setShowCouponModal(false);
    setTimeout(() => {
      const applyBtn = document.getElementById('apply-coupon-btn');
      if (applyBtn) applyBtn.click();
    }, 100);
  };

  const mapOrigin = activeTab === 'book'
    ? (pickup ? { lat: pickup.lat, lng: pickup.lng } : null)
    : (selectedHistoryRide ? { lat: Number(selectedHistoryRide.pickup_lat), lng: Number(selectedHistoryRide.pickup_lng) } : null);

  const mapDestination = activeTab === 'book'
    ? (dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null)
    : (selectedHistoryRide ? { lat: Number(selectedHistoryRide.dropoff_lat), lng: Number(selectedHistoryRide.dropoff_lng) } : null);

  const selectedVehicle = vehicleTypes.find(v => String(v.vehicle_type_id) === String(selectedVehicleType));

  const estimatedFare = selectedVehicle 
    ? Math.max(
        Number(selectedVehicle.minimum_fare),
        Number(selectedVehicle.base_fare) + (distanceKm * Number(selectedVehicle.fare_per_km))
      ).toFixed(2)
    : "0.00";

const hasInsufficientBalance = wallet ? Number(wallet.balance) < Number(estimatedFare) : true;

  return (
    <div className="rider-container">

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
          <button
            className={`tab-btn ${activeTab === 'wallet' ? 'active' : ''}`}
            onClick={() => { setActiveTab('wallet'); fetchWallet(); }}
          >
            Wallet
          </button>
        </div>

        {activeTab === 'wallet' ? (
          <div className="tab-content">
            <h2 className="rider-title">My Wallet</h2>
            {wallet && (
              <div className="wallet-card">
                <div className="wallet-balance-label">Current Balance</div>
                <h3 className="wallet-balance-value">
                  {wallet.currency === 'USD' ? '$' : wallet.currency}
                  {Number(wallet.balance).toFixed(2)}
                </h3>
              </div>
            )}
            
            <form onSubmit={handleDeposit} className="deposit-form">
              <input 
                type="number" 
                step="0.01" 
                min="1" 
                placeholder="Amount to deposit" 
                value={depositAmount} 
                onChange={e => setDepositAmount(e.target.value)} 
              />
              <button 
                type="submit" 
                className="confirm-btn" 
                style={{ width: 'auto', margin: 0, padding: '0 24px' }}
              >
                Add Funds
              </button>
            </form>
 
            <div className="history-section">
               <h3 className="section-title">Recent Transactions</h3>
               {!wallet || wallet.transactions.length === 0 ? (
                 <p className="no-activity">No transactions yet.</p>
               ) : (
                 <div className="transaction-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {wallet.transactions.map(tx => (
                     <div key={tx.transaction_id} className="tx-item">
                        <div className="tx-info">
                          <strong className="tx-type">
                            {tx.type === 'credit' ? '🟢 Funds Added' : '🔴 Ride Payment'}
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
        ) : activeTab === 'book' ? (
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

            {distance !== '' && duration !== '' && (
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
                <div className="estimate-row" style={{ marginBottom: '10px', alignItems: 'center' }}>
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
                
                {selectedVehicleType && distanceKm > 0 && vehicleTypes.find(v => String(v.vehicle_type_id) === String(selectedVehicleType)) && (
                  <div className="fare-breakdown" style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div className="estimate-row">
                      <span className="estimate-label">Original Fare:</span>
                      <span className="estimate-value">
                        ${estimatedFare}
                      </span>
                    </div>
                    
                    <div className="coupon-input-group" style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
                      <input 
                        type="text" 
                        placeholder="Coupon Code" 
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        style={{ flex: 1, padding: '8px', borderRadius: '4px' }}
                      />
                      <button 
                        id="apply-coupon-btn"
                        onClick={handleApplyCoupon}
                        className="btn-secondary"
                        style={{ padding: '0 16px', fontSize: '13px' }}
                      >
                        Apply
                      </button>
                      <button 
                         onClick={() => setShowCouponModal(true)}
                         className="btn-secondary"
                         style={{ padding: '0 12px', fontSize: '13px', background: 'var(--color-primary)', color: 'white', border: 'none' }}
                         title="View My Coupons"
                      >
                        🎁
                      </button>
                    </div>
                    
                    {couponError && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '-8px', marginBottom: '12px' }}>{couponError}</p>}
                    
                    {discount > 0 && (
                      <div className="estimate-row" style={{ color: 'var(--color-primary)' }}>
                        <span className="estimate-label" style={{ color: 'inherit' }}>Discount:</span>
                        <strong className="estimate-value" style={{ color: 'inherit' }}>-${discount.toFixed(2)}</strong>
                      </div>
                    )}
                    
                    <div className="estimate-row" style={{ marginTop: '8px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px' }}>
                      <span className="estimate-label" style={{ fontWeight: '800', color: 'var(--text-main)' }}>Total to Pay:</span>
                      <strong className="estimate-value" style={{ fontSize: '1.4em', color: 'var(--color-primary)' }}>
                        ${(Number(estimatedFare) - discount).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                )}

                {statusMsg && <p className="error-msg">{statusMsg}</p>}
                <button
                  onClick={handleRequestRide}
                  className="btn-primary"
                  disabled={hasInsufficientBalance}
                  style={{ 
                    width: '100%', 
                    marginTop: '8px',
                    opacity: hasInsufficientBalance ? 0.6 : 1,
                    cursor: hasInsufficientBalance ? 'not-allowed' : 'pointer',
                    filter: hasInsufficientBalance ? 'grayscale(1)' : 'none'
                  }}
                >
                  {hasInsufficientBalance ? 'Insufficient Balance' : 'Confirm Ride'}
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
                    <button className="inline-cancel-btn" onClick={() => handleCancel(selectedHistoryRide.request_id)}>Cancel This Request</button>
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
                      <div key={req.request_id} id={`ride-item-${req.request_id}`}>
                        <RideItem
                          ride={req}
                          onClick={() => setSelectedHistoryRide(req)}
                          active={selectedHistoryRide?.request_id === req.request_id}
                        />
                      </div>
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

      {(phase === 'pending' || phase === 'matched') && selfLocation && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '24px',
          zIndex: 2000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
        }}>
          <button
            className="share-location-btn"
            onClick={handleShareLocation}
            title="Copy your location link"
          >
            📍 Share My Location
          </button>
          {shareCopied && (
            <span className="share-location-copied">✅ Link copied to clipboard!</span>
          )}
        </div>
      )}

      {selectedHistoryRide && selectedHistoryRide.request_status === 'accepted' && selectedHistoryRide.ride_status === 'ongoing' && (
        <Chat
          rideId={selectedHistoryRide.ride_id!}
          theirName={selectedHistoryRide.driver_name || 'Driver'}
          theirUserId={selectedHistoryRide.driver_user_id ?? undefined}
          rideStatus="ongoing"
        />
      )}

      {showCouponModal && (
        <div className="modal-overlay animated fadeIn">
          <div className="modal-box coupon-modal">
            <div className="modal-header">
              <h3>My Available Coupons</h3>
              <button className="close-btn" onClick={() => setShowCouponModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {availableCoupons.length === 0 ? (
                <div className="no-coupons">
                  <p>No coupons available right now.</p>
                  <p className="sub-text">Keep riding to earn more rewards!</p>
                </div>
              ) : (
                <div className="coupon-grid">
                  {availableCoupons.map(coupon => (
                    <div key={coupon.promo_id} className="coupon-item">
                      <div className="coupon-type-badge">
                        {coupon.discount_type === 'percentage' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`}
                      </div>
                      <div className="coupon-main">
                        <h4 className="coupon-code-text">{coupon.code}</h4>
                        <p className="coupon-desc">
                          {Number(coupon.min_fare_amount) > 0 ? `Min. fare $${coupon.min_fare_amount}` : 'No min. fare'}
                          {coupon.max_discount_amount && ` • Max. $${coupon.max_discount_amount}`}
                        </p>
                        {coupon.expiry_date && (
                          <p className="coupon-expiry">Expires: {new Date(coupon.expiry_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <button 
                        className="use-coupon-btn"
                        onClick={() => selectCoupon(coupon.code)}
                      >
                        Select
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {matchNotification && (
        <div className="match-notification-overlay animated slideInUp" style={{
          position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-secondary)', padding: '20px', borderRadius: '16px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid var(--color-primary)',
          zIndex: 3000, display: 'flex', alignItems: 'center', gap: '15px', color: '#fff',
          width: '90%', maxWidth: '400px'
        }}>
          <div style={{ fontSize: '24px' }}>🚕</div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: 'var(--color-primary)' }}>Driver Found!</h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.9em' }}><strong>{matchNotification.name}</strong> has accepted your ride.</p>
          </div>
          <button 
            className="btn-secondary" 
            onClick={() => setMatchNotification(null)}
            style={{ padding: '6px 12px', fontSize: '13px' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {reviewRideData && (
        <ReviewModal
          userId={reviewRideData.userId}
          rideId={reviewRideData.rideId}
          rideStatus="completed"
          onClose={() => setReviewRideData(null)}
        />
      )}
    </div>
  );
}
