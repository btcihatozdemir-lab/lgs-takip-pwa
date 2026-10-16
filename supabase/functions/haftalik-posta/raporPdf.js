import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, rgb } from 'pdf-lib'
import { DERSLER, trSayi } from './raporVerisi.js'

const YESIL = rgb(0.12, 0.3, 0.23)
const KAGIT = rgb(0.973, 0.957, 0.925)
const SATIR = rgb(0.992, 0.984, 0.965)
const CIZGI = rgb(0.82, 0.78, 0.7)
const MUREKKEP = rgb(0.11, 0.14, 0.12)
const SOLUK = rgb(0.45, 0.42, 0.38)
const BEYAZ = rgb(1, 1, 1)
const KIL = rgb(0.604, 0.294, 0.184)

function renk(dizi) {
  return rgb(dizi[0], dizi[1], dizi[2])
}

function genislik(font, metin, boyut) {
  return font.widthOfTextAtSize(String(metin), boyut)
}

function yazi(page, metin, x, y, boyut, font, renkDegeri, hiza, kutu) {
  const metinGenisligi = genislik(font, metin, boyut)
  let sol = x
  if (hiza === 'orta') sol = x + (kutu - metinGenisligi) / 2
  if (hiza === 'sag') sol = x + kutu - metinGenisligi
  page.drawText(String(metin), { x: sol, y, size: boyut, font, color: renkDegeri })
}

function cerceve(page, x, y, w, h, dolgu, cizgi = CIZGI) {
  page.drawRectangle({ x, y, width: w, height: h, color: dolgu, borderColor: cizgi, borderWidth: 0.4 })
}

function tarihYazi(iso) {
  const [yil, ay, gun] = iso.split('-')
  return `${gun}.${ay}.${yil}`
}

export async function haftalikPdf(rapor, yazitipleri) {
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(`${rapor.adSoyad} haftalık çizelge`)
  pdf.setAuthor('LGS Günlük Takip')
  const font = await pdf.embedFont(yazitipleri.normal, { subset: true })
  const kalin = await pdf.embedFont(yazitipleri.kalin, { subset: true })
  const sayfa = pdf.addPage([841.89, 595.28])
  sayfa.drawRectangle({ x: 0, y: 0, width: 841.89, height: 595.28, color: KAGIT })
  cizBaslik(sayfa, rapor, font, kalin)
  const tabloAlt = cizTablo(sayfa, rapor, font, kalin)
  const ozetAlt = cizOzet(sayfa, rapor, font, kalin, tabloAlt - 12)
  cizGrafikler(sayfa, rapor, font, kalin, 16, ozetAlt - 12)
  return pdf.save()
}

function cizBaslik(sayfa, rapor, font, kalin) {
  sayfa.drawRectangle({ x: 0, y: 548, width: 841.89, height: 47.28, color: YESIL })
  yazi(sayfa, rapor.adSoyad, 22, 566, 16, kalin, BEYAZ, 'sol', 400)
  yazi(sayfa, 'Haftalık çalışma çizelgesi', 22, 554, 8, font, rgb(0.82, 0.9, 0.84), 'sol', 300)
  yazi(sayfa, `Başlangıç  ${tarihYazi(rapor.baslangic)}`, 560, 570, 9, kalin, BEYAZ, 'sol', 250)
  yazi(sayfa, `Bitiş  ${tarihYazi(rapor.bitis)}`, 560, 556, 9, kalin, BEYAZ, 'sol', 250)
}

function sutunlar() {
  const dersGenislik = 31
  const liste = [{ anahtar: 'tarih', genislik: 78 }]
  for (const ders of DERSLER) {
    for (const alan of ['dogru', 'yanlis', 'net']) {
      liste.push({ anahtar: `${ders.kod}_${alan}`, ders: ders.kod, alan, genislik: dersGenislik })
    }
  }
  liste.push({ anahtar: 'soru', genislik: 42 })
  liste.push({ anahtar: 'net', genislik: 42 })
  liste.push({ anahtar: 'deneme', genislik: 46 })
  liste.push({ anahtar: 'sayfa', genislik: 40 })
  return liste
}

