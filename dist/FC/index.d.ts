declare class FireSocket {
    private _connected;
    private _id;
    private _db;
    private _root;
    private _socketsRef;
    private _eventsRef;
    private _roomsRef;
    private _rooms;
    private _socketIdMap;
    constructor(databaseURL: string);
    get id(): string;
    get connected(): boolean;
    getSockets(callback: (sockets: any[]) => void): void;
    getRooms(callback: (rooms: Map<string, string[]>) => void): void;
    private initializeDb;
    private createSocketId;
    disconnect(): boolean | undefined;
    emit(event: string, data: Record<string, any>): Promise<void>;
    join(room: string): Promise<void>;
    toRoom(room: string): {
        emit: (event: string, data: any) => Promise<void>;
    };
    mapId(id: string): Promise<void>;
    toMapId(id: string): {
        emit: (event: string, data: any) => Promise<void>;
    };
    on(event: string, callback: (data: any) => void): import("firebase/database").Unsubscribe;
    off(event: string, callback: (data: any) => void): void;
    leave(room: string): Promise<void>;
}
export default FireSocket;
