import { supabase } from '../supabase'
import { rumuzKontrol } from './calisma'
import { FormTemizlemeHatasi, hataMetni } from './hata'
import { profilGetir } from './profil'
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

function onayAdresi() {
  return new URL('./', window.location.origin + import.meta.env.BASE_URL).href
}

async function kullaniciyiHazirla({ kullaniciId, eposta, sifre, rol, kayitBilgisi }) {
  if (kullaniciId) {
    try {
      await supabase.auth.updateUser({ data: { role: rol, kayit: kayitBilgisi } })
    } catch {
      // Rol bilgisi profil tablosunda durur. Metadata yazılamazsa kayıt sürer.
    }
    return { id: kullaniciId }
  }
  return oturumuHazirla(eposta, sifre, rol, kayitBilgisi)
}

async function oturumuHazirla(eposta, sifre, rol, kayitBilgisi) {
  const sifreSorunu = sifreDenetle(sifre, eposta)
  if (sifreSorunu) throw new Error(sifreSorunu)

  const kayit = await supabase.auth.signUp({
    email: eposta,
    password: sifre,
    options: {
      emailRedirectTo: onayAdresi(),
      data: { role: rol, kayit: kayitBilgisi },
    },
  })

  if (kayit.error) {
    const mesaj = kayit.error.message.toLowerCase()
    const zatenVar = kayit.error.code === 'user_already_exists' || mesaj.includes('already') || mesaj.includes('registered')
    if (!zatenVar) hataFirlat(kayit.error, 'Kayıt oluşturulamadı.')
  }

  let kullanici = kayit.data?.user ?? null
  if (!kayit.data?.session) {
    const giris = await supabase.auth.signInWithPassword({ email: eposta, password: sifre })
    if (giris.error || !giris.data.session) {
      const metin = (giris.error?.message || '').toLowerCase()
      if (!giris.error || metin.includes('not confirmed')) {
        throw new FormTemizlemeHatasi('Hesap oluşturuldu. E-postandaki onay bağlantısına bas. Onaydan sonra kayıt tamamlanır.')
      }
      oturumHatasiFirlat(giris.error)
    }
    kullanici = giris.data.user
  }

  if (!kullanici?.id) throw new Error('Kullanıcı kimliği alınamadı.')
  return kullanici
}

export function okulAdiAnahtar(ad) {
  return String(ad || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR')
}

export async function okuluKaydetVeyaGetir(il, ilce, okulAdi) {
  const ad = String(okulAdi || '').trim().replace(/\s+/g, ' ')
  if (!ad) throw new Error('Okul adı yaz.')
  const anahtar = okulAdiAnahtar(ad)
  const liste = await okullariGetir(il, ilce)
  const mevcut = liste.find((okul) => okulAdiAnahtar(okul.okul_adi) === anahtar)
  if (mevcut) return mevcut.id

  const { data, error } = await supabase.from('okullar').insert({ il, ilce, okul_adi: ad }).select('id').single()
  if (!error) return data.id

  const yeniden = await okullariGetir(il, ilce)
  const ikinci = yeniden.find((okul) => okulAdiAnahtar(okul.okul_adi) === anahtar)
  if (ikinci) return ikinci.id
  hataFirlat(error, 'Okul kaydedilemedi.')
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

export async function bekleyenKaydiTamamla(kullanici) {
  if (!kullanici?.id) return null
  const varOlan = await profilGetir(kullanici.id)
  if (varOlan) return varOlan

  const kayit = kullanici.user_metadata?.kayit
  const rol = kullanici.user_metadata?.role
  if (!kayit || (rol !== 'ogretmen' && rol !== 'ogrenci')) return null

  if (rol === 'ogretmen') {
    await ogretmenKaydiOlustur({
      ad: kayit.ad,
      soyad: kayit.soyad,
      brans: kayit.brans,
      il: kayit.il,
      ilce: kayit.ilce,
      okulAdi: kayit.okulAdi,
      kullaniciId: kullanici.id,
    })
  } else {
    await ogrenciKaydiOlustur({
      ad: kayit.ad,
      soyad: kayit.soyad,
      rumuz: kayit.rumuz,
      sinif: kayit.sinif,
      okulId: kayit.okulId,
      danismanId: kayit.danismanId,
      onayDurumu: kayit.onayDurumu,
      davetKodu: kayit.davetKodu,
      kullaniciId: kullanici.id,
    })
  }

  return profilGetir(kullanici.id)
}

export async function onayMektubunuYenidenGonder(eposta) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: eposta.trim(),
    options: { emailRedirectTo: onayAdresi() },
  })
  if (error) hataFirlat(error, 'Onay mektubu gönderilemedi.')
}

export async function ogretmenKaydiOlustur({ ad, soyad, eposta, sifre, brans, il, ilce, okulAdi, kullaniciId }) {
  const kullanici = await kullaniciyiHazirla({
    kullaniciId,
    eposta: eposta?.trim(),
    sifre,
    rol: 'ogretmen',
    kayitBilgisi: { ad, soyad, brans, il, ilce, okulAdi },
  })
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

export async function ogrenciKaydiOlustur({ ad, soyad, eposta, sifre, rumuz, sinif, okulId, danismanId, onayDurumu, davetKodu, kullaniciId }) {
  const tekilRumuz = await rumuzKontrol(rumuz)
  const kullanici = await kullaniciyiHazirla({
    kullaniciId,
    eposta: eposta?.trim(),
    sifre,
    rol: 'ogrenci',
    kayitBilgisi: { ad, soyad, rumuz: tekilRumuz, sinif, okulId, danismanId, onayDurumu, davetKodu },
  })
  const { error } = await supabase.from('ogrenciler').insert({
    id: kullanici.id,
    okul_id: okulId,
    danisman_id: danismanId,
    ad_soyad: `${ad.trim()} ${soyad.trim()}`,
    rumuz: tekilRumuz,
    sinif: String(sinif),
    onay_durumu: onayDurumu,
  })

  if (error && /rumuz/i.test(`${error.message || ''} ${error.details || ''}`)) {
    throw new Error('Bu rumuz kullanılıyor. Başka bir rumuz seç.')
  }
  if (error) hataFirlat(error, 'Öğrenci kaydı oluşturulamadı.')
}
