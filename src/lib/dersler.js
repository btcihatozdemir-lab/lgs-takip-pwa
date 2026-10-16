export const DERSLER = [
  { kod: 'turkce', ad: 'Türkçe', renk: '#8d4b32' },
  { kod: 'matematik', ad: 'Matematik', renk: '#1e4d3a' },
  { kod: 'fen', ad: 'Fen', renk: '#21596f' },
  { kod: 'inkilap', ad: 'İnkılap', renk: '#6d5424' },
  { kod: 'din', ad: 'Din', renk: '#5a4874' },
  { kod: 'ingilizce', ad: 'İngilizce', renk: '#3c5c49' },
]

export const GUN_METINLERI = ['kitap_adi', 'kitap_yorum', 'kelime', 'kelime_anlam', 'ingilizce_kelime', 'ingilizce_anlam', 'deyim', 'deyim_anlam', 'gun_notu']

export function bosGun() {
  const kayit = {
    deneme: false,
    kitap_sayfa: 0,
    kitap_bitti: false,
    verim: null,
  }
  for (const ders of DERSLER) {
    kayit[`${ders.kod}_soru`] = 0
    kayit[`${ders.kod}_dogru`] = 0
    kayit[`${ders.kod}_yanlis`] = 0
  }
  for (const alan of GUN_METINLERI) kayit[alan] = ''
  return kayit
}

function ceyrek(deger) {
  return Math.round(Number(deger || 0) * 4) / 4
}

export function netHesapla(dogru, yanlis) {
  return ceyrek(Number(dogru || 0) - Number(yanlis || 0) * 0.25)
}

export function netYazi(deger) {
  const sayi = ceyrek(deger)
  if (Number.isInteger(sayi)) return String(sayi)
  return sayi.toFixed(2).replace(/0$/, '')
}

export function gunOzeti(kayit) {
  return DERSLER.reduce(
    (toplam, ders) => {
      toplam.soru += Number(kayit?.[`${ders.kod}_soru`] || 0)
      toplam.net += netHesapla(kayit?.[`${ders.kod}_dogru`], kayit?.[`${ders.kod}_yanlis`])
      return toplam
    },
    { soru: 0, net: 0 },
  )
}

export function isoGun(tarih = new Date()) {
  const yil = tarih.getFullYear()
  const ay = String(tarih.getMonth() + 1).padStart(2, '0')
  const gun = String(tarih.getDate()).padStart(2, '0')
  return `${yil}-${ay}-${gun}`
}

export function gunEkle(iso, fark) {
  const tarih = new Date(`${iso}T12:00:00`)
  tarih.setDate(tarih.getDate() + fark)
  return isoGun(tarih)
}

export function davetBaglantisi(kod) {
  const kok = window.location.origin + import.meta.env.BASE_URL
  const adres = new URL('register', kok)
  adres.searchParams.set('davet', kod)
  return adres.href
}
