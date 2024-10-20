# FireSocket

**FireSocket** is a lightweight and simple WebSocket-like solution for Firebase Realtime Database, enabling real-time events, room management, and socket-like communication between clients using Firebase as the backend. This package is designed to mimic the behavior of Socket.IO but with Firebase.

## Features

- Real-time communication using Firebase Realtime Database
- Socket-like communication between clients
- Room-based communication and events
- Map custom IDs to socket IDs
- Handle `connect` and `disconnect` events
- Emit and listen to custom events across rooms or specific clients

## Installation

Install the required dependencies using npm:

```bash
npm install firebase.io
```

Then, import `FireSocket` into your project:

```typescript
import FireSocket from "firebase.io";
```

## Usage

### Initialization

To create a new instance of `FireSocket`, provide your Firebase Realtime Database URL:

```typescript
const fireSocket = new FireSocket("https://your-firebase-database-url");
```

### Connecting to Firebase

FireSocket automatically connects to Firebase and creates a unique socket ID for each instance. You can retrieve the socket ID with:

```typescript
console.log(fireSocket.id);
// 3d585b39-0b3e-496f-9d0b-eabc0ce37c36
```

### Listening to Events

You can listen for custom events using the `on` method:

```typescript
fireSocket.on("your-event", (data) => {
  console.log("Received data: ", data);
});
```

You can also handle the connection event:

```typescript
fireSocket.on("connect", () => {
  console.log("Connected to Firebase!");
});
```

### Emitting Events

To emit custom events:

```typescript
fireSocket.emit("your-event", { key: "value" });
```

You can also emit events to specific rooms:

```typescript
fireSocket.toRoom("room-name").emit("your-event", { key: "value" });
```

### Rooms

#### Joining a Room

Join a room by calling the `join` method:

```typescript
fireSocket.join("room-name");
```

#### Leaving a Room

To leave a room:

```typescript
fireSocket.leave("room-name");
```

### Custom ID Mapping

You can map custom user IDs to socket IDs.
It is helpful to send events to single socket e.g. chat applications.

```typescript
fireSocket.mapId("custom-id");
```

And send events to a specific user mapped by their ID:

```typescript
fireSocket.toMapId("custom-id").emit("your-event", { key: "value" });
```

### Disconnecting

To disconnect the socket manually:

```typescript
fireSocket.disconnect();
```

### Retrieving Sockets

You can retrieve the list of all connected sockets with:

```typescript
fireSocket.getSockets((sockets) => {
  console.log(sockets);
});
```

### Retrieving Rooms

You can get all rooms and their members with:

```typescript
fireSocket.getRooms((rooms) => {
  console.log(rooms);
});
```

### Leaving and Stopping Event Listeners

To stop listening to a specific event, use:

```typescript
fireSocket.off("your-event");
```

## Example

Here's a complete example of using FireSocket:

```typescript
import FireSocket from "firebase.io";

const fireSocket = new FireSocket("https://your-firebase-database-url");

fireSocket.on("connect", () => {
  console.log("Connected to Firebase!");

  fireSocket.emit("greet", { message: "Hello, World!" });

  fireSocket.on("greet-back", (data) => {
    console.log("Received: ", data);
  });
});

fireSocket.join("chat-room");

fireSocket.toRoom("chat-room").emit("message", { text: "Hello everyone!" });

fireSocket.on("message", (data) => {
  console.log("New message in chat-room: ", data);
});
```

## API

### Methods

- `fireSocket.on(event: string, callback: (data: any) => void)` - Listen for a specific event.
- `fireSocket.emit(event: string, data: any)` - Emit an event to all clients.
- `fireSocket.toRoom(room: string).emit(event: string, data: any)` - Emit an event to a specific room.
- `fireSocket.join(room: string)` - Join a room.
- `fireSocket.leave(room: string)` - Leave a room.
- `fireSocket.mapId(id: string)` - Map a custom ID to a socket.
- `fireSocket.toMapId(id: string).emit(event: string, data: any)` - Emit an event to a specific mapped user ID.
- `fireSocket.disconnect()` - Manually disconnect the socket.

### Properties

- `fireSocket.id` - The unique ID of the socket.
- `fireSocket.connected` - Connection status (boolean).

## License

MIT License.
