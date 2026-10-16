import { supabase } from '../supabase'
import { FormTemizlemeHatasi, hataMetni } from './hata'
import { sifreDenetle } from './sifre'

const EPOSTA_UYARISI = 'Hesap oluşturuldu ancak oturum açılamadı. E-posta doğrulaması açıksa önce e-postanızı onaylayın.'

const TURKCE_HARFLER = {
  ç: 'c',
  Ç: 'C',
  ğ: 'g',
  Ğ: 'G',
  ı: 'i',
  İ: 'I',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U',
}

function hataFirlat(error, yedek) {
  throw new Error(error?.message || yedek)
}

function ciftKayitMi(error) {
  return error?.code === '23505' || /duplicate|unique/i.test(error?.message || '')
}

export function davetKoduUret(soyad) {
  const sade = String(soyad || '')
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (harf) => TURKCE_HARFLER[harf] || harf)
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
  const onek = (sade + 'XXX').slice(0, 3)
  const baytlar = crypto.getRandomValues(new Uint8Array(2))
  const ek = Array.from(baytlar, (bayt) => bayt.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `${onek}-${ek}`
}

function oturumHatasiFirlat(error) {
  const metin = (error?.message || '').toLowerCase()
  if (!error || metin.includes('not confirmed')) throw new FormTemizlemeHatasi(EPOSTA_UYARISI)
  if (metin.includes('invalid login') || metin.includes('already') || metin.includes('registered')) {
    throw new FormTemizlemeHatasi('Bu e-posta zaten kayıtlı. Giriş yapın.')
  }
  throw new Error(hataMetni(error, 'Oturum açılamadı.'))
}

async function kullaniciyiHazirla({ kullaniciId, eposta, sifre, rol }) {
  if (kullaniciId) {
    try {
      await supabase.auth.updateUser({ data: { role: rol } })
    } catch {
      // Rol bilgisi profil tablosunda durur. Metadata yazılamazsa kayıt sürer.
    }
    return { id: kullaniciId }
  }
  return oturumuHazirla(eposta, sifre, rol)
}

async function oturumuHazirla(eposta, sifre, rol) {
  const sifreSorunu = sifreDenetle(sifre, eposta)
  if (sifreSorunu) throw new Error(sifreSorunu)

  const kayit = await supabase.auth.signUp({
    email: eposta,
    password: sifre,
    options: { data: { role: rol } },
  })

  if (kayit.error) {
    const mesaj = kayit.error.message.toLowerCase()
    const zatenVar = kayit.error.code === 'user_already_exists' || mesaj.includes('already') || mesaj.includes('registered')
    if (!zatenVar) hataFirlat(kayit.error, 'Kayıt oluşturulamadı.')
  }

  let kullanici = kayit.data?.user ?? null
  if (!kayit.data?.session) {
    const giris = await supabase.auth.signInWithPassword({ email: eposta, password: sifre })
    if (giris.error || !giris.data.session) oturumHatasiFirlat(giris.error)
    kullanici = giris.data.user
  }

  if (!kullanici?.id) throw new Error('Kullanıcı kimliği alınamadı.')
  return kullanici
}

export async function okuluKaydetVeyaGetir(il, ilce, okulAdi) {
  const okul = { il, ilce, okul_adi: okulAdi }
  const { data, error } = await supabase.from('okullar').insert(okul).select('id').single()
  if (!error) return data.id

  const mevcut = await supabase
    .from('okullar')
    .select('id')
    .eq('il', il)
    .eq('ilce', ilce)
    .eq('okul_adi', okulAdi)
    .maybeSingle()

  if (mevcut.error || !mevcut.data) hataFirlat(error, 'Okul kaydedilemedi.')
  return mevcut.data.id
}

export async function okullariGetir(il, ilce) {
  const { data, error } = await supabase
    .from('okullar')
    .select('id, okul_adi')
    .eq('il', il)
    .eq('ilce', ilce)
    .order('okul_adi')

  if (error) hataFirlat(error, 'Okullar alınamadı.')
  return data ?? []
}

export async function ogretmenleriGetir(okulId) {
  const { data, error } = await supabase
    .from('ogretmenler')
    .select('id, ad_soyad, brans')
    .eq('okul_id', okulId)
    .order('ad_soyad')

  if (error) hataFirlat(error, 'Öğretmenler alınamadı.')
  return data ?? []
}

export async function davetKodundanOgretmenBul(davetKodu) {
  const kod = davetKodu.trim().toUpperCase()
  const { data, error } = await supabase
    .from('ogretmenler')
    .select('id, okul_id')
    .eq('davet_kodu', kod)
    .maybeSingle()

  if (error) hataFirlat(error, 'Davet kodu sorgulanamadı.')
  return data
}

export async function ogretmenKaydiOlustur({ ad, soyad, eposta, sifre, brans, il, ilce, okulAdi, kullaniciId }) {
  const kullanici = await kullaniciyiHazirla({ kullaniciId, eposta: eposta.trim(), sifre, rol: 'ogretmen' })
  const okulId = await okuluKaydetVeyaGetir(il, ilce, okulAdi.trim())
  let sonHata = null

  for (let deneme = 0; deneme < 3; deneme += 1) {
    const davetKodu = davetKoduUret(soyad)
    const { error } = await supabase.from('ogretmenler').insert({
      id: kullanici.id,
      okul_id: okulId,
      ad_soyad: `${ad.trim()} ${soyad.trim()}`,
      brans: brans.trim(),
      davet_kodu: davetKodu,
    })
    if (!error) return davetKodu
    sonHata = error
    if (!ciftKayitMi(error)) break
  }

  hataFirlat(sonHata, 'Öğretmen kaydı oluşturulamadı.')
}

export async function ogrenciKaydiOlustur({ ad, soyad, eposta, sifre, rumuz, sinif, okulId, danismanId, onayDurumu, kullaniciId }) {
  const kullanici = await kullaniciyiHazirla({ kullaniciId, eposta: eposta.trim(), sifre, rol: 'ogrenci' })
  const { error } = await supabase.from('ogrenciler').insert({
    id: kullanici.id,
    okul_id: okulId,
    danisman_id: danismanId,
    ad_soyad: `${ad.trim()} ${soyad.trim()}`,
    rumuz: rumuz.trim(),
    sinif: String(sinif),
    onay_durumu: onayDurumu,
  })

  if (error) hataFirlat(error, 'Öğrenci kaydı oluşturulamadı.')
}
