

export interface PendingDriver {
  user_id: string;
  name: string;
  license_number: string;
  plate_number: string;
  model: string;
  type_name: string;
}

interface VerificationPanelProps {
  drivers: PendingDriver[];
  loading: boolean;
  onVerify: (userId: string) => void;
}

export default function VerificationPanel({ drivers, loading, onVerify }: VerificationPanelProps) {
  return (
    <>
      <h2>Drivers Awaiting Approval</h2>
      {loading ? (
        <p>Loading queue...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Driver Name</th>
              <th>License</th>
              <th>Vehicle Type</th>
              <th>Model/Plate</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.user_id}>
                <td>
                  <strong>{driver.name}</strong>
                </td>
                <td>
                  <code>{driver.license_number}</code>
                </td>
                <td>
                  <span className={`tag ${driver.type_name.toLowerCase()}`}>
                    {driver.type_name}
                  </span>
                </td>
                <td>
                  {driver.model} ({driver.plate_number})
                </td>
                <td>
                  <button
                    className="btn-approve"
                    onClick={() => onVerify(driver.user_id)}
                  >
                    Approve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
