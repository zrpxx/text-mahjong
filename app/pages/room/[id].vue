<template>
  <div class="min-h-screen bg-slate-900 text-slate-100 flex flex-col relative overflow-hidden">
    <!-- Header -->
    <div class="h-14 bg-slate-800/80 backdrop-blur-md flex items-center justify-between px-6 shadow-md border-b border-white/5 z-20">
       <div class="font-bold text-lg text-emerald-400 flex items-center gap-2">
           <span>🏠</span> 房间: <span class="font-mono">{{ roomId }}</span>
       </div>
       <div>
         <button @click="leaveRoom" class="text-xs bg-rose-600/80 hover:bg-rose-600 px-4 py-2 rounded-full transition shadow-lg backdrop-blur">
             退出房间
         </button>
       </div>
    </div>

    <!-- Game Area -->
    <div class="flex-1 flex flex-col relative overflow-hidden">

       <!-- Waiting for Play Again Indicator -->
       <div v-if="roomStatus === 'finished' && hasClickedPlayAgain" class="absolute top-20 left-1/2 -translate-x-1/2 bg-black/60 text-emerald-300 px-8 py-3 rounded-full backdrop-blur-md z-30 animate-pulse border border-emerald-500/30 shadow-2xl flex items-center gap-3">
           <div class="animate-spin text-xl">⏳</div>
           等待其他玩家准备... ({{ players.filter(p => p.isReady).length }} / {{ players.length }})
       </div>

       <!-- Game Over Overlay -->
       <div v-if="roomStatus === 'finished' && roomState?.winner && !hasClickedPlayAgain" class="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
           <div class="text-6xl font-bold mb-8 animate-bounce bg-clip-text text-transparent bg-gradient-to-r from-amber-300 to-yellow-500 drop-shadow-lg">
               🎉 赢家: {{ roomState.winner.nickname }}
           </div>
           
           <div 
               class="relative w-full max-w-4xl min-h-[200px] bg-slate-800/50 rounded-2xl mb-12 border border-white/10 shadow-inner flex items-center justify-start overflow-x-auto"
               ref="winnerHandContainer"
           >
                <div 
                    class="relative origin-center transition-transform duration-500"
                    :style="winnerHandContainerStyle"
                >
                   <div 
                       v-for="(card, i) in roomState.winner.hand" 
                       :key="i"
                       class="absolute transition-all duration-500"
                       :style="{
                           left: `${card.x}px`,
                           top: `${card.y}px`,
                           zIndex: card.zIndex
                       }"
                   >
                       <Card 
                         :char="card.char"
                         :id="card.id"
                         class="scale-100 shadow-2xl"
                       />
                   </div>
               </div>
           </div>
           
           <div class="flex gap-6">
                <button @click="resetGame" class="group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-xl transition transform hover:scale-105 overflow-hidden">
                    <span class="relative z-10 flex items-center gap-2 text-xl">
                        🔄 再来一局
                    </span>
                </button>
                <button @click="leaveRoom" class="px-8 py-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-2xl shadow-xl transition border border-white/10">
                    离开房间
                </button>
           </div>
       </div>
       
       <!-- Voting Overlay -->
       <div v-if="roomState?.turnPhase === 'voting' && roomState.votingData" class="absolute inset-0 z-40 bg-slate-900/90 backdrop-blur-lg flex flex-col items-center justify-center p-8 animate-in fade-in">
            <h2 class="text-4xl font-light mb-8 text-white text-center">
                {{ roomState.votingData.candidateId === $socket?.id ? '等待投票...' : '有人胡牌了，这合理吗？' }}
            </h2>
            
            <!-- Candidate Hand Display (Flex) -->
            <!-- Candidate Hand Display (Scaled Absolute) -->
            <div class="relative w-full max-w-4xl min-h-[200px] bg-slate-800/50 rounded-2xl border border-white/10 mb-10 shadow-2xl flex items-center justify-start overflow-x-auto">
                 <div 
                    class="relative origin-center transition-transform duration-500"
                    :style="candidateHandContainerStyle"
                >
                    <div 
                       v-for="(card, i) in candidateHand" 
                       :key="i"
                       class="absolute transition-all duration-500"
                       :style="{
                           left: `${card.x}px`,
                           top: `${card.y}px`,
                           zIndex: card.zIndex
                       }"
                   >
                       <Card 
                         :char="card.char"
                         :id="card.id"
                         class="scale-100 shadow-xl pointer-events-none"
                       />
                   </div>
                 </div>
            </div>
            
            <!-- Voting Controls (For Voters) -->
            <div v-if="roomState.votingData.candidateId !== $socket?.id" class="flex flex-col items-center gap-4">
                <div v-if="hasVoted" class="text-3xl font-light text-slate-400">已投票</div>
                <div v-else class="flex gap-12">
                    <button @click="submitVote(true)" class="flex flex-col items-center gap-3 group hover:scale-110 transition-transform">
                        <div class="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center text-5xl shadow-2xl border-4 border-transparent group-hover:border-emerald-300 transition-colors">👍</div>
                        <span class="font-bold text-emerald-400 text-xl">也是罢</span>
                    </button>
                    <button @click="submitVote(false)" class="flex flex-col items-center gap-3 group hover:scale-110 transition-transform">
                        <div class="w-24 h-24 bg-rose-600 rounded-full flex items-center justify-center text-5xl shadow-2xl border-4 border-transparent group-hover:border-rose-300 transition-colors">👎</div>
                        <span class="font-bold text-rose-400 text-xl">岂有此理</span>
                    </button>
                </div>
            </div>
            
            <!-- Vote Progress -->
            <div class="mt-10 text-xl font-mono text-slate-400 bg-black/40 px-8 py-3 rounded-full border border-white/5">
                已投票: {{ Object.keys(roomState.votingData.votes).length }} / {{ opponents.length }}
            </div>
       </div>

       <!-- Opponents (Top) -->
       <div class="flex justify-center p-6 gap-8 z-10 w-full overflow-x-auto">
          <div v-for="p in opponents" :key="p.socketId" class="flex flex-col items-center transition-opacity" :class="{'opacity-50': !p.isOnline}">
             <div class="w-14 h-14 bg-slate-700/50 backdrop-blur rounded-full flex items-center justify-center mb-2 relative border-2 border-slate-600 shadow-lg" :class="{'border-emerald-500 shadow-emerald-500/20': roomState.currentTurnIndex === players.findIndex((x: Player) => x.socketId === p.socketId)}">
                <span class="text-xl font-bold text-slate-200">{{ p.nickname[0] }}</span>
                <div 
                  class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-slate-800"
                  :class="p.isOnline ? 'bg-emerald-500' : 'bg-slate-500'"
                ></div>
             </div>
             <div class="text-xs font-medium text-slate-300">
                 {{ p.nickname }}
             </div>
             <div class="text-xs text-amber-300/80 mt-1 font-mono bg-black/20 px-2 rounded">手牌: {{ p.hand.length }}</div>
          </div>
       </div>

       <!-- Center / Table -->
       <div class="flex-1 flex justify-center items-center relative z-0">
          <div v-if="roomStatus === 'waiting'" class="text-center animate-in zoom-in-95 duration-500">
             <div class="text-6xl mb-4 animate-pulse opacity-50">🀄</div>
             <h2 class="text-3xl font-light mb-4">等待玩家加入...</h2>
             <p class="mb-8 text-slate-400 bg-white/5 py-2 px-6 rounded-full inline-block">
                 当前人数: <span class="text-emerald-400 font-bold">{{ players.length }}</span> / {{ maxPlayers }}
             </p>
             <div v-if="isHost && players.length >= 2">
                <button 
                    @click="startGame"
                    class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold py-4 px-12 rounded-full shadow-xl text-2xl animate-pulse transition transform hover:scale-105"
                >
                    开始游戏
                </button>
             </div>
             <p v-else-if="isHost" class="text-slate-500">最少需要2人开始</p>
             <p v-else class="text-slate-500 animate-pulse">等待房主开始游戏...</p>
          </div>
          
          <div v-else class="flex flex-col items-center w-full h-full justify-center pb-20">
              <!-- Discard Pile -->
               <div class="grid grid-cols-6 md:grid-cols-12 gap-2 p-6 bg-slate-800/40 backdrop-blur-sm rounded-2xl max-w-4xl min-w-[300px] mb-4 min-h-[140px] border border-white/5 shadow-inner">
                   <Card 
                     v-for="(card, i) in roomState?.discardPile || []" 
                     :key="i"
                     :char="card.char"
                     :id="card.id"
                     class="scale-75 origin-center shadow-md transition-all hover:scale-90"
                     :class="{'ring-2 ring-amber-400 shadow-amber-500/50 z-10': i === (roomState?.discardPile?.length || 0) - 1}"
                   />
               </div>

               <!-- Turn Notification -->
               <div class="h-20 flex items-center justify-center w-full pointer-events-none">
                   <div v-if="isMyTurn && roomState?.turnPhase === 'action'" class="text-emerald-400 bg-black/60 backdrop-blur-md px-8 py-3 rounded-full text-xl font-bold animate-pulse border border-emerald-500/30 shadow-lg">
                       👉 你的回合：请出牌
                   </div>
                   <div v-if="isEatPhase" class="text-amber-400 bg-black/60 backdrop-blur-md px-8 py-3 rounded-full text-xl font-bold animate-bounce border border-amber-500/30 shadow-lg">
                       🍽️ 可以吃！
                   </div>
                   <div v-else-if="!isMyTurn && roomStatus === 'playing'" class="text-slate-400 bg-black/20 px-6 py-2 rounded-full text-sm">
                       等待 {{ currentTurnPlayer?.nickname }} 出牌...
                   </div>
               </div>
          </div>

          <!-- Action Modal for Eat/Pass -->
          <div v-if="isEatPhase" class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                <div class="bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl pointer-events-auto border border-white/10 flex flex-col items-center animate-in zoom-in-95 duration-200">
                    <h3 class="text-2xl mb-6 text-center text-white">要吃这张牌吗？ <span class="font-bold text-amber-400 text-3xl mx-2">{{ roomState?.lastDiscardedCard?.card.char }}</span></h3>
                    <div class="flex justify-center gap-6">
                        <button @click="eatCard" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xl py-3 px-10 rounded-xl font-bold shadow-lg transition">吃</button>
                        <button @click="passTurn" class="bg-slate-600 hover:bg-slate-500 text-white text-xl py-3 px-10 rounded-xl font-bold shadow-lg transition">过</button>
                    </div>
                </div>
           </div>
       </div>

       <!-- Player Hand (Bottom Canvas) -->
       <!-- Player Area (Bottom) -->
       <!-- Action Bar (Above Hand) -->
       <div class="flex justify-end px-6 py-2 z-40">
            <div class="flex gap-4 bg-slate-900/50 backdrop-blur rounded-full px-4 py-2 border border-white/10 shadow-lg items-center">
                 <button @click="onHuClick" class="flex items-center justify-center bg-purple-600 hover:bg-purple-500 shadow-lg text-white font-black text-xl px-6 py-2 rounded-xl transition transform hover:scale-105 active:scale-95 border-2 border-purple-400">
                     胡
                 </button>
                 <button @click="autoLayoutCards" class="text-xs text-slate-400 hover:text-white underline">
                    ⟳ 整理
                 </button>
            </div>
       </div>

       <!-- Player Area (Bottom) -->
       <div class="h-48 md:h-72 flex shrink-0 border-t border-white/5 bg-gradient-to-t from-black/60 to-transparent shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-30">
           
           <!-- Hand Container -->
           <div ref="containerRef" class="flex-1 relative overflow-hidden" :class="{'ring-2 ring-emerald-500/50': isMyTurn && roomState?.turnPhase === 'action'}">
              <div class="absolute inset-x-0 bottom-0 h-full w-full pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/felt.png')]"></div>

              
              <div v-if="isMyTurn && roomState?.turnPhase === 'action'" class="absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-600 text-white text-xs rounded-full shadow-lg z-50 animate-bounce pointer-events-none">
                  可自由拖拽整理 · 点击出牌
              </div>

              <div
                   v-for="card in myHand"
                   :key="card.id"
                   class="absolute cursor-move select-none transition-shadow hover:shadow-2xl hover:brightness-110 active:scale-105"
                   :style="{
                       left: `${card.x}px`,
                       top: `${card.y}px`,
                       zIndex: card.zIndex,
                       touchAction: 'none',
                       transition: draggingCardId === card.id ? 'none' : 'left 0.2s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)' 
                   }"
                   @mousedown.prevent="onCardMouseDown($event, card)"
                   @touchstart.stop="onCardTouchStart($event, card)"
                   :class="{'ring-4 ring-rose-500/70 shadow-[0_0_20px_rgba(244,63,94,0.5)] scale-105': isMyTurn && roomState?.turnPhase === 'action'}"
                 >
                    <Card 
                      :char="card.char" 
                      :id="card.id"
                      class="pointer-events-none shadow-xl rounded-lg" 
                      :style="cardDims.ui"
                    />
              </div>
           </div>
       </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useLobbyStore } from '~/stores/lobby';
