import type { RoomState, Card, Player } from '~/types'
import { generateDeck } from '~/utils/deck'

// Global in-memory state
export const rooms: Map<string, RoomState> = new Map();
export const socketToRoom: Map<string, string> = new Map();


export const createRoom = (name: string, maxPlayers: number): RoomState => {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newRoom: RoomState = {
        roomId,
        runId: 0,
        status: 'waiting',
        players: [],
        deck: [],
        discardPile: [],
        currentTurnIndex: 0,
        lastDiscardedCard: null,
        turnPhase: 'draw',
        settings: {
            maxPlayers,
            name // Store the name
        }
    };
    rooms.set(roomId, newRoom);
    return newRoom;
}

export const getRoom = (roomId: string): RoomState | undefined => {
    return rooms.get(roomId);
}

export const startGame = (roomId: string): RoomState | undefined => {
    const room = rooms.get(roomId);
    if (!room) return undefined;
    if (room.players.length < 2) return undefined; // Min 2 players

    // 1. Generate & Shuffle Deck
    room.deck = generateDeck();
    room.discardPile = [];
    room.runId++;

    // 2. Deal 13 cards to each player
    for (const player of room.players) {
        player.hand = [];
        for (let i = 0; i < 13; i++) {
            const card = room.deck.pop();
            if (card) player.hand.push(card);
        }
        // Sort hand for better UX (optional, maybe sort by ID or Char code?)
        player.hand.sort((a, b) => a.char.localeCompare(b.char));

        // Initial Layout: Row
        player.hand.forEach((card, index) => {
            card.x = index * 60 + 20; // 60px width spacing + padding
            card.y = 120; // Bottom area (safe for mobile h=192)
            card.zIndex = index;
        });
    }

    // 3. Random Dealer
    room.currentTurnIndex = Math.floor(Math.random() * room.players.length);

    // 4. Dealer draws 1 extra card (Total 14)
    const extraCard = room.deck.pop();
    if (extraCard) {
        // Position extra card slightly offset
        extraCard.x = (13 * 60) + 40;
        extraCard.y = 120;
        extraCard.zIndex = 100;
        room.players[room.currentTurnIndex].hand.push(extraCard);
    }

    room.status = 'playing';
    room.turnPhase = 'action';
    return room;
}

export const handleDisconnect = (socketId: string): { roomId: string, room: RoomState | undefined, action: 'left' | 'offline' | 'destroyed' } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;

    socketToRoom.delete(socketId);
    const room = rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;

    if (room.status === 'waiting' || room.status === 'finished') {
        // Remove player completely
        room.players = room.players.filter(p => p.socketId !== socketId);

        if (room.players.length === 0) {
            rooms.delete(roomId);
            return { roomId, room: undefined, action: 'destroyed' };
        }
        return { roomId, room, action: 'left' };
    } else {
        // Game in progress, mark offline
        player.isOnline = false;
        return { roomId, room, action: 'offline' };
    }
}

// Turn Logic Helpers

export const performDraw = (room: RoomState) => {
    // Check if deck empty
    if (room.deck.length === 0) {
        // Tie / Flow
        room.status = 'finished';
        return;
    }
    const card = room.deck.pop();
    if (card) {
        // Determine position for new card
        const maxX = room.players[room.currentTurnIndex].hand.reduce((max, c) => Math.max(max, c.x), 0);
        card.x = maxX + 80;
        card.y = 120;
        card.zIndex = 100;

        room.players[room.currentTurnIndex].hand.push(card);
    }
    room.turnPhase = 'action';
}

export const handleDiscard = (socketId: string, cardId: string): { roomId: string, room: RoomState, success: boolean } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;

    const playerIndex = room.players.findIndex(p => p.socketId === socketId);
    if (playerIndex === -1) return null;
    if (playerIndex !== room.currentTurnIndex) return null;
    if (room.turnPhase !== 'action') return null;

    const player = room.players[playerIndex];
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return null;

    // Execute Discard
    const [card] = player.hand.splice(cardIndex, 1);
    room.lastDiscardedCard = { card, fromPlayer: player.nickname };
    room.discardPile.push(card); // Add to table view

    // Move to next player validation for Eat
    // Set Ask Eat Phase
    room.turnPhase = 'ask_eat';
    room.timerStart = Date.now();

    return { roomId, room, success: true };
}

