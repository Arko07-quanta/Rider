import { useEffect, useState } from "react";
import api from "../../api/axios";

interface ActiveRide {
  ride_id: string;
  rider_name: string;
  driver_name: string;
  status: string;
  distance_km: number;
  fare_amount: number;
}

export default function ActiveRidesPanel() {
  const [rides, setRides] = useState<ActiveRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const res = await api.get("/api/admin/active-rides");
        setRides(res.data);
      } catch (err) {
        console.error("Failed to fetch active rides", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, []);

  return (
    <>
      <h2>Active Rides</h2>
      {loading ? (
        <p>Loading rides...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ride ID</th>
              <th>Rider</th>
              <th>Driver</th>
              <th>Status</th>
              <th>Distance (km)</th>
              <th>Fare</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((ride) => (
              <tr key={ride.ride_id}>
                <td>{ride.ride_id}</td>
                <td>{ride.rider_name}</td>
                <td>{ride.driver_name || "N/A"}</td>
                <td>
                  <span className={`tag ${ride.status?.toLowerCase() || ''}`}>
                    {ride.status}
                  </span>
                </td>
                <td>{ride.distance_km || "0"}</td>
                <td>${Number(ride.fare_amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
