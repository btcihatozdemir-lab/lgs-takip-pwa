import { createClient } from '@supabase/supabase-js'
import { gecenHafta, raporHazirla } from './raporVerisi.js'
import { haftalikPdf } from './raporPdf.js'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-cron-secret, content-type',
}

Deno.serve(async (istek) => {
  if (istek.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const cronSir = Deno.env.get('CRON_SECRET')
  if (!cronSir || istek.headers.get('x-cron-secret') !== cronSir) {
    return json({ hata: 'Bu çağrı yalnızca pazartesi işine açıktır.' }, 401)
  }

  const resendAnahtar = Deno.env.get('RESEND_API_KEY')
  const gonderen = Deno.env.get('POSTA_GONDEREN')
  if (!resendAnahtar || !gonderen) {
    return json({ hata: 'RESEND_API_KEY ve POSTA_GONDEREN tanımlı değil. Posta gönderilmedi.' }, 500)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const hafta = gecenHafta()
  const normal = await Deno.readFile(new URL('./font/DejaVuSans.ttf', import.meta.url))
  const kalin = await Deno.readFile(new URL('./font/DejaVuSans-Bold.ttf', import.meta.url))

  const { data: alicilar, error } = await supabase.from('cetel_alicilar').select('ogrenci_id, ogretmen_id')
  if (error) return json({ hata: error.message }, 500)

  const sonuc = { gonderilen: 0, atlanan: 0, hatalar: [] as string[] }
  const posta = new Map()

  for (const alici of alicilar ?? []) {
    const anahtar = `${alici.ogrenci_id}:${alici.ogretmen_id}`
    try {
      const { data: dahaOnce } = await supabase
        .from('posta_gunlugu')
        .select('ogrenci_id')
        .eq('ogrenci_id', alici.ogrenci_id)
        .eq('ogretmen_id', alici.ogretmen_id)
        .eq('hafta_baslangic', hafta.baslangic)
        .maybeSingle()
      if (dahaOnce) {
        sonuc.atlanan += 1
        continue
      }

      const { data: ogrenci, error: ogrenciHatasi } = await supabase
        .from('ogrenciler')
        .select('id, ad_soyad')
        .eq('id', alici.ogrenci_id)
        .single()
      if (ogrenciHatasi) throw new Error(ogrenciHatasi.message)

      const ogretmenPosta = posta.get(alici.ogretmen_id) ?? await ogretmenEpostasi(supabase, alici.ogretmen_id)
      posta.set(alici.ogretmen_id, ogretmenPosta)
      if (!ogretmenPosta) throw new Error('Öğretmenin e-posta adresi yok.')

      const { data: kayitlar, error: kayitHatasi } = await supabase
        .from('gunluk_kayitlar')
        .select('*')
        .eq('ogrenci_id', alici.ogrenci_id)
        .gte('tarih', hafta.baslangic)
        .lte('tarih', hafta.bitis)
      if (kayitHatasi) throw new Error(kayitHatasi.message)

      const rapor = raporHazirla({
        adSoyad: ogrenci.ad_soyad,
        kayitlar: kayitlar ?? [],
        baslangic: hafta.baslangic,
        bitis: hafta.bitis,
      })
      const pdf = await haftalikPdf(rapor, { normal, kalin })
      await mektupGonder({
        anahtar: resendAnahtar,
        gonderen,
        kime: ogretmenPosta,
        rapor,
        pdf,
      })

      const { error: gunlukHatasi } = await supabase.from('posta_gunlugu').insert({
        ogrenci_id: alici.ogrenci_id,
        ogretmen_id: alici.ogretmen_id,
        hafta_baslangic: hafta.baslangic,
      })
      if (gunlukHatasi) throw new Error(gunlukHatasi.message)
      sonuc.gonderilen += 1
    } catch (hata) {
      sonuc.hatalar.push(`${anahtar}: ${hata instanceof Error ? hata.message : 'bilinmeyen hata'}`)
    }
  }

  return json(sonuc, 200)
})

async function ogretmenEpostasi(supabase, ogretmenId) {
  const { data, error } = await supabase.auth.admin.getUserById(ogretmenId)
  if (error) throw new Error(error.message)
  return data.user?.email ?? ''
}

async function mektupGonder({ anahtar, gonderen, kime, rapor, pdf }) {
  const yanit = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${anahtar}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: gonderen,
      to: [kime],
      subject: `${rapor.adSoyad} · ${rapor.baslangic} – ${rapor.bitis} haftalık çizelge`,
      text: [
        `Merhaba,`,
        ``,
        `${rapor.adSoyad} için ${rapor.baslangic} – ${rapor.bitis} haftasının çizelgesi ektedir.`,
        `Toplam ${rapor.toplamSoru} soru, ${rapor.netYazi} net, başarı % ${rapor.basariYazi}.`,
        `Okunan sayfa: ${rapor.toplamSayfa}.`,
        ``,
        `LGS Günlük Takip`,
      ].join('\n'),
      attachments: [{
        filename: `${rapor.adSoyad} ${rapor.baslangic}.pdf`,
        content: baytlarBase64(pdf),
      }],
    }),
  })
  if (!yanit.ok) throw new Error(`Posta servisi ${yanit.status}: ${await yanit.text()}`)
}

function baytlarBase64(baytlar) {
  let ikili = ''
  const dizi = baytlar instanceof Uint8Array ? baytlar : new Uint8Array(baytlar)
  for (const bayt of dizi) ikili += String.fromCharCode(bayt)
  return btoa(ikili)
}

function json(govde, durum) {
  return new Response(JSON.stringify(govde), {
    status: durum,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