function cizTablo(sayfa, rapor, font, kalin) {
  const kolonlar = sutunlar()
  const sol = 18
  const ust = 536
  const baslik1 = 18
  const baslik2 = 14
  const satir = 16
  const toplamGenislik = kolonlar.reduce((toplam, kolon) => toplam + kolon.genislik, 0)
  let x = sol
  const gruplar = new Map()
  for (const kolon of kolonlar) {
    if (kolon.ders) {
      if (!gruplar.has(kolon.ders)) gruplar.set(kolon.ders, { x, genislik: 0 })
      gruplar.get(kolon.ders).genislik += kolon.genislik
    }
    x += kolon.genislik
  }

  for (const ders of DERSLER) {
    const grup = gruplar.get(ders.kod)
    cerceve(sayfa, grup.x, ust - baslik1, grup.genislik, baslik1, renk(ders.renk), renk(ders.renk))
    yazi(sayfa, ders.ad, grup.x, ust - baslik1 + 5, 8, kalin, BEYAZ, 'orta', grup.genislik)
  }
  const tekler = [
    ['tarih', 'Tarih'],
    ['soru', 'Soru'],
    ['net', 'Net'],
    ['deneme', 'Deneme'],
    ['sayfa', 'Sayfa'],
  ]
  x = sol
  for (const kolon of kolonlar) {
    if (!kolon.ders) {
      const etiket = tekler.find((cift) => cift[0] === kolon.anahtar)[1]
      cerceve(sayfa, x, ust - baslik1 - baslik2, kolon.genislik, baslik1 + baslik2, YESIL, YESIL)
      yazi(sayfa, etiket, x, ust - baslik1 - baslik2 + 12, 7.5, kalin, BEYAZ, 'orta', kolon.genislik)
    } else {
      const kisa = kolon.alan === 'dogru' ? 'D' : kolon.alan === 'yanlis' ? 'Y' : 'N'
      cerceve(sayfa, x, ust - baslik1 - baslik2, kolon.genislik, baslik2, rgb(0.96, 0.94, 0.9), CIZGI)
      yazi(sayfa, kisa, x, ust - baslik1 - baslik2 + 4, 8, kalin, MUREKKEP, 'orta', kolon.genislik)
    }
    x += kolon.genislik
  }

  rapor.gunler.forEach((gun, index) => {
    const y = ust - baslik1 - baslik2 - (index + 1) * satir
    const zemin = index % 2 ? SATIR : BEYAZ
    x = sol
    for (const kolon of kolonlar) {
      cerceve(sayfa, x, y, kolon.genislik, satir, zemin)
      const deger = hucreDegeri(gun, kolon)
      const bos = deger === '0' || deger === '0,0'
      yazi(sayfa, deger, x, y + 4.5, 7.5, font, bos ? SOLUK : MUREKKEP, 'orta', kolon.genislik)
      x += kolon.genislik
    }
  })

  const toplamY = ust - baslik1 - baslik2 - 8 * satir
  x = sol
  const toplamlar = toplamSatiri(rapor)
  for (const kolon of kolonlar) {
    cerceve(sayfa, x, toplamY, kolon.genislik, satir, rgb(0.9, 0.93, 0.9), YESIL)
    yazi(sayfa, toplamlar[kolon.anahtar] ?? '', x, toplamY + 4.5, 7.5, kalin, YESIL, 'orta', kolon.genislik)
    x += kolon.genislik
  }
  return toplamY
}

