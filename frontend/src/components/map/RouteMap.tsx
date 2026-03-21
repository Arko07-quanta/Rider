import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './RouteMap.css';
import L from 'leaflet';

// Fix for default Leaflet markers in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// A helper component to automatically change the map bounds to fit the markers
function ChangeView({ origin, destination }: { origin: LatLng | null | undefined, destination: LatLng | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (origin && destination) {
      const bounds = L.latLngBounds([origin.lat, origin.lng], [destination.lat, destination.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (origin) {
      map.setView([origin.lat, origin.lng], 13);
    } else if (destination) {
      map.setView([destination.lat, destination.lng], 13);
    }
  }, [origin, destination, map]);
  return null;
}

function MapEvents({ onClick }: { onClick?: (latlng: LatLng) => void }) {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function LocateControl({ userLocation }: { userLocation?: LatLng | null }) {
  const map = useMap();
  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 16);
    }
  };
  return (
    <div className="leaflet-bottom leaflet-right" style={{ marginBottom: '20px', marginRight: '10px', zIndex: 1000 }}>
      <div className="leaflet-control">
        <button 
          className="locate-me-btn" 
          onClick={handleLocate}
          title="Center on my location"
        >
          🎯
        </button>
      </div>
    </div>
  );
}

export interface LatLng {
  lat: number;
  lng: number;
}

interface RouteMapProps {
  origin: LatLng | null;
  destination: LatLng | null;
  userLocation?: LatLng | null;
  driverLocation?: LatLng | null;
  onMapClick?: (latlng: LatLng) => void;
  onRouteCalculated?: (distanceText: string, durationText: string, distanceValue: number, durationValue: number) => void;
}

// Custom icons
const userIcon = L.divIcon({
  className: 'user-marker-icon',
  html: '<div class="user-marker-dot"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const carIcon = L.divIcon({
  className: 'car-marker-icon',
  html: '<div class="car-marker-emoji">🚗</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function RouteMap({ origin, destination, userLocation, driverLocation, onMapClick, onRouteCalculated }: RouteMapProps) {
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const lastFetchedRef = useRef<string>("");

  useEffect(() => {
    if (!origin || !destination) {
      setRouteCoordinates([]);
      return;
    }

    const key = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;
    if (lastFetchedRef.current === key) return;
    lastFetchedRef.current = key;

    const fetchRoute = async () => {
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          setRouteCoordinates(coords);

          if (onRouteCalculated) {
            const distKm = (route.distance / 1000).toFixed(1);
            const durationMin = Math.round(route.duration / 60);
            onRouteCalculated(`${distKm} km`, `${durationMin} mins`, route.distance, route.duration);
          }
        }
      } catch (err) {
        console.error("OSRM Route Error: ", err);
      }
    };

    fetchRoute();
  }, [origin, destination, onRouteCalculated]);

  return (
    <div className="map-wrapper" style={{ width: '100%', height: '100%' }}>
      <MapContainer 
        center={[23.8103, 90.4125]} 
        zoom={12} 
        style={{ width: '100%', height: '100%' }}
      >
        <ChangeView origin={origin || userLocation} destination={destination} />
        <MapEvents onClick={onMapClick} />
        <LocateControl userLocation={userLocation} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {origin && <Marker position={[origin.lat, origin.lng]} />}
        {destination && <Marker position={[destination.lat, destination.lng]} />}
        
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon} />
        )}
        
        {driverLocation && (
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={carIcon} />
        )}

        {routeCoordinates.length > 0 && (
          <Polyline positions={routeCoordinates} color="#1890ff" weight={5} />
        )}
      </MapContainer>
    </div>
  );
}