export const handleEat = (socketId: string): { roomId: string, room: RoomState, success: boolean } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;
    if (room.turnPhase !== 'ask_eat' || !room.lastDiscardedCard) return null;

    const playerIndex = room.players.findIndex(p => p.socketId === socketId);
    // Only next player can eat
    const nextPlayerIndex = (room.currentTurnIndex + 1) % room.players.length;
    if (playerIndex !== nextPlayerIndex) return null;

    // Execute Eat
    const player = room.players[playerIndex];
    const card = room.lastDiscardedCard.card;

    // Remove from discard pile
    room.discardPile.pop();

    player.hand.push(card);
    player.hand.sort((a, b) => a.char.localeCompare(b.char));

    // It is now this player's turn to discard
    room.currentTurnIndex = nextPlayerIndex;
    room.turnPhase = 'action';
    room.lastDiscardedCard = null;

    return { roomId, room, success: true };
}

export const handlePass = (socketId: string): { roomId: string, room: RoomState, success: boolean } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;
    if (room.turnPhase !== 'ask_eat') return null;

    const playerIndex = room.players.findIndex(p => p.socketId === socketId);
    const nextPlayerIndex = (room.currentTurnIndex + 1) % room.players.length;

    // Only next player can pass (since only they can eat)
    if (playerIndex !== nextPlayerIndex) return null;

    // Execute Pass -> Next player draws
    room.currentTurnIndex = nextPlayerIndex;
    performDraw(room); // Draws card, sets to 'action'
    room.lastDiscardedCard = null;

    return { roomId, room, success: true };
}

export const handleHu = (socketId: string): { roomId: string, room: RoomState, success: boolean } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;

    if (room.turnPhase !== 'action') return null;

    const playerIndex = room.players.findIndex(p => p.socketId === socketId);
    if (playerIndex !== room.currentTurnIndex) return null;

    room.turnPhase = 'voting';
    room.votingData = {
        candidateId: socketId,
        votes: {},
        startTime: Date.now()
    };

    return { roomId, room, success: true };
}

export const handleVote = (socketId: string, agree: boolean): { roomId: string, room: RoomState, success: boolean } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;

    if (room.turnPhase !== 'voting' || !room.votingData) return null;
    if (socketId === room.votingData.candidateId) return null;

    room.votingData.votes[socketId] = agree;

    const otherPlayers = room.players.filter(p => p.socketId !== room.votingData!.candidateId);
    const voteCount = Object.keys(room.votingData.votes).length;

    if (voteCount >= otherPlayers.length) {
        const yesVotes = Object.values(room.votingData.votes).filter(v => v).length;
        const required = Math.ceil(otherPlayers.length / 2);

        if (yesVotes >= required) {
            room.status = 'finished';
            const winner = room.players.find(p => p.socketId === room.votingData!.candidateId);
            room.winner = {
                socketId: winner!.socketId,
                nickname: winner!.nickname,
                hand: winner!.hand
            };
        } else {
            // REJECTED
            // Penalty: Discard the LAST card in hand
            const candidate = room.players.find(p => p.socketId === room.votingData!.candidateId);
            if (candidate && candidate.hand.length > 0) {
                const penaltyCard = candidate.hand[candidate.hand.length - 1]; // Discard last

                // Manual discard process
                candidate.hand.pop();
                room.discardPile.push(penaltyCard);
                room.lastDiscardedCard = { card: penaltyCard, fromPlayer: candidate.nickname };

                // Move turn to next player
                room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;

                // Skip 'ask_eat', go straight to next player draw
                performDraw(room);
                room.lastDiscardedCard = null; // Cleared
            } else {
                room.turnPhase = 'action';
            }
            room.votingData = undefined;
        }
    }

    return { roomId, room, success: true };
}

export const handlePlayAgain = (socketId: string): { roomId: string, room: RoomState, success: boolean } | null => {
    const roomId = socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = rooms.get(roomId);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    if (!player) return null;

    // Mark this player as ready
    player.isReady = true;

    // Check if ALL currently connected players are ready
    // We filter by isOnline because offline players can't be ready? 
    // Or simpler: filter by room.players.
    // If we wait for all, absent players might block. 
    // Requirement is ambiguous, let's wait for all in the list.
    const allReady = room.players.every(p => p.isReady);

    if (allReady) {
        // Reset everything and Start Game
        // Re-use logic from startGame, but clear old state first
        room.status = 'playing';
        room.deck = [];
        room.discardPile = [];
        room.lastDiscardedCard = null;
        room.turnPhase = 'draw';
        room.winner = undefined;
        room.votingData = undefined;
        // runId increments in startGame

        // Clear hands and reset isReady
        for (const p of room.players) {
            p.hand = [];
            p.isReady = false;
        }

        // Call startGame logic (deal cards etc)
        // We can call startGame(roomId) but it does some checks. 
        // startGame checks if players >= 2.
        startGame(roomId);
    }

    return { roomId, room, success: true };
}