import { Card } from '#components'; 
import type { Player, RoomState, Card as CardType } from '~/types';

const route = useRoute();
const roomId = route.params.id as string;
const lobbyStore = useLobbyStore();
const { $socket } = useNuxtApp();

const roomState = ref<RoomState | null>(null);

// Computeds
const players = computed(() => roomState.value?.players || []);
const maxPlayers = computed(() => roomState.value?.settings.maxPlayers || 4);
const roomStatus = computed(() => roomState.value?.status || 'waiting');

const myPlayer = computed(() => players.value.find(p => p.nickname === lobbyStore.nickname));
const myHand = computed<CardType[]>(() => myPlayer.value?.hand || []);
const opponents = computed(() => players.value.filter(p => p.nickname !== lobbyStore.nickname));

const handContentWidth = computed(() => {
    if (myHand.value.length === 0) return 0;
    // Find right-most edge
    const maxRight = Math.max(...myHand.value.map(c => c.x + cardDims.value.w)); 
    return maxRight + 100; // Extra padding
});

const isHost = computed(() => {
   // Simple host logic: first player is host
   return players.value.length > 0 && players.value[0]?.nickname === lobbyStore.nickname;
});

// Game State Computeds
const currentTurnPlayer = computed(() => {
    if (!roomState.value) return null;
    return players.value[roomState.value.currentTurnIndex];
});

