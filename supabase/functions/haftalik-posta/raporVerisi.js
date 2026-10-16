export const DERSLER = [
  { kod: 'turkce', ad: 'Türkçe', renk: [0.553, 0.294, 0.196] },
  { kod: 'matematik', ad: 'Matematik', renk: [0.118, 0.302, 0.227] },
  { kod: 'fen', ad: 'Fen', renk: [0.129, 0.349, 0.435] },
  { kod: 'inkilap', ad: 'İnkılap', renk: [0.427, 0.329, 0.141] },
  { kod: 'din', ad: 'Din', renk: [0.353, 0.282, 0.455] },
  { kod: 'ingilizce', ad: 'İngilizce', renk: [0.235, 0.361, 0.286] },
]

const GUN_KISA = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const GUN_UZUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

function ceyrek(deger) {
  return Math.round(Number(deger || 0) * 4) / 4
}

export function netHesapla(dogru, yanlis) {
  return ceyrek(Number(dogru || 0) - Number(yanlis || 0) * 0.25)
}

export function istanbulGunu(simdi = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(simdi)
}

export function tarihEkle(iso, fark) {
  const [yil, ay, gun] = iso.split('-').map(Number)
  const tarih = new Date(Date.UTC(yil, ay - 1, gun))
  tarih.setUTCDate(tarih.getUTCDate() + fark)
  return tarih.toISOString().slice(0, 10)
}

export function haftaGunu(iso) {
  const [yil, ay, gun] = iso.split('-').map(Number)
  return (new Date(Date.UTC(yil, ay - 1, gun)).getUTCDay() + 6) % 7
}

export function gecenHafta(simdi = new Date()) {
  const bugun = istanbulGunu(simdi)
  const pazartesi = tarihEkle(bugun, -haftaGunu(bugun))
  const baslangic = tarihEkle(pazartesi, -7)
  const bitis = tarihEkle(baslangic, 6)
  return { baslangic, bitis }
}

function trSayi(deger) {
  const sayi = Math.round(Number(deger || 0) * 100) / 100
  if (Number.isInteger(sayi)) return String(sayi)
  return sayi.toFixed(2).replace(/0$/, '').replace('.', ',')
}

export function raporHazirla({ adSoyad, kayitlar, baslangic, bitis }) {
  const harita = new Map((kayitlar || []).map((kayit) => [String(kayit.tarih).slice(0, 10), kayit]))
  const gunler = Array.from({ length: 7 }, (_, index) => {
    const tarih = tarihEkle(baslangic, index)
    const kayit = harita.get(tarih)
    const dersler = {}
    let soru = 0
    let dogru = 0
    let net = 0
    for (const ders of DERSLER) {
      const satir = {
        soru: Number(kayit?.[`${ders.kod}_soru`] || 0),
        dogru: Number(kayit?.[`${ders.kod}_dogru`] || 0),
        yanlis: Number(kayit?.[`${ders.kod}_yanlis`] || 0),
      }
      satir.net = netHesapla(satir.dogru, satir.yanlis)
      dersler[ders.kod] = satir
      soru += satir.soru
      dogru += satir.dogru
      net += satir.net
    }
    const parca = tarih.split('-')
    return {
      tarih,
      kisa: `${parca[2]}.${parca[1]}`,
      gun: GUN_KISA[index],
      uzun: GUN_UZUN[index],
      dersler,
      soru,
      dogru,
      net: ceyrek(net),
      deneme: Boolean(kayit?.deneme),
      sayfa: Number(kayit?.kitap_sayfa || 0),
    }
  })

  const toplamSoru = gunler.reduce((toplam, gun) => toplam + gun.soru, 0)
  const toplamDogru = gunler.reduce((toplam, gun) => toplam + gun.dogru, 0)
  const toplamNet = ceyrek(gunler.reduce((toplam, gun) => toplam + gun.net, 0))
  const toplamSayfa = gunler.reduce((toplam, gun) => toplam + gun.sayfa, 0)
  const basari = toplamSoru ? Math.trunc((toplamDogru / toplamSoru) * 1000) / 10 : 0
  const ortalama = Math.trunc((toplamSoru / 7) * 10) / 10

  return {
    adSoyad,
    baslangic,
    bitis,
    gunler,
    toplamSoru,
    toplamDogru,
    toplamNet,
    toplamSayfa,
    basari,
    ortalama,
    basariYazi: trSayi(basari),
    ortalamaYazi: trSayi(ortalama),
    netYazi: trSayi(toplamNet),
  }
}

export { trSayi }
