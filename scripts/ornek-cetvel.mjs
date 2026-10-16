import { readFile, writeFile } from 'node:fs/promises'
import { gecenHafta, raporHazirla } from '../supabase/functions/haftalik-posta/raporVerisi.js'
import { haftalikPdf } from '../supabase/functions/haftalik-posta/raporPdf.js'

const hafta = gecenHafta(new Date('2026-10-19T05:00:00Z'))
if (hafta.baslangic !== '2026-10-12' || hafta.bitis !== '2026-10-18') {
  throw new Error(`Hafta aralığı yanlış: ${hafta.baslangic} ${hafta.bitis}`)
}

const kayitlar = [
  gun('2026-10-12', { turkce: [20, 16, 2], matematik: [15, 10, 4], fen: [10, 7, 2], sayfa: 30 }),
  gun('2026-10-13', { turkce: [40, 32, 4], matematik: [25, 18, 4], fen: [20, 14, 4], inkilap: [15, 12, 2], deneme: true, sayfa: 40 }),
  gun('2026-10-14', { turkce: [10, 8, 1], din: [10, 9, 0], ingilizce: [12, 10, 1], sayfa: 20 }),
  gun('2026-10-15', { matematik: [30, 21, 4], fen: [18, 12, 3], sayfa: 35 }),
  gun('2026-10-16', { turkce: [25, 20, 2], inkilap: [20, 14, 4], ingilizce: [15, 11, 2], sayfa: 25 }),
]

function gun(tarih, alanlar) {
  const satir = { tarih, deneme: Boolean(alanlar.deneme), kitap_sayfa: alanlar.sayfa || 0 }
  for (const ders of ['turkce', 'matematik', 'fen', 'inkilap', 'din', 'ingilizce']) {
    const [soru, dogru, yanlis] = alanlar[ders] || [0, 0, 0]
    satir[`${ders}_soru`] = soru
    satir[`${ders}_dogru`] = dogru
    satir[`${ders}_yanlis`] = yanlis
  }
  return satir
}

const rapor = raporHazirla({
  adSoyad: 'Ömer Asaf Özdemir',
  kayitlar,
  baslangic: hafta.baslangic,
  bitis: hafta.bitis,
})

if (rapor.gunler.length !== 7) throw new Error('Yedi gün değil')
if (rapor.gunler[0].gun !== 'Pzt' || rapor.gunler[6].gun !== 'Paz') throw new Error('Hafta pazartesi başlamıyor')
if (rapor.gunler[5].soru !== 0 || rapor.gunler[6].sayfa !== 0) throw new Error('Boş gün sıfır değil')
if (rapor.gunler[0].dersler.turkce.net !== 15.5) throw new Error(`Net yanlış: ${rapor.gunler[0].dersler.turkce.net}`)

const normal = await readFile(new URL('../supabase/functions/haftalik-posta/font/DejaVuSans.ttf', import.meta.url))
const kalin = await readFile(new URL('../supabase/functions/haftalik-posta/font/DejaVuSans-Bold.ttf', import.meta.url))
const pdf = await haftalikPdf(rapor, { normal, kalin })
const hedef = '/tmp/ornek-cetvel.pdf'
await writeFile(hedef, pdf)
console.log(hedef, rapor.toplamSoru, rapor.netYazi, rapor.basariYazi, rapor.ortalamaYazi, rapor.toplamSayfa)
