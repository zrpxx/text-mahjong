export type Card = {
    id: string;
    char: string;
    x: number;
    y: number;
    zIndex: number;
};

export interface Player {
    socketId: string;
    nickname: string;
    hand: Card[];
    isReady: boolean;
    isOnline: boolean;
    score: number;
}

export interface RoomState {
    roomId: string;
    runId: number; // Increment on game start to differentiate games
    status: 'waiting' | 'playing' | 'voting' | 'finished';
    players: Player[];
    deck: Card[];
    discardPile: Card[];
    currentTurnIndex: number;
    lastDiscardedCard: { card: Card, fromPlayer: string } | null;
    turnPhase: 'draw' | 'action' | 'ask_eat' | 'voting';
    timerStart?: number;
    settings: {
        maxPlayers: number;
        name: string;
    };
    votingData?: {
        candidateId: string; // socketId of player claiming Hu
        // in Text Mahjong, usually you show the whole hand + maybe new card 
        votes: { [socketId: string]: boolean }; // true=agree, false=disagree
        startTime: number;
    };
    winner?: {
        socketId: string;
        nickname: string;
        hand: Card[];
    };
}

export interface LobbyState {
    rooms: {
        roomId: string;
        name: string;
        playerCount: number;
        maxPlayers: number;
        status: RoomState['status'];
    }[];
}