const isMyTurn = computed(() => {
    return currentTurnPlayer.value?.nickname === lobbyStore.nickname;
});

const isEatPhase = computed(() => {
    if (!roomState.value || roomState.value.turnPhase !== 'ask_eat') return false;
    // Check if I am the next player
    const myIndex = players.value.findIndex(p => p.nickname === lobbyStore.nickname);
    const turnIndex = roomState.value.currentTurnIndex;
    const nextIndex = (turnIndex + 1) % players.value.length;
    return myIndex === nextIndex;
});

const candidateHand = computed(() => {
    if (roomState.value?.turnPhase !== 'voting' || !roomState.value.votingData) return [];
    const candidate = players.value.find(p => p.socketId === roomState.value?.votingData?.candidateId);
    return candidate?.hand || [];
});

const hasVoted = computed(() => {
    if (!roomState.value?.votingData || !$socket) return false;
    return ($socket.id && roomState.value.votingData.votes[$socket.id]) !== undefined;
});


onMounted(() => {
    if (!$socket) return;
    
    if (!lobbyStore.nickname) {
        alert('请先输入昵称。');
        navigateTo('/');
        return;
    }
    
    // Join room event handled by lobby or manual emit here?
    // Let's ensure verify we are in room
    $socket.emit('join_room', { roomId, nickname: lobbyStore.nickname }); 

    // Listen for room updates
    $socket.on('room_update', (state: RoomState) => {
        console.log('Room update:', state);
        roomState.value = state;
    });

    $socket.on('game_started', (state: RoomState) => {
        roomState.value = state;
    });
});

