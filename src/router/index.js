import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'
import { hataBildir, hataMetni } from '../services/hata'
import { toast } from '../services/toast'
import { bekleyenKaydiTamamla } from '../services/kayit'
import { profilGetir } from '../services/profil'

const routes = [
  {
    path: '/',
    component: { template: '<p class="p-6 text-center text-sm">Yönlendiriliyor...</p>' },
    beforeEnter: async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const aciklama = hash.get('error_description') || hash.get('error')
      if (aciklama) {
        toast.uyari(hataMetni(new Error(decodeURIComponent(aciklama.replace(/\+/g, ' ')))))
        return { path: '/login', query: { hata: 'link' } }
      }
      try {
        await supabase.auth.getSession()
      } catch (hata) {
        toast.uyari(hataMetni(hata, 'Onay bağlantısı açılamadı.'))
        return { path: '/login', query: { hata: 'link' } }
      }
      return '/login'
    },
  },
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/register', component: () => import('../views/Register.vue') },
  { path: '/auth/callback', component: () => import('../views/AuthCallback.vue') },
  {
    path: '/ogretmen',
    component: () => import('../views/OgretmenPanel.vue'),
    meta: { requiresAuth: true, role: 'ogretmen' },
  },
  {
    path: '/ogrenci',
    component: () => import('../views/OgrenciPanel.vue'),
    meta: { requiresAuth: true, role: 'ogrenci' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

const modulYenile = 'lgs-modul-yenile'

router.onError((hata) => {
  const mesaj = String(hata?.message || hata)
  if (!/dynamically imported module|module script failed/i.test(mesaj)) return
  if (sessionStorage.getItem(modulYenile)) return
  sessionStorage.setItem(modulYenile, '1')
  window.location.reload()
})

router.afterEach(() => {
  sessionStorage.removeItem(modulYenile)
})

function panelYolu(profil) {
  return profil.tur === 'ogretmen' ? '/ogretmen' : '/ogrenci'
}

router.beforeEach(async (to) => {
  if (to.path === '/auth/callback') return true

  const { data: { session } } = await supabase.auth.getSession()

  if (to.meta.requiresAuth && !session) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (!session) return true

  const profilGerekli = to.meta.requiresAuth || to.path === '/login' || to.path === '/register'
  if (!profilGerekli) return true

  let profil = null
  try {
    profil = await profilGetir(session.user.id)
    if (!profil) profil = await bekleyenKaydiTamamla(session.user)
  } catch {
    if (to.path === '/register') return true
    return '/register'
  }

  if (!profil) {
    if (to.path === '/register') return true
    return '/register'
  }

  if (profil.tur === 'ogrenci' && profil.onay_durumu === false && to.meta.requiresAuth) {
    await supabase.auth.signOut()
    return { path: '/login', query: { hata: 'onay' } }
  }

  if (to.meta.role && to.meta.role !== profil.tur) return panelYolu(profil)
  if (to.path === '/login' || to.path === '/register') return panelYolu(profil)

  return true
})

router.onError((hata) => {
  hataBildir(hata)
})

export default router
