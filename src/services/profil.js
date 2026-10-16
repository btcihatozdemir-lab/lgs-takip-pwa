import { supabase } from '../supabase'

export async function profilGetir(kullaniciId) {
  const { data: ogretmen, error: ogretmenHatasi } = await supabase
    .from('ogretmenler')
    .select('id')
    .eq('id', kullaniciId)
    .maybeSingle()

  if (ogretmenHatasi) throw new Error(ogretmenHatasi.message)
  if (ogretmen) return { tur: 'ogretmen' }

  const { data: ogrenci, error: ogrenciHatasi } = await supabase
    .from('ogrenciler')
    .select('id, onay_durumu')
    .eq('id', kullaniciId)
    .maybeSingle()

  if (ogrenciHatasi) throw new Error(ogrenciHatasi.message)
  if (ogrenci) return { tur: 'ogrenci', onay_durumu: ogrenci.onay_durumu }

  return null
}
