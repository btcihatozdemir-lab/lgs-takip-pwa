<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { toastDurumu, toastKapat } from '../services/toast'

const siniflar = {
  basari: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  hata: 'border-red-200 bg-red-50 text-red-800',
  uyari: 'border-amber-200 bg-amber-50 text-amber-950',
  bilgi: 'border-slate-200 bg-white text-slate-800',
}

const alt = ref(16)
let boyut
let degisim

function olc() {
  const dock = document.querySelector('footer.dock')
  const gorunur = dock && getComputedStyle(dock).display !== 'none'
  const yukseklik = gorunur ? Math.ceil(dock.getBoundingClientRect().height) : 0
  alt.value = yukseklik + 16
}

onMounted(() => {
  olc()
  boyut = new ResizeObserver(olc)
  boyut.observe(document.body)
  degisim = new MutationObserver(olc)
  degisim.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] })
  window.addEventListener('resize', olc)
})

onUnmounted(() => {
  boyut?.disconnect()
  degisim?.disconnect()
  window.removeEventListener('resize', olc)
})
</script>

<template>
  <div class="toast-yigin" :style="{ bottom: `${alt}px` }">
    <article
      v-for="bildirim in toastDurumu.bildirimler"
      :key="bildirim.id"
      class="pointer-events-auto w-full rounded-xl border px-4 py-3 shadow-lg"
      :class="siniflar[bildirim.tur] || siniflar.bilgi"
      role="status"
    >
      <div class="flex items-start gap-3">
        <p class="flex-1 text-sm leading-5">{{ bildirim.metin }}</p>
        <button type="button" class="shrink-0 text-xs font-medium opacity-70" @click="toastKapat(bildirim.id)">
          Kapat
        </button>
      </div>
    </article>
  </div>
</template>
