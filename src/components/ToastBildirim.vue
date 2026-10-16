<script setup>
import { toastDurumu, toastKapat } from '../services/toast'

const siniflar = {
  basari: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  hata: 'border-red-200 bg-red-50 text-red-800',
  uyari: 'border-amber-200 bg-amber-50 text-amber-950',
  bilgi: 'border-slate-200 bg-white text-slate-800',
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
    <article
      v-for="bildirim in toastDurumu.bildirimler"
      :key="bildirim.id"
      class="pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-lg"
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
