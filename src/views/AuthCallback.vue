<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { hataMetni } from '../services/hata'
import { googleAmaciniAl, googleOturumunuAl, oturumYonlendirmeHedefi } from '../services/google'
import { toast } from '../services/toast'

const router = useRouter()
const durum = ref('Oturum doğrulanıyor...')

onMounted(async () => {
  try {
    const oturum = await googleOturumunuAl()
    const hedef = await oturumYonlendirmeHedefi(oturum)
    const amac = googleAmaciniAl()

    if (hedef.hata === 'onay') {
      await supabase.auth.signOut()
      await router.replace({ path: '/login', query: { hata: 'onay' } })
      return
    }

    if (hedef.profilYok && amac === 'giris') {
      toast.bilgi('Bu Google hesabının kaydı yok. Kayıt bilgilerinizi tamamlayın.')
    }

    await router.replace(hedef.yol)
  } catch (hata) {
    durum.value = 'Oturum açılamadı.'
    toast.hata(hataMetni(hata, 'Oturum açılamadı.'))
    await router.replace('/login')
  }
})
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
    <p class="text-sm text-slate-600">{{ durum }}</p>
  </main>
</template>
