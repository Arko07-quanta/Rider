import { useState } from 'react';
import ReviewModal from '../reviews/ReviewModal';
import './RideItem.css';

export interface RideData {
  request_id: number;
  ride_id?: number | null;
  request_status: string;
  ride_status: string | null;
  created_at: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat?: number | string | null;
  pickup_lng?: number | string | null;
  dropoff_lat?: number | string | null;
  dropoff_lng?: number | string | null;
  distance?: number | string | null;
  duration?: number | string | null;
  fare?: number | string | null;
  discount_amount?: number | string | null;
  driver_user_id?: number | null;
  rider_id?: number | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  rider_name?: string | null;
}

interface RideItemProps {
  ride: RideData;
  showRider?: boolean;
  onClick?: (ride: RideData) => void;
  active?: boolean;
}

export default function RideItem({ ride, showRider, onClick, active }: RideItemProps) {
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const isCompleted = ride.ride_status === 'completed';

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const uid = showRider ? ride.rider_id : ride.driver_user_id;
    if (uid) setProfileUserId(uid);
  };
  const getStatusLabel = () => {
    if (ride.request_status === 'pending') return 'Pending';
    if (ride.request_status === 'cancelled') return 'Cancelled';
    if (ride.request_status === 'accepted') {
      if (ride.ride_status === 'ongoing') return 'Ongoing';
      if (ride.ride_status === 'completed') return 'Completed';
      if (ride.ride_status === 'cancelled') return 'Driver Cancelled';
    }
    return 'Unknown';
  };

  const getStatusClass = () => {
    if (ride.ride_status === 'completed') return 'status-badge completed';
    if (ride.ride_status === 'cancelled' || ride.request_status === 'cancelled' || ride.request_status === 'rejected') return 'status-badge cancelled';
    if (ride.ride_status === 'ongoing') return 'status-badge ongoing';
    return 'status-badge pending';
  };

  return (
    <div className={`ride-item-card ${active ? 'active' : ''}`} onClick={() => onClick?.(ride)}>
      <div className="ride-header">
        <span className={getStatusClass()}>{getStatusLabel()}</span>
        <span className="ride-date">{new Date(ride.created_at).toLocaleDateString()}</span>
      </div>
      
      <div className="ride-body">
        <div className="address-line">
          <span className="dot pickup" />
          <span className="address-text">{ride.pickup_address.split(',')[0]}</span>
        </div>
        <div className="address-line">
          <span className="dot dropoff" />
          <span className="address-text">{ride.dropoff_address.split(',')[0]}</span>
        </div>
      </div>

      {(ride.distance || ride.duration || ride.fare) && (
        <div className="ride-meta" style={{ display: 'flex', gap: '12px', fontSize: '0.85em', color: '#666', borderTop: '1px solid #f0f0f0', paddingTop: '8px', marginBottom: '8px' }}>
          {ride.distance && <span>📍 {Number(ride.distance).toFixed(1)} km</span>}
          {ride.duration && <span>⏱️ {Math.round(Number(ride.duration))} mins</span>}
          {ride.fare && <span style={{ color: '#16a34a', fontWeight: 'bold' }}>💰 ${Number(ride.fare).toFixed(2)}</span>}
        </div>
      )}

      <div className="ride-footer">
        <div className="ride-meta-info">
          {showRider ? (
            <div className="person-info">👤 Rider: <strong>{ride.rider_name || 'Anonymous'}</strong></div>
          ) : (
            <div className="person-info">🚗 Driver: <strong>{ride.driver_name || 'Searching...'}</strong></div>
          )}

          {isCompleted && (showRider ? ride.rider_id : ride.driver_user_id) && (
            <button
              onClick={handleProfileClick}
              title="View profile & reviews"
              style={{
                background: 'none', border: '1px solid #374151', borderRadius: '6px',
                cursor: 'pointer', fontSize: '13px', color: '#9ca3af',
                padding: '3px 8px', marginLeft: '8px',
              }}
            >
              👤 Profile
            </button>
          )}
          
          {ride.fare && Number(ride.fare) > 0 && (
            <div className="fare-info">
              <div className="fare-item">
                <span className="fare-label">Fare:</span>
                <span className="fare-value">${Number(ride.fare).toFixed(2)}</span>
              </div>
              {ride.discount_amount && Number(ride.discount_amount) > 0 && (
                <div className="fare-item discount">
                  <span className="fare-label">Discount:</span>
                  <span className="fare-value">-${Number(ride.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="fare-item total">
                <span className="fare-label">Total:</span>
                <span className="fare-value">${(Number(ride.fare) - Number(ride.discount_amount || 0)).toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {profileUserId != null && ride.ride_id != null && (
        <ReviewModal
          userId={profileUserId}
          rideId={ride.ride_id}
          rideStatus={ride.ride_status ?? undefined}
          onClose={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}