function hucreDegeri(gun, kolon) {
  if (kolon.anahtar === 'tarih') return `${gun.kisa} ${gun.gun}`
  if (kolon.anahtar === 'soru') return String(gun.soru)
  if (kolon.anahtar === 'net') return trSayi(gun.net)
  if (kolon.anahtar === 'deneme') return gun.deneme ? 'Evet' : 'Hayır'
  if (kolon.anahtar === 'sayfa') return String(gun.sayfa)
  const [kod, alan] = [kolon.ders, kolon.alan]
  const deger = gun.dersler[kod][alan]
  return alan === 'net' ? trSayi(deger) : String(deger)
}

function toplamSatiri(rapor) {
  const satir = { tarih: 'Toplam', soru: String(rapor.toplamSoru), net: rapor.netYazi, deneme: '', sayfa: String(rapor.toplamSayfa) }
  for (const ders of DERSLER) {
    for (const alan of ['dogru', 'yanlis', 'net']) {
      const toplam = rapor.gunler.reduce((sayi, gun) => sayi + gun.dersler[ders.kod][alan], 0)
      satir[`${ders.kod}_${alan}`] = alan === 'net' ? trSayi(toplam) : String(toplam)
    }
  }
  return satir
}

function cizOzet(sayfa, rapor, font, kalin, ust) {
  const kutular = [
    ['Toplam çözülen soru', String(rapor.toplamSoru)],
    ['Toplam net', rapor.netYazi],
    ['Başarı', `% ${rapor.basariYazi}`],
    ['7 günlük ortalama', rapor.ortalamaYazi],
    ['Okunan sayfa', String(rapor.toplamSayfa)],
  ]
  const sol = 18
  const aralik = 8
  const genislikKutu = (841.89 - 36 - aralik * 4) / 5
  const yukseklik = 46
  kutular.forEach((kutu, index) => {
    const x = sol + index * (genislikKutu + aralik)
    const y = ust - yukseklik
    cerceve(sayfa, x, y, genislikKutu, yukseklik, BEYAZ)
    yazi(sayfa, kutu[0], x, y + 30, 7.5, font, SOLUK, 'orta', genislikKutu)
    yazi(sayfa, kutu[1], x, y + 10, 16, kalin, YESIL, 'orta', genislikKutu)
  })
  yazi(sayfa, 'D doğru, Y yanlış, N net. Başarı, doğru sayısının çözülen soruya oranıdır. Net = doğru − yanlış × 0,25.', 18, ust - yukseklik - 12, 7, font, SOLUK, 'sol', 760)
  return ust - yukseklik - 16
}

function cizGrafikler(sayfa, rapor, font, kalin, alt, ust) {
  const yukseklik = ust - alt
  if (yukseklik < 120) return
  const sol = 18
  const aralik = 14
  const genislik = (841.89 - 36 - aralik) / 2
  cubukGrafik(sayfa, rapor, font, kalin, sol, alt, genislik, yukseklik)
  tempoGrafik(sayfa, rapor, font, kalin, sol + genislik + aralik, alt, genislik, yukseklik)
}

function cubukGrafik(sayfa, rapor, font, kalin, x, y, w, h) {
  cerceve(sayfa, x, y, w, h, BEYAZ)
  yazi(sayfa, 'Günlük ders dağılımı', x + 10, y + h - 16, 9, kalin, MUREKKEP, 'sol', w)
  const cizim = { x: x + 28, y: y + 36, w: w - 40, h: h - 70 }
  const tavan = Math.max(1, ...rapor.gunler.map((gun) => gun.soru))
  eksen(sayfa, font, cizim, tavan)
  const dilim = cizim.w / rapor.gunler.length
  rapor.gunler.forEach((gun, index) => {
    let taban = cizim.y
    for (const ders of DERSLER) {
      const soru = gun.dersler[ders.kod].soru
      const boy = (soru / tavan) * (cizim.h - 8)
      if (boy > 0) {
        sayfa.drawRectangle({ x: cizim.x + index * dilim + 8, y: taban, width: dilim - 16, height: boy, color: renk(ders.renk) })
        taban += boy
      }
    }
    yazi(sayfa, gun.gun, cizim.x + index * dilim, cizim.y - 12, 7, font, SOLUK, 'orta', dilim)
  })
  DERSLER.forEach((ders, index) => {
    const lx = x + 12 + index * ((w - 20) / 6)
    const ly = y + 8
    sayfa.drawRectangle({ x: lx, y: ly, width: 7, height: 7, color: renk(ders.renk) })
    yazi(sayfa, ders.ad, lx + 9, ly + 0.5, 6.5, font, SOLUK, 'sol', 48)
  })
}

