import { defineStore } from 'pinia';
import type { LobbyState, RoomState } from '~/types';

export const useLobbyStore = defineStore('lobby', () => {
    const { $socket } = useNuxtApp();
    const rooms = ref<LobbyState['rooms']>([]);
    const nickname = ref('');
    if (import.meta.client) {
        const saved = sessionStorage.getItem('nickname');
        if (saved) nickname.value = saved;
    }
    const currentRoomId = ref<string | null>(null);

    // Initial lobby data
    if (import.meta.client && $socket) {
        if ($socket.connected) {
            $socket.emit('join_lobby');
        }

        $socket.on('connect', () => {
            console.log('Connected to server');
            $socket.emit('join_lobby');
        });

        $socket.on('lobby_update', (data: LobbyState['rooms']) => {
            rooms.value = data;
        });

        $socket.on('room_created', (roomId: string) => {
            currentRoomId.value = roomId;
            navigateTo(`/room/${roomId}`);
        });
    }

    const setNickname = (name: string) => {
        nickname.value = name;
        if (import.meta.client) {
            sessionStorage.setItem('nickname', name);
        }
    };

    const createRoom = (name: string, maxPlayers: number) => {
        if (!$socket) return;
        $socket.emit('create_room', { name, maxPlayers });
    };

    const joinRoom = (roomId: string) => {
        if (!nickname.value) return;
        currentRoomId.value = roomId;
        navigateTo(`/room/${roomId}`);
    };

    return {
        rooms,
        nickname,
        createRoom,
        joinRoom,
        setNickname
    };
});