const startGame = () => {
    $socket?.emit('start_game', roomId);
};

const leaveRoom = () => {
    $socket?.emit('leave_room');
    navigateTo('/');
};

const resetGame = () => {
    $socket?.emit('action_play_again');
};

const hasClickedPlayAgain = computed(() => {
    return myPlayer.value?.isReady === true;
});

const onCardClick = (card: CardType) => {
    if (isMyTurn.value && roomState.value?.turnPhase === 'action') {
        $socket?.emit('action_discard', card.id);
    }
};

const eatCard = () => {
    $socket?.emit('action_eat');
};

const passTurn = () => {
    $socket?.emit('action_pass');
};

const onHuClick = () => {
    if (isMyTurn.value && roomState.value?.turnPhase === 'action') {
        $socket?.emit('action_hu');
    }
};

const submitVote = (agree: boolean) => {
    $socket?.emit('action_vote', agree);
};

// Canvas Drag Logic
const draggingCardId = ref<string | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const containerRef = ref<HTMLElement | null>(null);
const startDragPos = ref({ x: 0, y: 0 });

// Unified Logic
const handleStart = (x: number, y: number, card: CardType) => {
    if (!containerRef.value) return;
    draggingCardId.value = card.id;
    startDragPos.value = { x, y };
    card.zIndex = 1000;
};

