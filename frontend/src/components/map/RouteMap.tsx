import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet markers in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// A helper component to automatically change the map bounds to fit the markers
function ChangeView({ origin, destination }: { origin: LatLng | null, destination: LatLng | null }) {
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

export interface LatLng {
  lat: number;
  lng: number;
}

interface RouteMapProps {
  origin: LatLng | null;
  destination: LatLng | null;
  onRouteCalculated?: (distanceText: string, durationText: string, distanceValue: number, durationValue: number) => void;
}

export default function RouteMap({ origin, destination, onRouteCalculated }: RouteMapProps) {
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
          // OSRM returns GeoJSON coordinates as [lng, lat], Leaflet wants [lat, lng]
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
    <MapContainer 
      center={[23.8103, 90.4125]} 
      zoom={12} 
      style={{ width: '100%', height: '100%' }}
    >
      <ChangeView origin={origin} destination={destination} />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      
      {origin && <Marker position={[origin.lat, origin.lng]} />}
      {destination && <Marker position={[destination.lat, destination.lng]} />}
      {routeCoordinates.length > 0 && (
        <Polyline positions={routeCoordinates} color="#1890ff" weight={5} />
      )}
    </MapContainer>
  );
}