function tempoGrafik(sayfa, rapor, font, kalin, x, y, w, h) {
  cerceve(sayfa, x, y, w, h, BEYAZ)
  yazi(sayfa, 'Soru ve kitap okuma temposu', x + 10, y + h - 16, 9, kalin, MUREKKEP, 'sol', w)
  const cizim = { x: x + 28, y: y + 36, w: w - 52, h: h - 70 }
  const soruTavan = Math.max(1, ...rapor.gunler.map((gun) => gun.soru))
  const sayfaTavan = Math.max(1, ...rapor.gunler.map((gun) => gun.sayfa))
  eksen(sayfa, font, cizim, soruTavan)
  yazi(sayfa, String(sayfaTavan), cizim.x + cizim.w + 4, cizim.y + cizim.h - 14, 7, font, KIL, 'sol', 24)
  const dilim = cizim.w / rapor.gunler.length
  const noktalar = []
  rapor.gunler.forEach((gun, index) => {
    const boy = (gun.soru / soruTavan) * (cizim.h - 8)
    sayfa.drawRectangle({
      x: cizim.x + index * dilim + 10,
      y: cizim.y,
      width: dilim * 0.42,
      height: Math.max(boy, 0),
      color: rgb(0.29, 0.52, 0.67),
    })
    const py = cizim.y + (gun.sayfa / sayfaTavan) * (cizim.h - 8)
    noktalar.push({ x: cizim.x + index * dilim + dilim / 2, y: py })
    yazi(sayfa, gun.gun, cizim.x + index * dilim, cizim.y - 12, 7, font, SOLUK, 'orta', dilim)
  })
  for (let index = 1; index < noktalar.length; index += 1) {
    sayfa.drawLine({
      start: noktalar[index - 1],
      end: noktalar[index],
      thickness: 1.4,
      color: KIL,
    })
  }
  for (const nokta of noktalar) {
    sayfa.drawCircle({ x: nokta.x, y: nokta.y, size: 2.2, color: KIL })
  }
  sayfa.drawRectangle({ x: x + 10, y: y + 8, width: 7, height: 7, color: rgb(0.29, 0.52, 0.67) })
  yazi(sayfa, 'Günlük soru', x + 20, y + 8, 6.5, font, SOLUK, 'sol', 70)
  sayfa.drawRectangle({ x: x + 92, y: y + 8, width: 7, height: 7, color: KIL })
  yazi(sayfa, 'Kitap sayfası', x + 102, y + 8, 6.5, font, SOLUK, 'sol', 80)
}

function eksen(sayfa, font, cizim, tavan) {
  sayfa.drawLine({ start: { x: cizim.x, y: cizim.y }, end: { x: cizim.x, y: cizim.y + cizim.h }, thickness: 0.6, color: CIZGI })
  sayfa.drawLine({ start: { x: cizim.x, y: cizim.y }, end: { x: cizim.x + cizim.w, y: cizim.y }, thickness: 0.6, color: CIZGI })
  yazi(sayfa, String(tavan), cizim.x - 26, cizim.y + cizim.h - 12, 7, font, SOLUK, 'sag', 24)
  yazi(sayfa, '0', cizim.x - 26, cizim.y, 7, font, SOLUK, 'sag', 24)
}