const handleMove = (x: number, y: number) => {
    if (!draggingCardId.value || !containerRef.value) return;
    
    const containerRect = containerRef.value.getBoundingClientRect();
    const cardWidth = cardDims.value.w; 
    const cardHeight = cardDims.value.h;
    const localX = x - containerRect.left - (cardWidth / 2);
    const localY = y - containerRect.top - (cardHeight / 2);
    
    // Boundary checks
    const maxX = containerRect.width - cardWidth;
    const maxY = containerRect.height - cardHeight;
    
    const clampedX = Math.max(0, Math.min(localX, maxX));
    const clampedY = Math.max(0, Math.min(localY, maxY));
    
    const card = myHand.value.find(c => c.id === draggingCardId.value);
    if (card) {
        card.x = clampedX;
        card.y = clampedY;
    }
};

const handleEnd = (x: number, y: number) => {
    if (!draggingCardId.value) return;
    
    const dist = Math.hypot(x - startDragPos.value.x, y - startDragPos.value.y);
    const cardId = draggingCardId.value;
    
    const card = myHand.value.find(c => c.id === cardId);
    if (card) {
        if (dist < 5) {
             if (isMyTurn.value && roomState.value?.turnPhase === 'action') {
                $socket?.emit('action_discard', card.id);
             }
             card.zIndex = 1;
        } else {
             card.zIndex = 1;
             $socket?.emit('update_hand_layout', [{
                id: card.id,
                x: card.x,
                y: card.y,
                zIndex: card.zIndex
            }]);
        }
    }
    draggingCardId.value = null;
};

const onCardMouseDown = (e: MouseEvent, card: CardType) => {
    handleStart(e.clientX, e.clientY, card);
};

const onMouseMove = (e: MouseEvent) => {
    handleMove(e.clientX, e.clientY);
};

const handleMouseUp = (e: MouseEvent) => {
    handleEnd(e.clientX, e.clientY);
};

// Touch Handlers
const onCardTouchStart = (e: TouchEvent, card: CardType) => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
            handleStart(touch.clientX, touch.clientY, card);
        }
    }
};

const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length > 0) {
        const touch = e.touches[0];
        if (touch) {
            handleMove(touch.clientX, touch.clientY);
        }
    }
};

const onTouchEnd = (e: TouchEvent) => {
    if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        if (touch) {
            handleEnd(touch.clientX, touch.clientY);
        }
    }
};

