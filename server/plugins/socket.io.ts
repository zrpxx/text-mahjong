import { Server as SocketServer } from 'socket.io';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import type { NitroApp } from 'nitropack';
import { rooms, createRoom, startGame, handleDisconnect, socketToRoom, handleDiscard, handleEat, handlePass, handleHu, handleVote, handlePlayAgain } from '../utils/state';


// Extend the NitroApp interface to include the Socket.io server
declare module 'nitropack' {
    interface NitroApp {
        io: SocketServer;
    }
}

export default defineNitroPlugin((nitroApp: NitroApp) => {
    const io = new SocketServer({
        cors: {
            origin: '*', // Allow all origins for dev simplicity
            methods: ['GET', 'POST']
        }
    });

    nitroApp.io = io;

    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        // Initial simple events
        socket.on('join_lobby', () => {
            // Send list of rooms
            const roomList = Array.from(rooms.values()).map(r => ({
                roomId: r.roomId,
                name: r.settings.name || `房间 ${r.roomId}`,
                playerCount: r.players.length,
                maxPlayers: r.settings.maxPlayers,
                status: r.status
            }));
            socket.emit('lobby_update', roomList);
        });

        socket.on('create_room', (settings: { maxPlayers: number, name: string }) => {
            const room = createRoom(settings.name, settings.maxPlayers);
            socket.emit('room_created', room.roomId);
            // Broadcast lobby update
            io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                roomId: r.roomId,
                name: r.settings.name || `房间 ${r.roomId}`,
                playerCount: r.players.length,
                maxPlayers: r.settings.maxPlayers,
                status: r.status
            })));
        });
        socket.on('join_room', (data: { roomId: string, nickname: string }) => {
            const { roomId, nickname } = data;
            const room = rooms.get(roomId);

            if (!room) {
                socket.emit('error', '房间不存在');
                return;
            }

            // Check if player already in room (by nickname or socketId?)
            // For simplicity, allow multiple same nicknames or update socketId if exists
            let player = room.players.find(p => p.nickname === nickname);

            if (player) {
                // Reconnect / Update socket ID
                if (player.isOnline && player.socketId !== socket.id) {
                    socket.emit('error', '昵称已被使用');
                    return;
                }
                player.socketId = socket.id;
            } else {
                if (room.players.length >= room.settings.maxPlayers) {
                    socket.emit('error', '房间已满');
                    return;
                }
                // Add new player
                player = {
                    socketId: socket.id,
                    nickname,
                    hand: [],
                    isReady: false,
                    isOnline: true,
                    score: 0
                };
                room.players.push(player);
            }

            player.isOnline = true; // Ensure online
            socketToRoom.set(socket.id, roomId);

            socket.join(roomId);

            // Emit room update to THIS user immediately
            socket.emit('room_update', room);

            // Emit room update to everyone in room
            io.to(roomId).emit('room_update', room);

            // Broadcast lobby update (player count changed)
            io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                roomId: r.roomId,
                name: r.settings.name || `房间 ${r.roomId}`,
                playerCount: r.players.length,
                maxPlayers: r.settings.maxPlayers,
                status: r.status
            })));
        });

        socket.on('start_game', (roomId: string) => {
            const room = startGame(roomId);
            if (room) {
                io.to(roomId).emit('game_started', room); // Sync full state
                // Also broadcast updated lobby status (e.g. status changes to 'playing')
                io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                    roomId: r.roomId,
                    name: r.settings.name || `房间 ${r.roomId}`,
                    playerCount: r.players.length,
                    maxPlayers: r.settings.maxPlayers,
                    status: r.status
                })));
            }
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
            const result = handleDisconnect(socket.id);
            if (result) {
                if (result.action === 'destroyed') {
                    io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                        roomId: r.roomId,
                        name: r.settings.name || `房间 ${r.roomId}`,
                        playerCount: r.players.length,
                        maxPlayers: r.settings.maxPlayers,
                        status: r.status
                    })));
                } else if (result.room) {
                    io.to(result.roomId).emit('room_update', result.room);
                    if (result.action === 'left') {
                        // Update lobby count
                        io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                            roomId: r.roomId,
                            name: r.settings.name || `房间 ${r.roomId}`,
                            playerCount: r.players.length,
                            maxPlayers: r.settings.maxPlayers,
                            status: r.status
                        })));
                    }
                }
            }
        });

        socket.on('leave_room', () => {
            const result = handleDisconnect(socket.id);
            if (result) {
                if (result.action === 'destroyed') {
                    io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                        roomId: r.roomId,
                        name: r.settings.name || `房间 ${r.roomId}`,
                        playerCount: r.players.length,
                        maxPlayers: r.settings.maxPlayers,
                        status: r.status
                    })));
                } else if (result.room) {
                    io.to(result.roomId).emit('room_update', result.room);
                    // Explicitly tell the user they left? (Client handles nav)

                    io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                        roomId: r.roomId,
                        name: r.settings.name || `房间 ${r.roomId}`,
                        playerCount: r.players.length,
                        maxPlayers: r.settings.maxPlayers,
                        status: r.status
                    })));
                }
            }
        });

        socket.on('update_hand_layout', (updates: { id: string, x: number, y: number, zIndex: number }[]) => {
            const roomId = socketToRoom.get(socket.id);
            if (!roomId) return;
            const room = rooms.get(roomId);
            if (!room) return;
            const player = room.players.find(p => p.socketId === socket.id);
            if (!player) return;

            // Apply updates
            const handMap = new Map(player.hand.map(c => [c.id, c]));
            for (const update of updates) {
                const card = handMap.get(update.id);
                if (card) {
                    card.x = update.x;
                    card.y = update.y;
                    card.zIndex = update.zIndex;
                }
            }

            // Sync room state (debouncing recommended in production but direct for now)
            // Actually, sending full room update on every drag move is HEAVY.
            // Client should probably only emit on 'dragend' or periodically.
            // Let's assume client emits on drag end.
            io.to(roomId).emit('room_update', room);
        });

        // Game Action Listeners
        socket.on('action_discard', (cardId: string) => {
            // Need to import handleDiscard etc. if not imported.
            // They are imported in the top level.
            const result = handleDiscard(socket.id, cardId); // Wait, need to check if these are exported/imported?
            // Yes, checking imports... wait, I need to make sure I imported them in line 4.
            if (result && result.success) {
                io.to(result.roomId).emit('room_update', result.room);
            }
        });

        socket.on('action_eat', () => {
            const result = handleEat(socket.id);
            if (result && result.success) {
                io.to(result.roomId).emit('room_update', result.room);
            }
        });

        socket.on('action_pass', () => {
            const result = handlePass(socket.id);
            if (result && result.success) {
                io.to(result.roomId).emit('room_update', result.room);
            }
        });

        socket.on('action_hu', () => {
            const result = handleHu(socket.id);
            if (result && result.success) {
                io.to(result.roomId).emit('room_update', result.room);
            }
        });

        socket.on('action_vote', (agree: boolean) => {
            const result = handleVote(socket.id, agree);
            if (result && result.success) {
                io.to(result.roomId).emit('room_update', result.room);
            }
        });

        socket.on('action_play_again', () => {
            const result = handlePlayAgain(socket.id);
            if (result && result.success) {
                io.to(result.roomId).emit('room_update', result.room);
                // Also update lobby as status changed to waiting
                io.emit('lobby_update', Array.from(rooms.values()).map(r => ({
                    roomId: r.roomId,
                    name: r.settings.name || `房间 ${r.roomId}`,
                    playerCount: r.players.length,
                    maxPlayers: r.settings.maxPlayers,
                    status: r.status
                })));
            }
        });
    });

    // Hook into the server engine to attach Socket.io
    nitroApp.hooks.hook('request', (event) => {
        // @ts-ignore
        if (!event.node.req.socket.server._io) {
            // @ts-ignore
            event.node.req.socket.server._io = io;
            // @ts-ignore
            io.attach(event.node.req.socket.server);
            console.log('Socket.io attached to server via request hook');
        }
    });
});


