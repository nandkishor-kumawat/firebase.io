import { ref, set, onValue, remove, child, DatabaseReference, onDisconnect, update, onChildAdded, getDatabase } from "firebase/database";
import { v4 as uuidv4 } from "uuid";
import { initializeApp } from "firebase/app";

class FireSocket {
    private _connected: boolean = false;
    private _id: string;
    private _db: ReturnType<typeof getDatabase>;
    private _root: DatabaseReference;
    private _socketsRef: DatabaseReference;
    private _eventsRef: DatabaseReference;
    private _roomsRef: DatabaseReference;

    private _rooms = new Map<string, string[]>();

    private _socketIdMap = new Map<string, string>();

    constructor(databaseURL: string) {
        this._id = uuidv4();
        this._db = this.initializeDb(databaseURL);
        this._root = ref(this._db, "/");
        this._socketsRef = child(this._root, "sockets");
        this._eventsRef = child(this._root, "events");
        this._roomsRef = child(this._root, "rooms");
        this.createSocketId();
    }

    get id() {
        return this._id;
    }

    get connected() {
        return this._connected;
    }

    getSockets(callback: (sockets: any[]) => void) {
        onValue(this._socketsRef, (snapshot) => {
            if (snapshot.exists()) {
                const sockets = Object.values(snapshot.val())
                    .filter((v: any) => v.mappedId)
                    .map((v: any) => ({ id: v.mappedId, socketId: v.id }));
                callback(sockets);
            }
        });
    }

    getRooms(callback: (rooms: Map<string, string[]>) => void) {
        onValue(this._roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const rooms = snapshot.val();
                const roomKeys = Object.keys(rooms);
                roomKeys.forEach((roomKey) => {
                    const room = rooms[roomKey];
                    const members = Object.keys(room.sockets);
                    this._rooms.set(roomKey, members);
                });
                callback(this._rooms);
            }
        });
    }

    private initializeDb(databaseURL: string) {
        const app = initializeApp({ databaseURL });
        return getDatabase(app);
    }

    private async createSocketId() {
        try {
            const newSocketRef = child(this._socketsRef, this._id);
            await set(newSocketRef, { createdAt: new Date().toISOString() });
            this._connected = true;

            onDisconnect(newSocketRef).remove();

            onValue(this._roomsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const rooms = snapshot.val();
                    const roomKeys = Object.keys(rooms);
                    roomKeys.forEach((roomKey) => {
                        const room = rooms[roomKey];
                        const members = Object.keys(room.sockets);
                        this._rooms.set(roomKey, members);
                    });
                }
            });
        } catch (error) {
            console.error("Error creating socket ID: ", error);
        }
    }

    disconnect() {
        if (!this.id) return;
        try {
            const disconnectRef = child(this._socketsRef, this.id);
            remove(disconnectRef);
            this._connected = false;
            console.log(`Socket disconnected with ID: ${this.id}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    async emit(event: string, data: Record<string, any>) {

        const eventData = { event, data };

        if (event === 'connect') {
            // const connectRef = child(this._socketsRef, this.id);;
            // await set(connectRef, theData);
            return;
        }
        try {
            const eventRef = child(this._eventsRef, event);
            await set(eventRef, eventData);
            // setTimeout(() => remove(eventRef), 3e3);
        } catch (error) {
            console.error(error);
        }
    }


    async join(room: string) {
        room = room.replace(/[^a-zA-Z0-9]/g, "");
        try {
            const memberRef = child(this._roomsRef, `${room}/sockets/${this.id}`);
            await set(memberRef, { id: this.id, createdAt: new Date().toISOString() });
            onDisconnect(memberRef).remove()
        } catch (error) {
            console.error(error);
        }
    }


    toRoom(room: string) {
        return {
            emit: async (event: string, data: any) => {
                const eventData = {
                    event,
                    data,
                    room: room.replaceAll(/[^a-zA-Z0-9]/g, ""),
                }
                try {
                    const eventRef = child(this._roomsRef, `${room}/events/${event}`);
                    await set(eventRef, eventData);
                } catch (error) {
                    console.error(error);
                }
            }
        }
    }

    async mapId(id: string) {
        try {
            const socketRef = child(this._socketsRef, this.id);
            await update(socketRef, {
                id: this.id,
                mappedId: id,
            })
            onValue(this._socketsRef, (snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    const currentData = childSnapshot.val();
                    this._socketIdMap.set(currentData.mappedId, childSnapshot.key);
                });
            });
        } catch (error) {
            console.error(error);
        }
    }

    toMapId(id: string) {
        return {
            emit: async (event: string, data: any) => {
                const socketId = this._socketIdMap.get(id);
                if (socketId) {
                    const eventRef = child(this._socketsRef, `${socketId}/events/${event}`);
                    await set(eventRef, {
                        event,
                        data,
                        mappedId: id,
                    });
                }
            }
        }
    }

    on(event: string, callback: (data: any) => void) {
        if (event === 'connect' && this.id) {
            const connectRef = child(this._socketsRef, this.id);

            const unsub = onValue(connectRef, (snapshot) => {
                if (snapshot.exists()) {
                    callback(snapshot.val().data);
                }
            });
            return unsub;
        }

        if (event === 'disconnect' && !this.id) {
            const disconnectRef = child(this._socketsRef, this.id);;
            const unsub = onValue(disconnectRef, (snapshot) => {
                callback(true);
            });
            return unsub;
        }

        // Listen to room events
        const un = onChildAdded(this._roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                const isItsRoom = Object.keys(currentData.sockets ?? {}).includes(this.id);
                if (isItsRoom) {
                    const eventRef = child(this._roomsRef, `${snapshot.key}/events/${event}`);
                    const unsub = onValue(eventRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const currentData = snapshot.val();
                            callback(currentData.data);
                            remove(eventRef);
                        }
                    });
                    return unsub;
                }
            }
        });


        // Listen to id mapped events
        const mappedRef = child(this._socketsRef, `${this.id}/events/${event}`);
        onValue(mappedRef, (snapshot) => {
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                callback(currentData.data);
                remove(mappedRef);
            }
        });

        // Listen to general events
        const eventRef = child(this._eventsRef, event);
        const unsub = onValue(eventRef, (snapshot) => {
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                callback(currentData.data);
                remove(eventRef);
            }
        });
        return unsub;
    }


    off(event: string, callback: (data: any) => void) {
        const eventRef = ref(this._db, `events/${event}`);
        onValue(eventRef, () => { });
    }

    async leave(room: string) {
        try {
            const memberRef = child(this._roomsRef, `${room}/sockets/${this.id}`);
            await remove(memberRef);
        } catch (error) {
            console.error(error);
        }
    }
}

export default FireSocket;
