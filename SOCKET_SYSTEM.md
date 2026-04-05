# 🛠️ Socket System Documentation: Rider Project

This document outlines the real-time communication architecture of the Rider application, built using **Socket.IO**.

## 1. Architecture Overview
The system follows a **Room-based Pub/Sub** model. Clients (Riders and Drivers) subscribe to specific rooms based on their active requests or matches to receive targeted updates.

- **Technology**: `socket.io` (v4.8.3)
- **Server**: Node.js / Express ([backend/src/index.ts](file:///c:/Users/HP/Desktop/Project/Rider/backend/src/index.ts))
- **Clients**: React / Vite / Socket.io-client

---

## 2. Shared Rooms
Rooms are the primary way to scope communication.
- **`request_${requestId}`**: Used for pre-match and match events. Both Rider and Potential Driver join this room.
- **`ride_${rideId}`**: Used for active/ongoing rides. Scope includes Chat and Status Updates (Completion/Cancellation).

---

## 3. Communication Flows

### A. The Match Flow (Rider ↔️ Driver)
1. **Rider** joins `request_${id}` upon creating a request.
2. **Driver** accepts a ride via REST API.
3. **Server** ([rides.ts:L397](file:///c:/Users/HP/Desktop/Project/Rider/backend/src/routes/rides.ts#L397)) broadcasts `ride_status_update` to `request_${id}`.
4. **Rider** receives `status: 'accepted'`, updates UI, and displays the "Match" notification.

### B. The Chat Flow
1. **Chat UI** initializes a socket and joins `ride_${id}`.
2. **Sender** sends a message via POST `/api/chat/send`.
3. **Server** ([chat.ts:L63](file:///c:/Users/HP/Desktop/Project/Rider/backend/src/routes/chat.ts#L63)) emits `new_message` to the `ride_${id}` room.
4. **Recipient**'s Chat UI receives the event and appends the message to the view instantly.

### C. The Completion Flow
1. **Driver** clicks "Complete Ride" (POST request).
2. **Server** ([rides.ts:L506](file:///c:/Users/HP/Desktop/Project/Rider/backend/src/routes/rides.ts#L506)) emits `ride_status_update` with `status: 'completed'`.
3. **Clients** (both sides) receive the event:
   - Resets ride state.
   - Shows the **Review Modal** to the user (via socket for Rider, and via manual trigger for Driver).

---

## 4. Socket Events Reference

| Event | Type | Payload | Trigger |
| :--- | :--- | :--- | :--- |
| `join_ride` | Emit | `rideId` | Connect to an active ride room. |
| `join_request` | Emit | `requestId` | Connect to a pending request room. |
| `ride_status_update` | Listen | `{ status, driver_name, ride_id, ... }` | Ride is Accepted, Completed, or Cancelled. |
| `new_message` | Listen | `ChatMessage` object | A new message was sent by the other party. |

---

## 5. Security & Reliability
- **CORS**: Configured in `index.ts` to allow `http://localhost:5173` with credentials.
- **Efficiency**: The Rider app only joins socket rooms for active (`pending`) requests or (`ongoing`) rides. This prevents the browser from staying connected to hundreds of redundant historical rooms.
- **Cleanup**: In the Rider app, the redundant polling fallback has been removed to rely primarily on real-time socket events for status updates.
