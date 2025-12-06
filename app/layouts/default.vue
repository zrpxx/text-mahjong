<template>
  <div class="min-h-screen bg-gray-900 text-gray-100 font-sans">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Global layout logic
import { NConfigProvider, darkTheme } from 'naive-ui'
</script>

<style>
/* Global overrides can go here */
</style>
