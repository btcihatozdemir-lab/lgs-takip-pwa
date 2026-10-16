import { supabase } from '../supabase'
import { DERSLER, GUN_METINLERI, bosGun, gunEkle, isoGun } from '../lib/dersler'

function hazirDegil(hata) {
  const metin = `${hata?.code || ''} ${hata?.message || ''}`
  return metin.includes('PGRST205') || metin.includes('PGRST202') || metin.includes('schema cache')
}

function sutunYok(hata) {
  const metin = `${hata?.code || ''} ${hata?.message || ''}`
  return metin.includes('42703') || metin.includes('does not exist') || metin.includes('schema cache')
}

async function sor(ad, parametre) {
  const { data, error } = await supabase.rpc(ad, parametre)
  if (!error) return data ?? []
  if (hazirDegil(error)) return null
  throw new Error(error.message)
}

export async function ogrenciKart(kullaniciId) {
  const { data, error } = await supabase
    .from('ogrenciler')
    .select('id, okul_id, danisman_id, ad_soyad, rumuz, sinif, onay_durumu, okullar(il, ilce, okul_adi)')
    .eq('id', kullaniciId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function ogretmenKart(kullaniciId) {
  const { data, error } = await supabase
    .from('ogretmenler')
    .select('id, okul_id, ad_soyad, brans, davet_kodu, okullar(il, ilce, okul_adi)')
    .eq('id', kullaniciId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function bugunuGetir(ogrenciId) {
  const tarih = isoGun()
  const { data, error } = await supabase
    .from('gunluk_kayitlar')
    .select('*')
    .eq('ogrenci_id', ogrenciId)
    .eq('tarih', tarih)
    .maybeSingle()
  if (error) {
    if (hazirDegil(error)) return { kayit: bosGun(), hazir: false }
    throw new Error(error.message)
  }
  const kayit = { ...bosGun(), ...(data || {}) }
  for (const alan of GUN_METINLERI) if (kayit[alan] == null) kayit[alan] = ''
  return { kayit, hazir: true }
}

export async function bugunuKaydet(ogrenciId, kayit) {
  const satir = { ...bosGun(), ...kayit, ogrenci_id: ogrenciId, tarih: isoGun() }
  delete satir.id
  const { error } = await supabase.from('gunluk_kayitlar').upsert(satir, { onConflict: 'ogrenci_id,tarih' })
  if (error) throw new Error(hazirDegil(error) ? 'Günlük kayıt tablosu henüz açılmadı.' : error.message)
}

export async function sonYediGun(ogrenciId) {
  const bugun = isoGun()
  const baslangic = gunEkle(bugun, -6)
  const { data, error } = await supabase
    .from('gunluk_kayitlar')
    .select('*')
    .eq('ogrenci_id', ogrenciId)
    .gte('tarih', baslangic)
    .lte('tarih', bugun)
    .order('tarih', { ascending: false })
  if (error) {
    if (hazirDegil(error)) return []
    throw new Error(error.message)
  }
  return data ?? []
}

export async function aylikOzet(ogrenciId) {
  return sor('aylik_ozet', { p_ogrenci: ogrenciId })
}

export async function kitaplar(ogrenciId) {
  const sorgu = (alanlar) => supabase
    .from('kitaplar')
    .select(alanlar)
    .eq('ogrenci_id', ogrenciId)
    .order('bitti_tarihi', { ascending: false })
  let { data, error } = await sorgu('id, ad, yorum, bitti_tarihi')
  if (error && sutunYok(error)) {
    const ikinci = await sorgu('id, ad, bitti_tarihi')
    data = (ikinci.data ?? []).map((kitap) => ({ ...kitap, yorum: '' }))
    error = ikinci.error
  }
  if (error) {
    if (hazirDegil(error)) return []
    throw new Error(error.message)
  }
  return data ?? []
}

export async function kitapEkle(ogrenciId, ad, yorum = '') {
  const temiz = ad.trim()
  const bugun = isoGun()
  const { data: varOlan, error: aramaHatasi } = await supabase
    .from('kitaplar')
    .select('id')
    .eq('ogrenci_id', ogrenciId)
    .eq('ad', temiz)
    .eq('bitti_tarihi', bugun)
    .maybeSingle()
  if (aramaHatasi) throw new Error(hazirDegil(aramaHatasi) ? 'Kitap tablosu henüz açılmadı.' : aramaHatasi.message)
  const not = yorum.trim()
  if (varOlan) {
    if (!not) return
    const { error } = await supabase.from('kitaplar').update({ yorum: not }).eq('id', varOlan.id)
    if (error) throw new Error(sutunYok(error) ? 'Yorum kaydedilemedi. kitaplar tablosunda yorum sütunu yok.' : error.message)
    return
  }
  const satir = { ogrenci_id: ogrenciId, ad: temiz, bitti_tarihi: bugun }
  if (not) satir.yorum = not
  const { error } = await supabase.from('kitaplar').insert(satir)
  if (error && not && sutunYok(error)) {
    const { error: sadeHata } = await supabase.from('kitaplar').insert({ ogrenci_id: ogrenciId, ad: temiz, bitti_tarihi: bugun })
    if (sadeHata) throw new Error(hazirDegil(sadeHata) ? 'Kitap tablosu henüz açılmadı.' : sadeHata.message)
    throw new Error('Kitap eklendi. Yorumu kaydetmek için kitaplar tablosuna yorum sütunu eklenmeli.')
  }
  if (error) throw new Error(hazirDegil(error) ? 'Kitap tablosu henüz açılmadı.' : error.message)
}

export async function okulOgretmenleri(okulId) {
  const { data, error } = await supabase
    .from('ogretmenler')
    .select('id, ad_soyad, brans')
    .eq('okul_id', okulId)
    .order('ad_soyad')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function cetelAlicilari(ogrenciId) {
  const { data, error } = await supabase.from('cetel_alicilar').select('ogretmen_id').eq('ogrenci_id', ogrenciId)
  if (error) {
    if (hazirDegil(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((satir) => satir.ogretmen_id)
}

export async function cetelAlicilariniKaydet(ogrenciId, ogretmenIdleri) {
  const { error: silmeHatasi } = await supabase.from('cetel_alicilar').delete().eq('ogrenci_id', ogrenciId)
  if (silmeHatasi) throw new Error(hazirDegil(silmeHatasi) ? 'Çetele alıcı tablosu henüz açılmadı.' : silmeHatasi.message)
  if (!ogretmenIdleri.length) return
  const { error } = await supabase.from('cetel_alicilar').insert(
    ogretmenIdleri.map((ogretmenId) => ({ ogrenci_id: ogrenciId, ogretmen_id: ogretmenId })),
  )
  if (error) throw new Error(error.message)
}

export async function liderlik(sinif, il, olcut) {
  return sor('liderlik', { p_sinif: String(sinif), p_il: il, p_olcut: olcut })
}

export async function danismaniBul(kod) {
  const { data, error } = await supabase
    .from('ogretmenler')
    .select('id, ad_soyad, brans, okul_id')
    .eq('davet_kodu', kod.trim().toUpperCase())
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function rumuzKontrol(rumuz) {
  const temiz = String(rumuz || '').trim()
  if (!temiz) throw new Error('Rumuz yaz.')
  const { data, error } = await supabase.rpc('rumuz_musait', { p_rumuz: temiz })
  if (error) {
    if (hazirDegil(error)) return temiz
    throw new Error(error.message)
  }
  if (data === false) throw new Error('Bu rumuz kullanılıyor. Başka bir rumuz seç.')
  return temiz
}

export async function ogrenciBilgisiGuncelle(ogrenciId, alanlar) {
  const { error } = await supabase.from('ogrenciler').update(alanlar).eq('id', ogrenciId)
  if (error?.code === '23505') throw new Error('Bu rumuz kullanılıyor. Başka bir rumuz seç.')
  if (error) throw new Error(error.message)
}

export async function ogretmenBilgisiGuncelle(ogretmenId, alanlar) {
  const { error } = await supabase.from('ogretmenler').update(alanlar).eq('id', ogretmenId)
  if (error) throw new Error(error.message)
}

export async function okulBilgisiGuncelle(okulId, alanlar) {
  const { error } = await supabase.from('okullar').update(alanlar).eq('id', okulId)
  if (error) throw new Error(error.message || 'Okul bilgisi güncellenemedi.')
}

export async function kayitTarihleri(ogrenciIdleri) {
  if (!ogrenciIdleri.length) return []
  const { data, error } = await supabase
    .from('gunluk_kayitlar')
    .select('ogrenci_id, tarih')
    .in('ogrenci_id', ogrenciIdleri)
  if (error) {
    if (hazirDegil(error)) return []
    throw new Error(error.message)
  }
  return data ?? []
}

export async function aralikKayitlari(ogrenciIdleri, baslangic, bitis) {
  if (!ogrenciIdleri.length) return []
  const { data, error } = await supabase
    .from('gunluk_kayitlar')
    .select('*')
    .in('ogrenci_id', ogrenciIdleri)
    .gte('tarih', baslangic)
    .lte('tarih', bitis)
  if (error) {
    if (hazirDegil(error)) return []
    throw new Error(error.message)
  }
  return data ?? []
}

export async function okulOgrencileri(okulId) {
  const { data, error } = await supabase
    .from('ogrenciler')
    .select('id, ad_soyad, rumuz, sinif, onay_durumu, danisman_id')
    .eq('okul_id', okulId)
    .order('ad_soyad')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function haftalikCeteler(ogrenciIdleri) {
  if (!ogrenciIdleri.length) return []
  const { data, error } = await supabase
    .from('gunluk_kayitlar')
    .select('*')
    .in('ogrenci_id', ogrenciIdleri)
    .gte('tarih', gunEkle(isoGun(), -6))
  if (error) {
    if (hazirDegil(error)) return []
    throw new Error(error.message)
  }
  return data ?? []
}

export async function okulOzet(okulId) {
  const sonuc = await sor('okul_ozet', { p_okul: okulId })
  return sonuc?.[0] ?? null
}

export async function bolgeOzet(il, ilce) {
  const sonuc = await sor('bolge_ozet', { p_il: il, p_ilce: ilce })
  return sonuc?.[0] ?? null
}

export async function dersOzet(okulId) {
  return sor('ders_ozet', { p_okul: okulId })
}

export function dersToplamlari(kayitlar) {
  return DERSLER.map((ders) => {
    const soru = kayitlar.reduce((t, kayit) => t + Number(kayit[`${ders.kod}_soru`] || 0), 0)
    const net = kayitlar.reduce(
      (t, kayit) => t + Number(kayit[`${ders.kod}_dogru`] || 0) - Number(kayit[`${ders.kod}_yanlis`] || 0) / 3,
      0,
    )
    return { ad: ders.ad, soru, net: Math.round(net * 10) / 10 }
  })
}
