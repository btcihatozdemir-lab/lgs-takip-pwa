import { supabase } from '../supabase'
import { hataMetni } from './hata'
import { profilGetir } from './profil'

const AMAC_ANAHTARI = 'lgs_google_amac'

export async function googleIleBasla(amac) {
  const ayar = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
  })
  if (ayar.ok) {
    const govde = await ayar.json()
    if (!govde?.external?.google) {
      throw new Error('Google ile giriş Supabase projesinde kapalı. Authentication, Providers, Google bölümünden açın ve yönlendirme adresine bu sitenin /auth/callback yolunu ekleyin.')
    }
  }

  sessionStorage.setItem(AMAC_ANAHTARI, amac)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('auth/callback', window.location.origin + import.meta.env.BASE_URL).href,
      queryParams: { prompt: 'select_account' },
    },
  })
  if (error) throw new Error(hataMetni(error, 'Google ile bağlantı kurulamadı.'))
}

export async function googleOturumunuAl() {
  const adres = new URL(window.location.href)
  const saglayiciHatasi = adres.searchParams.get('error_description') || adres.searchParams.get('error')
  if (saglayiciHatasi) throw new Error(decodeURIComponent(saglayiciHatasi.replace(/\+/g, ' ')))

  const kod = adres.searchParams.get('code')
  if (kod) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(kod)
    if (error) throw new Error(hataMetni(error, 'Google oturumu açılamadı.'))
    return data.session
  }

  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(hataMetni(error, 'Oturum okunamadı.'))
  return data.session
}

export function googleAmaciniAl() {
  const amac = sessionStorage.getItem(AMAC_ANAHTARI)
  sessionStorage.removeItem(AMAC_ANAHTARI)
  return amac
}

export async function oturumYonlendirmeHedefi(oturum) {
  if (!oturum?.user) return { yol: '/login' }

  const profil = await profilGetir(oturum.user.id)
  if (!profil) return { yol: '/register', profilYok: true }
  if (profil.tur === 'ogrenci' && profil.onay_durumu === false) return { yol: '/login', hata: 'onay' }
  return { yol: profil.tur === 'ogretmen' ? '/ogretmen' : '/ogrenci' }
}
