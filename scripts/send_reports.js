import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { PDFDocument } from 'pdf-lib'
import { haftalikPdf } from '../supabase/functions/haftalik-posta/raporPdf.js'
import { gecenHafta, raporHazirla } from '../supabase/functions/haftalik-posta/raporVerisi.js'

const execFileAsync = promisify(execFile)

class BosSoket {
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

function gerekli(ad) {
  const deger = process.env[ad]
  if (!deger) throw new Error(`${ad} tanımlı değil. GitHub Secrets içine ekleyin.`)
  return deger
}

function kacis(metin) {
  return String(metin ?? '').replace(/[&<>"']/g, (karakter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[karakter])
}

export function htmlRapor(ogretmenAd, raporlar, hafta) {
  const bloklar = raporlar.map((rapor, index) => `
    <h2 style="margin:28px 0 8px;font-size:18px;">${kacis(rapor.adSoyad)}</h2>
    <img src="cid:cetvel-${index}" alt="${kacis(rapor.adSoyad)} haftalık çizelge" style="width:100%;max-width:980px;border:1px solid #e4dccf;" />
  `).join('')

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Haftalık çizelge</title>
</head>
<body style="margin:0;padding:24px;background:#f4f0e6;color:#1c241f;font-family:Arial,sans-serif;">
  <div style="max-width:980px;margin:0 auto;">
    <p style="margin:0 0 8px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#6f695e;">LGS Günlük Takip</p>
    <h1 style="margin:0 0 8px;font-size:24px;">Haftalık çizelge</h1>
    <p style="margin:0 0 8px;color:#6f695e;">${kacis(ogretmenAd)} · ${kacis(hafta.baslangic)} – ${kacis(hafta.bitis)}</p>
    <p style="margin:0 0 12px;font-size:14px;">Her öğrencinin çizelgesi aşağıda. Hepsi tek PDF olarak da ekte.</p>
    ${bloklar}
  </div>
</body>
</html>`
}

async function yazitipleriYukle() {
  return {
    normal: await readFile(new URL('../supabase/functions/haftalik-posta/font/DejaVuSans.ttf', import.meta.url)),
    kalin: await readFile(new URL('../supabase/functions/haftalik-posta/font/DejaVuSans-Bold.ttf', import.meta.url)),
  }
}

function dosyaAdi(adSoyad) {
  const sade = String(adSoyad).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
  return sade || 'ogrenci'
}

async function jpegYap(pdf) {
  const klasor = await mkdtemp(join(tmpdir(), 'cetvel-'))
  try {
    const pdfYol = join(klasor, 'cetvel.pdf')
    await writeFile(pdfYol, pdf)
    await execFileAsync('pdftoppm', ['-jpeg', '-r', '150', '-singlefile', pdfYol, join(klasor, 'cetvel')])
    return await readFile(join(klasor, 'cetvel.jpg'))
  } finally {
    await rm(klasor, { recursive: true, force: true })
  }
}

async function pdfBirlestir(parcalar) {
  const belge = await PDFDocument.create()
  belge.setTitle('Haftalık çizelge')
  belge.setAuthor('LGS Günlük Takip')
  for (const parca of parcalar) {
    const tek = await PDFDocument.load(parca)
    const sayfalar = await belge.copyPages(tek, tek.getPageIndices())
    for (const sayfa of sayfalar) belge.addPage(sayfa)
  }
  return Buffer.from(await belge.save())
}

export async function cetvelEkleri(raporlar, yazitipleri, hafta) {
  const ekler = []
  const parcalar = []
  for (const [index, rapor] of raporlar.entries()) {
    const pdf = Buffer.from(await haftalikPdf(rapor, yazitipleri))
    parcalar.push(pdf)
    ekler.push({
      filename: `${dosyaAdi(rapor.adSoyad)}.jpg`,
      content: await jpegYap(pdf),
      cid: `cetvel-${index}`,
      contentType: 'image/jpeg',
    })
  }
  ekler.push({
    filename: `haftalik-cizelge-${hafta.baslangic}.pdf`,
    content: await pdfBirlestir(parcalar),
    contentType: 'application/pdf',
  })
  return ekler
}

async function calistir() {
  const supabase = createClient(gerekli('SUPABASE_URL'), gerekli('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
    realtime: { transport: BosSoket },
  })
  const hafta = gecenHafta()
  const yalnizEposta = (process.env.TEST_OGRENCI_EPOSTA || '').trim().toLowerCase()
  console.log(`Hafta: ${hafta.baslangic} – ${hafta.bitis}`)

  const { data: tumOgrenciler, error: ogrenciHatasi } = await supabase
    .from('ogrenciler')
    .select('id, ad_soyad, danisman_id')
    .eq('onay_durumu', true)
  if (ogrenciHatasi) throw new Error(`Öğrenciler okunamadı: ${ogrenciHatasi.message}`)
  let ogrenciler = tumOgrenciler ?? []
  if (yalnizEposta) {
    const dar = []
    for (const ogrenci of ogrenciler) {
      const { data: hesap, error: hesapHatasi } = await supabase.auth.admin.getUserById(ogrenci.id)
      if (hesapHatasi) throw new Error(hesapHatasi.message)
      if ((hesap.user?.email || '').toLowerCase() === yalnizEposta) dar.push(ogrenci)
    }
    ogrenciler = dar
    console.log(`Test öğrencisi: ${yalnizEposta} (${ogrenciler.length})`)
  }
  if (!ogrenciler?.length) {
    console.log('Onaylı öğrenci yok.')
    return
  }

  const { data: kayitlar, error: kayitHatasi } = await supabase
    .from('gunluk_kayitlar')
    .select('*')
    .in('ogrenci_id', ogrenciler.map((ogrenci) => ogrenci.id))
    .gte('tarih', hafta.baslangic)
    .lte('tarih', hafta.bitis)
  if (kayitHatasi) throw new Error(`Günlük kayıtlar okunamadı: ${kayitHatasi.message}`)

  const { data: alicilar, error: aliciHatasi } = await supabase
    .from('cetel_alicilar')
    .select('ogrenci_id, ogretmen_id')
    .in('ogrenci_id', ogrenciler.map((ogrenci) => ogrenci.id))
  if (aliciHatasi) throw new Error(`Posta alıcıları okunamadı: ${aliciHatasi.message}`)

  const secilenler = new Map()
  for (const alici of alicilar ?? []) {
    const liste = secilenler.get(alici.ogrenci_id) ?? []
    liste.push(alici.ogretmen_id)
    secilenler.set(alici.ogrenci_id, liste)
  }

  const gruplar = new Map()
  function ogrenciEkle(ogretmenId, ogrenci) {
    if (!ogretmenId) return
    const liste = gruplar.get(ogretmenId) ?? []
    if (!liste.some((kisi) => kisi.id === ogrenci.id)) liste.push(ogrenci)
    gruplar.set(ogretmenId, liste)
  }
  for (const ogrenci of ogrenciler) {
    ogrenciEkle(ogrenci.danisman_id, ogrenci)
    for (const ogretmenId of secilenler.get(ogrenci.id) ?? []) ogrenciEkle(ogretmenId, ogrenci)
  }
  if (!gruplar.size) {
    console.log('Posta alacak öğretmen yok.')
    return
  }

  const yazitipleri = await yazitipleriYukle()
  const tasima = nodemailer.createTransport({
    host: 'srvm14.trwww.com',
    port: 465,
    secure: true,
    auth: {
      user: 'rota@okulotomasyon.com',
      pass: gerekli('SMTP_PASS'),
    },
  })

  let gonderilen = 0
  let hataSayisi = 0
  for (const [danismanId, liste] of gruplar) {
    try {
      const { data: ogretmen, error: ogretmenHatasi } = await supabase
        .from('ogretmenler')
        .select('id, ad_soyad')
        .eq('id', danismanId)
        .maybeSingle()
      if (ogretmenHatasi) throw new Error(ogretmenHatasi.message)
      if (!ogretmen) {
        console.warn(`Danışman kaydı yok: ${danismanId}`)
        continue
      }

      const { data: hesap, error: hesapHatasi } = await supabase.auth.admin.getUserById(danismanId)
      if (hesapHatasi) throw new Error(hesapHatasi.message)
      const posta = hesap.user?.email
      if (!posta) {
        console.warn(`${ogretmen.ad_soyad} için kayıtlı e-posta yok.`)
        continue
      }

      const raporlar = liste.map((ogrenci) => raporHazirla({
        adSoyad: ogrenci.ad_soyad,
        kayitlar: (kayitlar ?? []).filter((kayit) => kayit.ogrenci_id === ogrenci.id),
        baslangic: hafta.baslangic,
        bitis: hafta.bitis,
      })).sort((a, b) => a.adSoyad.localeCompare(b.adSoyad, 'tr'))

      await tasima.sendMail({
        from: '"Rota - Sınav Takip" <rota@okulotomasyon.com>',
        to: posta,
        subject: `${yalnizEposta ? 'Deneme · ' : ''}Haftalık çizelge · ${hafta.baslangic} – ${hafta.bitis}`,
        html: htmlRapor(ogretmen.ad_soyad, raporlar, hafta),
        attachments: await cetvelEkleri(raporlar, yazitipleri, hafta),
      })
      gonderilen += 1
      console.log(`Gönderildi: ${ogretmen.ad_soyad} <${posta}> (${liste.length} öğrenci)`)
    } catch (hata) {
      hataSayisi += 1
      console.error(`Danışman ${danismanId} gönderilemedi:`, hata)
    }
  }

  console.log(`Bitti. Gönderilen: ${gonderilen}. Hata: ${hataSayisi}.`)
  if (hataSayisi) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  calistir().catch((hata) => {
    console.error('Rapor gönderimi durdu:', hata)
    process.exit(1)
  })
}
