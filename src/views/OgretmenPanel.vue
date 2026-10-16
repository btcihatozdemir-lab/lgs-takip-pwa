<script setup>
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { toast } from '../services/toast'

const router = useRouter()

async function cikisYap() {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    await router.push('/login')
  } catch (hata) {
    toast.hata(hata.message || 'Çıkış yapılamadı.')
  }
}
</script>

<template>
  <main class="min-h-screen bg-slate-50 p-6">
    <header class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-semibold text-slate-900">Öğretmen paneli</h1>
      <button type="button" class="rounded border border-slate-300 px-3 py-2 text-sm" @click="cikisYap">
        Çıkış
      </button>
    </header>
    <p class="text-slate-600">Sınıf ve öğrenci takibi burada listelenecek.</p>
  </main>
</template>
