async function testFlow() {
  const BASE_URL = "http://localhost:4000/api";

  console.log("1. Authenticating accounts...");
  
  // Login rider
  const riderLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "rider@example.com", password: "password123" })
  });
  const riderToken = (await riderLoginRes.json()).token;

  // Login driver
  const driverLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "driver@example.com", password: "password123" })
  });
  const driverToken = (await driverLoginRes.json()).token;

  if (!riderToken || !driverToken) {
    throw new Error("Failed to get authentication tokens! Wait for seeding to complete?");
  }

  console.log("2. Fetching Car vehicle_type_id to make a specific request...");
  const pool = require("./db").default;
  const carType = await pool.query("SELECT vehicle_type_id FROM vehicle_types WHERE type_name = 'Car' LIMIT 1");
  const vehicleTypeId = carType.rows[0].vehicle_type_id;
  console.log("Vehicle Type ID for Car:", vehicleTypeId);

  console.log("3. Rider requests a ride for Car...");
  const requestRes = await fetch(`${BASE_URL}/rides/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${riderToken}` },
    body: JSON.stringify({
      pickup_address: "Point A",
      dropoff_address: "Point B",
      pickup_lat: 40.7128,
      pickup_lng: -74.0060,
      dropoff_lat: 40.7306,
      dropoff_lng: -73.9352,
      vehicle_type_id: vehicleTypeId
    })
  });
  const requestBody = await requestRes.json();
  const requestId = requestBody.request_id;
  console.log("Ride requested! ID:", requestId);

  console.log("4. Driver checks pending requests...");
  const pendingRes = await fetch(`${BASE_URL}/rides/pending`, {
    headers: { "Authorization": `Bearer ${driverToken}` }
  });
  const pendingRequests = await pendingRes.json();
  console.log("Pending requests matched for Driver:", pendingRequests);

  if (pendingRequests.length === 0) {
    console.error("Test failed: Driver didn't see the ride!");
    process.exit(1);
  }

  const selectedRequestId = pendingRequests[0].request_id;
  console.log("5. Driver accepts the ride...");
  const acceptRes = await fetch(`${BASE_URL}/rides/accept/${selectedRequestId}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${driverToken}` }
  });
  
  const acceptData = await acceptRes.json();
  console.log("Accepted payload:", acceptData);
  const rideId = acceptData.ride_id;

  console.log("6. Rider sends a chat message...");
  const chatMessageRes = await fetch(`${BASE_URL}/chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${riderToken}` },
    body: JSON.stringify({
      ride_id: rideId,
      message_text: "Hey, are you nearby?"
    })
  });
  console.log("Rider chat response:", await chatMessageRes.json());

  console.log("7. Driver sends a chat reply...");
  const driverChatRes = await fetch(`${BASE_URL}/chat/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${driverToken}` },
    body: JSON.stringify({
      ride_id: rideId,
      message_text: "Yes, I'm 2 mins away!"
    })
  });
  console.log("Driver chat response:", await driverChatRes.json());

  console.log("8. Driver fetches chat history...");
  const historyRes = await fetch(`${BASE_URL}/chat/${rideId}`, {
    headers: { "Authorization": `Bearer ${driverToken}` }
  });
  console.log("Chat History:", await historyRes.json());

  console.log("Test Flow Completed successfully!");
  process.exit(0);
}

testFlow().catch(console.error);