const ensureCardsVisible = () => {
   // This is now handled by autoLayoutCards mostly, but we can keep it for simple clamping if we don't want to re-sort.
   // But user asked to "spread evenly initially".
   autoLayoutCards();
};

const autoLayoutCards = () => {
    if (!containerRef.value) return;
    const { clientWidth, clientHeight } = containerRef.value;
    if (clientWidth === 0) return;

    const count = myHand.value.length;
    if (count === 0) return;

    // Distribute Logic
    const cardWidth = cardDims.value.w; 
    const cardHeight = cardDims.value.h;
    const paddingX = cardDims.value.paddingX;
    const availableWidth = clientWidth - (paddingX * 2);
    
    // Determine overlapping step. 
    // We try to fit everything in availableWidth.
    // count * cardWidth is too wide, so we need overlap.
    // TotalWidth = (count - 1) * step + cardWidth
    // So MaxStep = (availableWidth - cardWidth) / (count - 1)
    
    let step = 70;
    if (count > 1) {
        step = (availableWidth - cardWidth) / (count - 1);
    }
    
    if (step > 70) step = 70; // Max gap
    if (step < 20) step = 20; // Abs minimum overlap (very tight)

    // Center if it fits, else start at padding
    const totalGroupWidth = (count - 1) * step + cardWidth;
    let startX = paddingX;

    if (totalGroupWidth <= availableWidth) {
         startX = Math.max(paddingX, (clientWidth - totalGroupWidth) / 2);
    } else {
         // If it still doesn't fit (step clamped at 20), we start at 0 or padding
         startX = 10;
    }
    
    // Default Y
    const defaultY = clientHeight - cardHeight - 20; 

    const updates: any[] = [];

    // Sort by Char before spreading? User asked for spread, usually implies sort. 
    // Let's sort locally for display if we are auto-layouting.
    // Note: Mutating the array order in 'players' might be tricky if it syncs weirdly, 
    // but myHand is a computed from roomState. We should probably sort the roomState hand directly or just x/y.
    // Let's just update X/Y based on current order to avoid re-ordering unexpected. 
    // Wait, Mahjong UX usually expects sorted hands. The server sorts on deal.
    
    myHand.value.forEach((c, i) => {
        const nx = startX + (i * step);
        const ny = Math.min(c.y, defaultY); // Keep current Y if higher (user moved it?), or snap to bottom
        // Actually, "initially" implies snapping to safe area.
        const safeY = Math.min(Math.max(10, c.y), clientHeight - cardHeight);
        
        // Force reset Y if it looks like default 120/200 and we want to align
        // Let's just update to nice layout
        
        if (Math.abs(c.x - nx) > 1 || Math.abs(c.y - safeY) > 1) {
            c.x = nx; 
            c.y = safeY;
            c.zIndex = i;
            updates.push({ id: c.id, x: nx, y: safeY, zIndex: i });
        }
    });

    if (updates.length > 0) {
        $socket?.emit('update_hand_layout', updates);
    }
}

const placeNewCards = (newCards: CardType[]) => {
    if (newCards.length === 0 || !containerRef.value) return;

    const { clientWidth, clientHeight } = containerRef.value;
    const cardHeight = cardDims.value.h;
    const cardWidth = cardDims.value.w;
    const defaultY = clientHeight - cardHeight - 20;

    // Find the rightmost X position of existing cards (that are NOT in the new set)
    const existingCards = myHand.value.filter(c => !newCards.some(nc => nc.id === c.id));
    
    let startX = cardDims.value.paddingX; // Default if no cards
    if (existingCards.length > 0) {
        // Find max X + width
        const maxX = Math.max(...existingCards.map(c => c.x));
        startX = maxX + cardWidth + 10; // Gap
    } else {
        // First deal or empty hand, maybe center? But this fn is for "new" cards.
        // If it's the initial deal, existingCards is empty.
        // We should falling back to autoLayout if it's a massive change (like initial deal).
    }

    const updates: any[] = [];
    newCards.forEach((c, i) => {
        // If it's a "draw", usually it's just 1 card.
        // If it's initial deal (13 cards), startX works but might go off screen.
        // Let's rely on autoLayout for initial large batches, and this for small add.
        
        let nx = startX + (i * (cardWidth + 10));
        
        // Simple clamp to not go totally off screen, though user might have organize button.
        // Simple clamp to not go totally off screen, though user might have organize button.
        // With scroll, we don't clamp to clientWidth!
        // if (nx > clientWidth - cardWidth) {
        //    nx = clientWidth - cardWidth - 10; // Stack at end
        // }

        const ny = defaultY;
        
        c.x = nx;
        c.y = ny;
        c.zIndex = existingCards.length + i;
        updates.push({ id: c.id, x: nx, y: ny, zIndex: c.zIndex });
    });

    if (updates.length > 0) {
        $socket?.emit('update_hand_layout', updates);
    }
}

