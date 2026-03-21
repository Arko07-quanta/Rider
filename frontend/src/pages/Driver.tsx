import './Driver.css';
import RouteMap from '../components/map/RouteMap';

// Mock coordinates for demonstration
const mockOrigin = { lat: 23.8103, lng: 90.4125 };
const mockDestination = { lat: 23.8223, lng: 90.4225 };

export default function Driver() {

  return (
    <div className="driver-container" style={{ display: 'flex', height: '100vh', flexDirection: 'row', overflow: 'hidden' }}>
      
      <div className="driver-sidebar" style={{ width: '380px', padding: '24px', backgroundColor: '#ffffff', boxShadow: '2px 0 10px rgba(0,0,0,0.05)', zIndex: 1 }}>
        <h2 style={{ marginBottom: '24px' }}>Driver Dashboard</h2>
        
        <div style={{ padding: '20px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: '8px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0050b3' }}>Incoming Request</h4>
          <p><strong>Pickup:</strong> Gulshan Avenue</p>
          <p><strong>Dropoff:</strong> Banani Model Town</p>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button 
              onClick={() => alert("Ride Accepted! (Backend API integration pending)")}
              style={{ flex: 1, padding: '10px', backgroundColor: '#52c41a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Accept
            </button>
            <button 
              onClick={() => alert("Ride Declined!")}
              style={{ flex: 1, padding: '10px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Decline
            </button>
          </div>
        </div>
      </div>

      <div className="driver-map" style={{ flex: 1, height: '100vh', overflow: 'hidden' }}>
        <RouteMap 
          origin={mockOrigin}
          destination={mockDestination}
        />
      </div>

    </div>
  );
}
