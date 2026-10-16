<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { hataMetni } from '../services/hata'
import { profilGetir } from '../services/profil'
import { toast } from '../services/toast'
import GoogleButon from '../components/GoogleButon.vue'

const router = useRouter()
const route = useRoute()

const eposta = ref('')
const sifre = ref('')
const isLoading = ref(false)
let girisSuruyor = false

const hataMetinleri = {
  onay: 'Öğretmen onayı bekleniyor',
  profil: 'Profil bilgisi alınamadı.',
}

onMounted(() => {
  const kod = route.query.hata
  if (typeof kod !== 'string' || !hataMetinleri[kod]) return
  toast.uyari(hataMetinleri[kod])
  const sorgu = { ...route.query }
  delete sorgu.hata
  router.replace({ query: sorgu })
})

async function girisYap() {
  if (girisSuruyor) return
  girisSuruyor = true
  isLoading.value = true

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: eposta.value.trim(),
      password: sifre.value,
    })
    if (error) throw new Error(hataMetni(error))

    const profil = await profilGetir(data.user.id)

    if (profil?.tur === 'ogretmen') {
      await router.push('/ogretmen')
      return
    }

    if (profil?.tur === 'ogrenci') {
      if (profil.onay_durumu === false) {
        await supabase.auth.signOut()
        toast.uyari('Öğretmen onayı bekleniyor')
        return
      }
      await router.push('/ogrenci')
      return
    }

    await supabase.auth.signOut()
    throw new Error('Bu hesaba ait öğretmen veya öğrenci kaydı bulunamadı.')
  } catch (hata) {
    toast.hata(hata.message || 'Giriş yapılamadı.')
  } finally {
    isLoading.value = false
    girisSuruyor = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
    <form class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow" @submit.prevent="girisYap">
      <div>
        <p class="text-sm font-medium text-slate-500">LGS Günlük Takip</p>
        <h1 class="text-2xl font-semibold text-slate-900">Giriş</h1>
      </div>

      <label class="block text-sm text-slate-700">
        E-posta
        <input v-model="eposta" type="email" required autocomplete="email" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900" />
      </label>
      <label class="block text-sm text-slate-700">
        Şifre
        <input v-model="sifre" type="password" required autocomplete="current-password" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900" />
      </label>

      <button type="submit" class="w-full rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-60" :disabled="isLoading">
        {{ isLoading ? 'Giriş yapılıyor...' : 'Giriş yap' }}
      </button>

      <p class="text-center text-xs text-slate-400">veya</p>
      <GoogleButon amac="giris" metin="Google ile giriş yap" />

      <p class="text-sm text-slate-600">
        Hesabın yok mu?
        <router-link to="/register" class="font-medium text-slate-900 underline">Kayıt ol</router-link>
      </p>
    </form>
  </main>
</template>