// Auto-scaling logic for overlays
const calculateTransform = (hand: CardType[]) => {
     if (!hand || hand.length === 0) return {};
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    hand.forEach(c => {
        if (c.x < minX) minX = c.x;
        if (c.x > maxX) maxX = c.x;
        if (c.y < minY) minY = c.y;
        if (c.y > maxY) maxY = c.y;
    });

    const cardW = 60; // Keep fixed for popup to ensure consistency with scale 1.0
    const cardH = 80;
    const totalW = (maxX - minX) + cardW;
    const totalH = (maxY - minY) + cardH;
    
    const containerW = 800; // max width
    const containerH = 280; // max height (increased slightly)
    
    // Scale down if needed, but don't scale up too much (max 1.0)
    // User requested scrolling, so we disable scaling down to fit. 
    // We let width contain the cards and outer container scroll.
    const scale = 1.0; 
    
    // To center:
    // 1. Shift: translate(-minX, -minY). Now cards are at [0,0] to [totalW, totalH].
    // 2. Scale: scale(S).
    // 3. Transform Origin: top left.
    
    return {
        width: `${totalW}px`,
        height: `${totalH}px`,
        transformOrigin: 'top left',
        transform: `scale(${scale}) translate(${-minX}px, ${-minY}px)`
    };
}

const winnerHandContainerStyle = computed(() => calculateTransform(roomState.value?.winner?.hand || []));
const candidateHandContainerStyle = computed(() => calculateTransform(candidateHand.value));




// Better watcher
watch(() => myHand.value, (newHand, oldHand) => {
    if (!oldHand || oldHand.length === 0) {
        // Initial load or reset
        nextTick(autoLayoutCards);
        return;
    }

    const oldIds = new Set(oldHand.map(c => c.id));
    const added = newHand.filter(c => !oldIds.has(c.id));
    
    if (added.length > 0) {
        // Only layout the new cards
        if (added.length > 2) {
             // Mass add -> Auto layout (e.g. restart)
             nextTick(autoLayoutCards);
        } else {
             nextTick(() => placeNewCards(added));
        }
    }
}, { deep: true });

// Responsive Logic
const isMobile = ref(false);
const updateMobileState = () => {
    if (typeof window !== 'undefined') {
        isMobile.value = window.innerWidth < 640;
    }
};

const cardDims = computed(() => {
    if (isMobile.value) {
        return { 
            w: 46, // Logic Width (40 + 6 gap)
            h: 70, // Logic Height (56 + 14 gap)
            ui: { width: '40px', height: '56px' },
            paddingX: 10
        };
    }
    return { 
        w: 60, // Default Logic Width (48 + 12 gap)
        h: 80, // Default Logic Height (64 + 16 gap)
        ui: {}, // Default use class w-12 h-16 (48x64)
        paddingX: 20
    };
});

onMounted(() => {
    updateMobileState();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    
    // Initial check
    setTimeout(() => {
        updateMobileState();
        autoLayoutCards();
    }, 500); 
});

const handleResize = () => {
    updateMobileState();
    autoLayoutCards();
};

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
});
</script>

<style scoped>
/* No extra scoped styles needed due to utility-first */
</style>
