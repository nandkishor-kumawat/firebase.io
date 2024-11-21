"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FireSocket = void 0;
const database_1 = require("firebase/database");
const uuid_1 = require("uuid");
const app_1 = require("firebase/app");
class FireSocket {
    _connected = false;
    _id;
    _db;
    _root;
    _socketsRef;
    _eventsRef;
    _roomsRef;
    _rooms = new Map();
    _socketIdMap = new Map();
    constructor(databaseURL, root = '/') {
        this._id = (0, uuid_1.v4)();
        this._db = this.initializeDb(databaseURL);
        this._root = (0, database_1.ref)(this._db, root);
        this._socketsRef = (0, database_1.child)(this._root, "sockets");
        this._eventsRef = (0, database_1.child)(this._root, "events");
        this._roomsRef = (0, database_1.child)(this._root, "rooms");
        this.createSocketId();
    }
    get id() {
        return this._id;
    }
    get connected() {
        return this._connected;
    }
    getSockets(callback) {
        (0, database_1.onValue)(this._socketsRef, (snapshot) => {
            if (snapshot.exists()) {
                const sockets = Object.values(snapshot.val())
                    .filter((v) => v.mappedId)
                    .map((v) => ({ id: v.mappedId, socketId: v.id }));
                callback(sockets);
            }
        });
    }
    getRooms(callback) {
        (0, database_1.onValue)(this._roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const rooms = snapshot.val();
                const roomKeys = Object.keys(rooms);
                roomKeys.forEach((roomKey) => {
                    const room = rooms[roomKey];
                    const members = Object.values(room.sockets);
                    this._rooms.set(roomKey, members);
                });
                callback(this._rooms);
            }
        });
    }
    initializeDb(databaseURL) {
        const app = (0, app_1.initializeApp)({ databaseURL });
        return (0, database_1.getDatabase)(app);
    }
    async createSocketId() {
        try {
            const newSocketRef = (0, database_1.child)(this._socketsRef, this._id);
            await (0, database_1.set)(newSocketRef, { createdAt: new Date().toISOString() });
            this._connected = true;
            (0, database_1.onDisconnect)(newSocketRef).remove().then(() => {
                this.emit('disconnect', { id: this.id });
            });
            (0, database_1.onValue)(this._roomsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const rooms = snapshot.val();
                    const roomKeys = Object.keys(rooms);
                    roomKeys.forEach((roomKey) => {
                        const room = rooms[roomKey];
                        const members = Object.values(room.sockets);
                        this._rooms.set(roomKey, members);
                    });
                }
            });
        }
        catch (error) {
            console.error("Error creating socket ID: ", error);
        }
    }
    disconnect() {
        if (!this.id)
            return;
        try {
            const disconnectRef = (0, database_1.child)(this._socketsRef, this.id);
            (0, database_1.remove)(disconnectRef);
            this._connected = false;
            console.log(`Socket disconnected with ID: ${this.id}`);
            return true;
        }
        catch (error) {
            return false;
        }
    }
    async emit(event, data) {
        const eventData = { event, data };
        if (event === 'connect') {
            // const connectRef = child(this._socketsRef, this.id);;
            // await set(connectRef, theData);
            return;
        }
        try {
            const eventRef = (0, database_1.child)(this._eventsRef, event);
            await (0, database_1.set)(eventRef, eventData);
            // setTimeout(() => remove(eventRef), 3e3);
        }
        catch (error) {
            console.error(error);
        }
    }
    async join(room, data = {}) {
        room = room.replace(/[^a-zA-Z0-9]/g, "");
        try {
            const memberRef = (0, database_1.child)(this._roomsRef, `${room}/sockets/${this.id}`);
            await (0, database_1.set)(memberRef, { id: this.id, createdAt: new Date().toISOString(), ...data });
            (0, database_1.onDisconnect)(memberRef).remove().then(() => {
                this.emit('disconnect', { id: this.id });
            });
        }
        catch (error) {
            console.error(error);
        }
    }
    toRoom(room) {
        return {
            emit: async (event, data) => {
                const eventData = {
                    event,
                    data,
                    room: room.replaceAll(/[^a-zA-Z0-9]/g, ""),
                };
                try {
                    const eventRef = (0, database_1.child)(this._roomsRef, `${room}/events/${event}`);
                    await (0, database_1.set)(eventRef, eventData);
                }
                catch (error) {
                    console.error(error);
                }
            }
        };
    }
    async mapId(id) {
        try {
            const socketRef = (0, database_1.child)(this._socketsRef, this.id);
            await (0, database_1.update)(socketRef, {
                id: this.id,
                mappedId: id,
            });
            (0, database_1.onValue)(this._socketsRef, (snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    const currentData = childSnapshot.val();
                    this._socketIdMap.set(currentData.mappedId, childSnapshot.key);
                });
            });
        }
        catch (error) {
            console.error(error);
        }
    }
    toMapId(id) {
        return {
            emit: async (event, data) => {
                const socketId = this._socketIdMap.get(id);
                if (socketId) {
                    const eventRef = (0, database_1.child)(this._socketsRef, `${socketId}/events/${event}`);
                    await (0, database_1.set)(eventRef, {
                        event,
                        data,
                        mappedId: id,
                    });
                }
            }
        };
    }
    on(event, callback) {
        if (event === 'connect' && this.id) {
            const connectRef = (0, database_1.child)(this._socketsRef, this.id);
            const unsub = (0, database_1.onValue)(connectRef, (snapshot) => {
                if (snapshot.exists()) {
                    callback(snapshot.val().data);
                }
            });
            return unsub;
        }
        if (event === 'disconnect' && !this.id) {
            const disconnectRef = (0, database_1.child)(this._socketsRef, this.id);
            ;
            const unsub = (0, database_1.onValue)(disconnectRef, (snapshot) => {
                callback(true);
            });
            return unsub;
        }
        // Listen to room events
        const un = (0, database_1.onChildAdded)(this._roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                const isItsRoom = Object.keys(currentData.sockets ?? {}).includes(this.id);
                if (isItsRoom) {
                    const eventRef = (0, database_1.child)(this._roomsRef, `${snapshot.key}/events/${event}`);
                    const unsub = (0, database_1.onValue)(eventRef, (snapshot) => {
                        if (snapshot.exists()) {
                            const currentData = snapshot.val();
                            callback(currentData.data);
                            (0, database_1.remove)(eventRef);
                        }
                    });
                    return unsub;
                }
            }
        });
        // Listen to id mapped events
        const mappedRef = (0, database_1.child)(this._socketsRef, `${this.id}/events/${event}`);
        (0, database_1.onValue)(mappedRef, (snapshot) => {
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                callback(currentData.data);
                (0, database_1.remove)(mappedRef);
            }
        });
        // Listen to general events
        const eventRef = (0, database_1.child)(this._eventsRef, event);
        const unsub = (0, database_1.onValue)(eventRef, (snapshot) => {
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                callback(currentData.data);
                (0, database_1.remove)(eventRef);
            }
        });
        return unsub;
    }
    off(event, callback) {
        const eventRef = (0, database_1.ref)(this._db, `events/${event}`);
        (0, database_1.onValue)(eventRef, () => { });
    }
    async leave(room) {
        try {
            const memberRef = (0, database_1.child)(this._roomsRef, `${room}/sockets/${this.id}`);
            await (0, database_1.remove)(memberRef);
        }
        catch (error) {
            console.error(error);
        }
    }
}
exports.FireSocket = FireSocket;
//# sourceMappingURL=index.js.map