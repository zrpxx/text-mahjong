<template>
  <div class="min-h-screen flex flex-col items-center relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100">
    <!-- Hero Section -->
    <div class="mt-20 mb-12 text-center z-10 animate-in fade-in slide-in-from-top-10 duration-700">
      <h1 class="text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">
        文字麻将
      </h1>
      <p class="text-xl text-slate-400 font-light tracking-wide">
        遣词 · 拼句 · 策略
      </p>
    </div>

    <!-- Nickname Input -->
    <div v-if="!hasNickname" class="w-full max-w-md p-8 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl z-10 animate-in zoom-in-95 duration-500">
      <h2 class="text-2xl font-light mb-6 text-emerald-400">请输入昵称</h2>
      <input 
        v-model="inputName" 
        @keyup.enter="confirmName"
        type="text" 
        class="w-full bg-slate-800/50 text-white border border-slate-600 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-slate-500"
        placeholder="你的名字..."
      />
      <button 
        @click="confirmName"
        class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg transform transition hover:scale-[1.02] active:scale-[0.98]"
      >
        进入大厅
      </button>
    </div>

    <!-- Lobby Area -->
    <div v-else class="w-full max-w-6xl px-6 z-10 animate-in fade-in duration-500">
      <div class="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div class="flex items-center gap-4">
           <div class="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold border border-emerald-500/30">
             {{ lobbyStore.nickname[0] }}
           </div>
           <div>
             <h2 class="text-2xl font-medium tracking-wide">欢迎, {{ lobbyStore.nickname }}</h2>
             <p class="text-sm text-slate-400">准备好胡牌了吗？</p>
           </div>
        </div>
        <button 
          @click="showCreateModal = true"
          class="bg-white/10 hover:bg-white/20 text-emerald-300 border border-emerald-500/30 font-bold py-3 px-8 rounded-full shadow-lg backdrop-blur-sm transition flex items-center gap-2"
        >
          <span class="text-xl">+</span> 创建房间
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div 
          v-for="room in lobbyStore.rooms" 
          :key="room.roomId"
          class="group bg-slate-800/40 backdrop-blur-md rounded-2xl p-6 border border-white/5 hover:border-emerald-500/50 hover:bg-slate-800/60 transition-all cursor-pointer relative overflow-hidden"
          @click="joinRoom(room.roomId)"
        >
          <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          
          <div class="flex justify-between items-start mb-4 relative">
            <h3 class="text-xl font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">{{ room.name }}</h3>
            <span 
                class="text-xs px-3 py-1 rounded-full border"
                :class="room.status === 'playing' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'"
            >
                {{ room.status === 'playing' ? '游戏中' : '等待中' }}
            </span>
          </div>
          <p class="text-slate-500 font-mono text-sm mb-6">ID: {{ room.roomId }}</p>
          <div class="flex justify-between items-center relative">
             <div class="flex items-center gap-2 text-slate-400">
                 <span class="text-lg">👥</span> 
                 <span>{{ room.playerCount }} / {{ room.maxPlayers }}</span>
             </div>
             <button class="text-sm text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">加入 &rarr;</button>
          </div>
        </div>
        
        <div v-if="lobbyStore.rooms.length === 0" class="col-span-full text-center py-20 text-slate-500 bg-white/5 rounded-2xl border border-dashed border-white/10">
          <div class="text-4xl mb-4 opacity-30">🀄</div>
          <p>暂无活动房间，创建一个吧！</p>
        </div>
      </div>
    </div>

    <!-- Create Room Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 animate-in fade-in duration-200">
      <div class="bg-slate-800 p-8 rounded-2xl w-full max-w-md border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
        <h3 class="text-2xl font-bold mb-6 text-white">创建房间</h3>
        
        <label class="block text-sm text-slate-400 mb-2">房间名称</label>
        <input v-model="newRoomName" class="w-full bg-slate-900/50 text-white rounded-xl px-4 py-3 mb-6 border border-slate-600 focus:border-emerald-500 focus:outline-none transition-colors" />
        
        <label class="block text-sm text-slate-400 mb-2">最大人数 (2-8)</label>
        <div class="flex items-center gap-4 mb-8">
            <input 
                v-model.number="newRoomMax" 
                type="range" min="2" max="8" 
                class="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span class="text-xl font-bold text-emerald-400 w-8 text-center">{{ newRoomMax }}</span>
        </div>

        <div class="flex justify-end gap-3">
          <button @click="showCreateModal = false" class="px-6 py-3 rounded-xl text-slate-300 hover:bg-white/5 transition">取消</button>
          <button @click="handleCreate" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-bold shadow-lg transition">创建</button>
        </div>
      </div>
    </div>

    <!-- Tutorial Modal -->
    <div v-if="showTutorial" class="fixed inset-0 bg-black/90 backdrop-blur-md flex justify-center items-center z-[60] animate-in fade-in duration-300">
        <div class="bg-slate-800 p-10 rounded-3xl w-full max-w-lg border border-emerald-500/30 shadow-2xl relative text-center">
            <div class="text-6xl mb-6 animate-bounce">👋</div>
            <h2 class="text-3xl font-bold text-emerald-400 mb-4">欢迎来到文字麻将</h2>
            <p class="text-slate-300 mb-8 leading-relaxed text-lg">
                这是一个东拼西凑的造句游戏。<br/><br/>
                👆 <strong class="text-white">拖拽</strong> 你的手牌来自由整理（就像冰箱贴一样！）<br/>
                🖱️ <strong class="text-white">点击</strong> 卡牌来出牌。<br/>
                🎲 还可以 <strong class="text-white">吃</strong>上家打出的卡牌。<br/>
                🤗 将手牌拼凑成具有语义的短语，超过半数玩家认可即可胡牌。
            </p>
            <button @click="closeTutorial" class="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xl shadow-xl transition transform hover:scale-[1.02]">
                我明白了，开始吧！
            </button>
        </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useLobbyStore } from '~/stores/lobby';

const lobbyStore = useLobbyStore();
const hasNickname = computed(() => !!lobbyStore.nickname);
const inputName = ref('');
const showCreateModal = ref(false);
const newRoomName = ref('快乐麻将局');
const newRoomMax = ref(4);

const showTutorial = ref(false);

onMounted(() => {
  const saved = sessionStorage.getItem('nickname');
  if (saved) lobbyStore.setNickname(saved);

  // Check Tutorial Status
  const hasSeen = localStorage.getItem('hasSeenTutorial');
  if (!hasSeen) {
      showTutorial.value = true;
  }
});

const closeTutorial = () => {
    showTutorial.value = false;
    localStorage.setItem('hasSeenTutorial', 'true');
};

const confirmName = () => {
  if (inputName.value.trim()) {
    lobbyStore.setNickname(inputName.value.trim());
  }
};

const handleCreate = () => {
  lobbyStore.createRoom(newRoomName.value, newRoomMax.value);
  showCreateModal.value = false;
};

const joinRoom = (roomId: string) => {
  lobbyStore.joinRoom(roomId);
};
</script>
