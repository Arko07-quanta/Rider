import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../../api/axios';

// Fix default Leaflet marker icons in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface TripSummary {
  ride_id: number;
  status: string;
  distance: number;
  fare: number;
  created_at: string;
  rider_name: string;
  driver_name: string | null;
}

interface HistoryPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
    }
  }, [points, map]);
  return null;
}

export default function TripReplayPanel() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<TripSummary | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'ongoing'>('all');

  useEffect(() => {
    api.get('/api/admin/trips')
      .then(r => setTrips(r.data))
      .catch(err => console.error('Failed to fetch trips:', err))
      .finally(() => setLoadingTrips(false));
  }, []);

  const handleSelectTrip = async (trip: TripSummary) => {
    setSelectedTrip(trip);
    setHistory([]);
    setSliderIndex(0);
    setLoadingHistory(true);
    try {
      const { data } = await api.get<HistoryPoint[]>(`/api/admin/trips/${trip.ride_id}/history`);
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredTrips = filterStatus === 'all'
    ? trips
    : trips.filter(t => t.status === filterStatus);

  const pathPoints: [number, number][] = history.map(h => [Number(h.latitude), Number(h.longitude)]);
  const currentPoint = history[sliderIndex];

  return (
    <div style={{ display: 'flex', height: '70vh', gap: '16px' }}>

      {/* Left: Trip List */}
      <div style={{
        width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 800 }}>📋 Trips</h3>
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'completed', 'ongoing'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700, textTransform: 'capitalize',
                  background: filterStatus === s ? '#22c55e' : 'rgba(255,255,255,0.08)',
                  color: filterStatus === s ? '#000' : '#9ca3af',
                }}
              >{s}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loadingTrips ? (
            <p style={{ padding: '20px', color: '#9ca3af', fontSize: '13px' }}>Loading trips...</p>
          ) : filteredTrips.length === 0 ? (
            <p style={{ padding: '20px', color: '#9ca3af', fontSize: '13px' }}>No trips found.</p>
          ) : filteredTrips.map(trip => (
            <div
              key={trip.ride_id}
              onClick={() => handleSelectTrip(trip)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                background: selectedTrip?.ride_id === trip.ride_id ? 'rgba(34,197,94,0.1)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Ride #{trip.ride_id}</span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
                  background: trip.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(250,204,21,0.2)',
                  color: trip.status === 'completed' ? '#22c55e' : '#FACC15',
                }}>
                  {trip.status}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                🧑 {trip.rider_name} {trip.driver_name ? `/ 🚗 ${trip.driver_name}` : ''}
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                {Number(trip.distance || 0).toFixed(1)} km · ${Number(trip.fare || 0).toFixed(2)} ·{' '}
                {new Date(trip.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Map + Slider */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!selectedTrip ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.08)', flexDirection: 'column', gap: '8px',
          }}>
            <span style={{ fontSize: '40px' }}>🗺️</span>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Select a trip to start replay</p>
          </div>
        ) : (
          <>
            {/* Trip info bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px 16px',
              flexShrink: 0, flexWrap: 'wrap',
            }}>
              <span style={{ fontWeight: 800, color: '#fff' }}>Ride #{selectedTrip.ride_id}</span>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Rider: <strong>{selectedTrip.rider_name}</strong></span>
              <span style={{ color: '#9ca3af', fontSize: '13px' }}>Driver: <strong>{selectedTrip.driver_name || '—'}</strong></span>
              {loadingHistory && <span style={{ color: '#FACC15', fontSize: '12px' }}>⏳ Loading path...</span>}
              {!loadingHistory && history.length === 0 && (
                <span style={{ color: '#ef4444', fontSize: '12px' }}>⚠️ No location data recorded for this trip</span>
              )}
              {!loadingHistory && history.length > 0 && (
                <span style={{ color: '#22c55e', fontSize: '12px' }}>✅ {history.length} location points</span>
              )}
            </div>

            {/* Map */}
            <div style={{ flex: 1, borderRadius: '12px', overflow: 'hidden', minHeight: '0' }}>
              <MapContainer
                center={pathPoints.length > 0 ? pathPoints[0] : [23.8103, 90.4125]}
                zoom={13}
                style={{ width: '100%', height: '100%' }}
                zoomControl={true}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />
                {pathPoints.length > 0 && (
                  <>
                    <FitBounds points={pathPoints} />
                    <Polyline positions={pathPoints} color="#22c55e" weight={3} opacity={0.7} />
                    <Marker position={pathPoints[sliderIndex]} />
                  </>
                )}
              </MapContainer>
            </div>

            {/* Slider */}
            {history.length > 1 && (
              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px 16px',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {new Date(history[0].timestamp).toLocaleTimeString()}
                  </span>
                  <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                    📍 {new Date(currentPoint.timestamp).toLocaleString()}
                  </span>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    {new Date(history[history.length - 1].timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={history.length - 1}
                  value={sliderIndex}
                  onChange={e => setSliderIndex(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#22c55e' }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
