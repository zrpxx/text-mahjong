// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      title: '文字麻将 | Text Mahjong',
      htmlAttrs: {
        lang: 'zh-CN',
      },
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/tailwindcss'],
  srcDir: 'app/'
})