import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'
import { hataBildir } from './services/hata'

registerSW({ immediate: true })

const uygulama = createApp(App)

uygulama.config.errorHandler = (hata) => {
  hataBildir(hata)
}

window.addEventListener('error', (olay) => {
  if (!olay.error) return
  hataBildir(olay.error)
})

window.addEventListener('unhandledrejection', (olay) => {
  olay.preventDefault()
  hataBildir(olay.reason)
})

uygulama.use(router).mount('#app')
