<template>
  <div 
    class="relative w-12 h-16 bg-cream-100 border-2 border-gray-400 rounded shadow-md flex justify-center items-center select-none cursor-pointer hover:-translate-y-1 transition-transform"
    :class="{'bg-green-100 border-green-500': isSelected}"
  >
    <span class="text-2xl font-bold font-serif text-gray-800">{{ char }}</span>
    <span v-if="debug" class="absolute top-0 right-0 text-[8px] text-gray-400">{{ id.split('-')[1] }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  char: string
  id: string
  isSelected?: boolean
  debug?: boolean
}>()
</script>

<style scoped>
.bg-cream-100 {
    background-color: #fdfbf7;
}
</style>
