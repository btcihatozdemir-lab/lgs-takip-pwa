<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ilIlceListesi from '../assets/il_ilce_sade.json'
import { supabase } from '../supabase'
import { toast } from '../services/toast'
import HaftalikCetvel from '../components/HaftalikCetvel.vue'
import Liderlik from '../components/Liderlik.vue'
import { davetBaglantisi, isoGun } from '../lib/dersler'
import { gecenHafta, raporHazirla } from '../../supabase/functions/haftalik-posta/raporVerisi.js'
import {
  aralikKayitlari,
  bolgeOzet,
  danismaniBul,
  dersOzet,
  kayitTarihleri,
  liderlik,
  ogretmenBilgisiGuncelle,
  ogretmenKart,
  ogrenciBilgisiGuncelle,
  okulBilgisiGuncelle,
  okulOgrencileri,
  okulOzet,
} from '../services/calisma'

const router = useRouter()
const yukleniyor = ref(true)
const kart = ref(null)
const ogrenciler = ref([])
const okul = ref(null)
const bolge = ref(null)
const dersler = ref([])
const sira = ref([])
const olcut = ref('soru')
const seciliSinif = ref('')
const adSoyad = ref('')
const brans = ref('')
const seciliIl = ref('')
const seciliIlce = ref('')
const okulAdi = ref('')
const okulFormuHazir = ref(false)
const baglamaKodu = ref('')
const seciliOgrenci = ref('')
const sonGunler = ref(new Map())
const gecenKayitlar = ref([])
const postaHaftasi = ref(gecenHafta())
const acikOgrenci = ref('')
const iller = ilIlceListesi.map((kayit) => kayit.il)
const ilceler = computed(() => ilIlceListesi.find((kayit) => kayit.il === seciliIl.value)?.ilceler ?? [])

watch(seciliIl, () => {
  if (!okulFormuHazir.value) return
  seciliIlce.value = ''
})

const sekme = ref('sinif')
const baglanti = computed(() => (kart.value ? davetBaglantisi(kart.value.davet_kodu) : ''))
const baglantiKisa = computed(() => {
  if (!baglanti.value) return ''
  const adres = new URL(baglanti.value)
  return `${adres.host}${adres.pathname}${adres.search}`
})
const dersTavan = computed(() => Math.max(1, ...dersler.value.map((ders) => Number(ders.soru) || 0)))
const sinifSecenekleri = computed(() => {
  const siniflar = ogrenciler.value
    .filter((ogrenci) => ogrenci.onay_durumu)
    .map((ogrenci) => String(ogrenci.sinif))
    .filter(Boolean)
  return [...new Set(siniflar)].sort((a, b) => Number(a) - Number(b))
})
const bekleyenler = computed(() => ogrenciler.value.filter((ogrenci) => ogrenci.onay_durumu === false))
const onaylilar = computed(() => ogrenciler.value.filter((ogrenci) => ogrenci.onay_durumu === true && ogrenci.danisman_id === kart.value?.id))
const danismanMi = computed(() => onaylilar.value.length > 0)
const danismansizlar = computed(() => ogrenciler.value.filter((ogrenci) => ogrenci.onay_durumu === true && !ogrenci.danisman_id))
const okulSiniflari = computed(() => {
  const grup = new Map()
  for (const ogrenci of ogrenciler.value.filter((kayit) => kayit.onay_durumu)) {
    const sinif = String(ogrenci.sinif)
    const liste = grup.get(sinif) ?? []
    liste.push(ogrenci)
    grup.set(sinif, liste)
  }
  return [...grup.entries()]
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([sinif, liste]) => ({
      sinif,
      ogrenciler: liste.sort((a, b) => a.ad_soyad.localeCompare(b.ad_soyad, 'tr')),
    }))
})
const bilgiSatirlari = computed(() => onaylilar.value.map((ogrenci) => {
  const son = sonGunler.value.get(ogrenci.id) || ''
  const fark = son ? gunFarki(son) : null
  const rapor = raporHazirla({
    adSoyad: ogrenci.ad_soyad,
    kayitlar: gecenKayitlar.value.filter((kayit) => kayit.ogrenci_id === ogrenci.id),
    baslangic: postaHaftasi.value.baslangic,
    bitis: postaHaftasi.value.bitis,
  })
  return { ogrenci, son, fark, rapor }
}).sort((a, b) => (b.fark ?? 9999) - (a.fark ?? 9999)))
const acikRapor = computed(() => bilgiSatirlari.value.find((satir) => satir.ogrenci.id === acikOgrenci.value)?.rapor || null)

function gunFarki(iso) {
  const bugun = new Date(`${isoGun()}T12:00:00`)
  const gun = new Date(`${iso}T12:00:00`)
  return Math.round((bugun - gun) / 86400000)
}

function sonGunYazi(iso, fark) {
  if (!iso) return 'Hiç yok'
  const [yil, ay, gun] = iso.split('-')
  const tarih = `${gun}.${ay}.${yil}`
  if (fark <= 0) return `Bugün · ${tarih}`
  if (fark === 1) return `Dün · ${tarih}`
  return `${fark} gün önce · ${tarih}`
}

async function yukle() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  kart.value = await ogretmenKart(session.user.id)
  if (!kart.value) return
  okulFormuHazir.value = false
  adSoyad.value = kart.value.ad_soyad || ''
  brans.value = kart.value.brans || ''
  seciliIl.value = kart.value.okullar?.il || ''
  seciliIlce.value = kart.value.okullar?.ilce || ''
  okulAdi.value = kart.value.okullar?.okul_adi || ''
  await nextTick()
  okulFormuHazir.value = true
  ogrenciler.value = await okulOgrencileri(kart.value.okul_id)
  const onayliIdler = ogrenciler.value.filter((ogrenci) => ogrenci.onay_durumu && ogrenci.danisman_id === kart.value.id).map((ogrenci) => ogrenci.id)
  postaHaftasi.value = gecenHafta()
  const [okulSonuc, bolgeSonuc, dersSonuc, tarihler, gecen] = await Promise.all([
    okulOzet(kart.value.okul_id),
    bolgeOzet(kart.value.okullar?.il, kart.value.okullar?.ilce),
    dersOzet(kart.value.okul_id),
    kayitTarihleri(onayliIdler),
    aralikKayitlari(onayliIdler, postaHaftasi.value.baslangic, postaHaftasi.value.bitis),
  ])
  sonGunler.value = tarihler.reduce((harita, kayit) => {
    const tarih = String(kayit.tarih).slice(0, 10)
    const mevcut = harita.get(kayit.ogrenci_id)
    if (!mevcut || tarih > mevcut) harita.set(kayit.ogrenci_id, tarih)
    return harita
  }, new Map())
  gecenKayitlar.value = gecen
  okul.value = okulSonuc
  bolge.value = bolgeSonuc
  dersler.value = dersSonuc || []
  if (!sinifSecenekleri.value.includes(seciliSinif.value)) seciliSinif.value = sinifSecenekleri.value[0] || ''
  await sirayiGetir()
}

async function sirayiGetir() {
  const il = kart.value?.okullar?.il
  if (!seciliSinif.value || !il) {
    sira.value = []
    return
  }
  sira.value = (await liderlik(seciliSinif.value, il, olcut.value)) || []
}

async function kopyala() {
  await navigator.clipboard.writeText(baglanti.value)
  toast.basari('Davet bağlantısı kopyalandı.')
}

async function onayla(ogrenci) {
  try {
    const alanlar = { onay_durumu: true }
    if (!ogrenci.danisman_id) alanlar.danisman_id = kart.value.id
    await ogrenciBilgisiGuncelle(ogrenci.id, alanlar)
    await yukle()
    toast.basari('Öğrenci onaylandı.')
  } catch (hata) {
    toast.hata(hata.message || 'Onay güncellenemedi.')
  }
}

async function kendimeBagla(ogrenci) {
  try {
    await ogrenciBilgisiGuncelle(ogrenci.id, { danisman_id: kart.value.id, onay_durumu: true })
    await yukle()
    toast.basari(`${ogrenci.ad_soyad} sana bağlandı.`)
  } catch (hata) {
    toast.hata(hata.message || 'Öğrenci bağlanamadı.')
  }
}

async function kodlaBagla() {
  try {
    const ogretmen = await danismaniBul(baglamaKodu.value)
    if (!ogretmen) throw new Error('Öğretmen kodu bulunamadı.')
    if (!seciliOgrenci.value) throw new Error('Önce öğrenciyi seç.')
    await ogrenciBilgisiGuncelle(seciliOgrenci.value, { danisman_id: ogretmen.id })
    baglamaKodu.value = ''
    await yukle()
    toast.basari('Danışman atandı. Bir öğrencinin tek danışmanı olur.')
  } catch (hata) {
    toast.hata(hata.message || 'Danışman atanamadı.')
  }
}

async function bilgileriKaydet() {
  try {
    if (!seciliIl.value || !seciliIlce.value || !okulAdi.value.trim()) throw new Error('İl, ilçe ve okul adını doldur.')
    await okulBilgisiGuncelle(kart.value.okul_id, {
      il: seciliIl.value,
      ilce: seciliIlce.value,
      okul_adi: okulAdi.value.trim(),
    })
    await ogretmenBilgisiGuncelle(kart.value.id, { ad_soyad: adSoyad.value.trim(), brans: brans.value.trim() })
    await yukle()
    toast.basari('Bilgilerin güncellendi.')
  } catch (hata) {
    toast.hata(hata.message || 'Bilgiler kaydedilemedi.')
  }
}

function cizelgeAc(ogrenciId) {
  acikOgrenci.value = acikOgrenci.value === ogrenciId ? '' : ogrenciId
}

async function olcutSec(yeni) {
  olcut.value = yeni
  try {
    await sirayiGetir()
  } catch (hata) {
    toast.hata(hata.message || 'Sıralama alınamadı.')
  }
}

async function sinifSec(sinif) {
  seciliSinif.value = sinif
  try {
    await sirayiGetir()
  } catch (hata) {
    toast.hata(hata.message || 'Sıralama alınamadı.')
  }
}

function basHarf(ad) {
  return (ad || '?').trim().charAt(0).toLocaleUpperCase('tr-TR')
}

async function cikisYap() {
  await supabase.auth.signOut()
  await router.push('/login')
}

onMounted(async () => {
  try {
    await yukle()
  } catch (hata) {
    toast.hata(hata.message || 'Panel açılamadı.')
  } finally {
    yukleniyor.value = false
  }
})
</script>

<template>
  <div class="panel">
    <header class="ust-serit">
      <div class="ust-ic ogretmen-govde" style="width: min(1080px, 100%); padding-bottom: 0;">
      <div class="marka">
        <span class="marka-damga">{{ basHarf(kart?.ad_soyad) }}</span>
        <span>
          <small>{{ kart?.okullar?.okul_adi || 'Okul' }}{{ kart?.brans ? ` · ${kart.brans}` : '' }}</small>
          <strong>{{ kart?.ad_soyad || 'Öğretmen' }}</strong>
        </span>
      </div>
      <button type="button" class="cikis" @click="cikisYap">Çıkış</button>
      </div>
    </header>

    <p v-if="yukleniyor" class="yukleniyor ogretmen-govde">Yükleniyor...</p>

    <main v-else-if="kart" class="ogretmen-govde">
      <section class="davet-serit">
        <p>
          <small>Öğrenci davet bağlantısı</small>
          <strong>{{ baglantiKisa }}</strong>
        </p>
        <button type="button" class="beyaz-dugme" @click="kopyala">Bağlantıyı kopyala</button>
      </section>

      <div class="masa">
        <div :class="{ 'telefon-gizli': sekme !== 'sinif' }">
          <div v-if="bekleyenler.length" class="kutu">
            <div class="bolum-baslik"><h2>Onay</h2></div>
            <article v-for="ogrenci in bekleyenler" :key="ogrenci.id" class="bekleyen">
              <div>
                <b>{{ ogrenci.ad_soyad }}</b>
                <span> · {{ ogrenci.sinif }}. sınıf</span>
              </div>
              <button type="button" class="kucuk-dugme" @click="onayla(ogrenci)">Onayla</button>
            </article>
          </div>

          <template v-if="danismanMi">
            <div class="bolum-baslik">
              <h2>Öğrencilerim</h2>
              <span class="soluk">{{ postaHaftasi.baslangic }} – {{ postaHaftasi.bitis }}</span>
            </div>
            <p class="not">Sayılar pazartesi mektubundaki haftadır. Üç gündür boşsa son gün kırmızı durur.</p>
            <article v-for="satir in bilgiSatirlari" :key="satir.ogrenci.id" class="kisi-kart" :class="{ sessiz: satir.fark == null || satir.fark >= 3 }">
              <header>
                <strong>{{ satir.ogrenci.ad_soyad }}</strong>
                <small>{{ satir.ogrenci.sinif }}. sınıf</small>
                <em>{{ sonGunYazi(satir.son, satir.fark) }}</em>
              </header>
              <div class="kisi-sayilar">
                <p>
                  <span>Soru</span>
                  <b>{{ satir.rapor.toplamSoru }}</b>
                  <small>{{ satir.rapor.netYazi }} net</small>
                </p>
              </div>
              <button type="button" class="kucuk-dugme" @click="cizelgeAc(satir.ogrenci.id)">{{ acikOgrenci === satir.ogrenci.id ? 'Kapat' : 'Çizelge' }}</button>
            </article>
            <HaftalikCetvel v-if="acikRapor" :rapor="acikRapor" />

            <div class="kutu" style="margin-top: 1rem;">
              <div class="bolum-baslik"><h2>Danışmansız</h2></div>
              <p class="not">Aynı okuldalar. Bağlantıyı iletebilir ya da kendin bağlayabilirsin.</p>
              <article v-for="ogrenci in danismansizlar" :key="ogrenci.id" class="ogrenci-satir">
                <span class="avatar">{{ basHarf(ogrenci.ad_soyad) }}</span>
                <span>
                  <strong>{{ ogrenci.ad_soyad }}</strong>
                  <small>{{ ogrenci.sinif }}. sınıf</small>
                </span>
                <button type="button" class="ikincil" @click="kendimeBagla(ogrenci)">Bana bağla</button>
              </article>
              <p v-if="!danismansizlar.length" class="bos">Danışmansız öğrenci yok.</p>
              <form class="ekle-satir" @submit.prevent="kodlaBagla">
                <select v-model="seciliOgrenci" class="yazi-alani">
                  <option value="">Öğrenci seç</option>
                  <option v-for="ogrenci in danismansizlar" :key="ogrenci.id" :value="ogrenci.id">{{ ogrenci.ad_soyad }}</option>
                </select>
                <input v-model="baglamaKodu" placeholder="Kod" aria-label="Öğretmen kodu" class="yazi-alani kod-alani" />
                <button type="submit" class="kucuk-dugme">Ata</button>
              </form>
            </div>
          </template>

          <template v-else>
            <div class="bolum-baslik"><h2>Okuldaki öğrenciler</h2></div>
            <p class="not">Bunlar henüz senin öğrencin değil. Danışmanı olmayanı kendine bağlayabilirsin.</p>
            <section v-for="grup in okulSiniflari" :key="grup.sinif" class="kutu" style="margin-top: 0.8rem;">
              <div class="bolum-baslik"><h2>{{ grup.sinif }}. sınıf</h2></div>
              <article v-for="ogrenci in grup.ogrenciler" :key="ogrenci.id" class="ogrenci-satir">
                <span class="avatar">{{ basHarf(ogrenci.ad_soyad) }}</span>
                <span>
                  <strong>{{ ogrenci.ad_soyad }}</strong>
                  <small>{{ ogrenci.rumuz }}</small>
                </span>
                <button v-if="!ogrenci.danisman_id" type="button" class="ikincil" @click="kendimeBagla(ogrenci)">Bana bağla</button>
                <small v-else class="soluk">Danışmanı var</small>
              </article>
            </section>
            <p v-if="!okulSiniflari.length" class="bos">Okulda onaylı öğrenci yok.</p>
          </template>
        </div>

        <div :class="{ 'telefon-gizli': sekme !== 'okul' }">
          <div class="bolum-baslik">
            <h2>Bu hafta</h2>
            <span class="soluk">Pazartesiden bugüne, öğrenci başı</span>
          </div>
          <div class="sayi-serit">
            <article class="sayi-kart">
              <em>Okul, öğrenci başı</em>
              <strong>{{ okul?.soru ?? '—' }}</strong>
              <small>{{ okul?.net ?? '—' }} net · {{ okul?.kitap ?? '—' }} kitap</small>
            </article>
            <article class="sayi-kart">
              <em>{{ kart.okullar?.ilce || 'İlçe' }} ortalaması</em>
              <strong>{{ bolge?.soru ?? '—' }}</strong>
              <small>{{ bolge?.net ?? '—' }} net</small>
            </article>
          </div>

          <div class="kutu" style="margin-top: 0.9rem;">
            <div class="bolum-baslik"><h2>Ders ders</h2><span class="soluk">Bu hafta</span></div>
            <div v-if="dersler.length" class="ders-cubuklari">
              <div v-for="ders in dersler" :key="ders.ders" class="ders-olcu">
                <span>{{ ders.ders }}</span>
                <span class="olcu-iz"><span class="olcu-dolu" :style="{ width: `${(Number(ders.soru) / dersTavan) * 100}%` }" /></span>
                <span class="soluk">{{ ders.soru }}</span>
              </div>
            </div>
            <p v-else class="bos">Ders özeti kayıt geldikçe dolar.</p>
          </div>

          <div class="bolum-baslik" style="margin-top: 1.2rem;">
            <h2>İl sırası</h2>
          </div>
          <div v-if="sinifSecenekleri.length" class="parca">
            <button v-for="sinif in sinifSecenekleri" :key="sinif" type="button" :class="{ secili: seciliSinif === sinif }" @click="sinifSec(sinif)">{{ sinif }}. sınıf</button>
          </div>
          <div class="parca">
            <button v-for="secenek in [{ id: 'soru', ad: 'Soru' }, { id: 'net', ad: 'Net' }, { id: 'kitap', ad: 'Kitap' }]" :key="secenek.id" type="button" :class="{ secili: olcut === secenek.id }" @click="olcutSec(secenek.id)">{{ secenek.ad }}</button>
          </div>
          <Liderlik v-if="seciliSinif" :kisiler="sira" :olcut="olcut" :baslik="`${kart.okullar?.il || 'İl'} · ${seciliSinif}. sınıf · bu hafta`" />
          <p v-else class="bos">Okulda onaylı öğrenci yok.</p>
        </div>
      </div>

      <section class="kutu hesap-kutu" :class="{ 'telefon-gizli': sekme !== 'hesap' }">
        <div class="bolum-baslik"><h2>Hesabım</h2></div>
        <label class="alan">Ad soyad
          <input v-model="adSoyad" />
        </label>
        <label class="alan">Branş
          <input v-model="brans" />
        </label>
        <label class="alan">İl
          <select v-model="seciliIl">
            <option value="">İl seçin</option>
            <option v-for="il in iller" :key="il" :value="il">{{ il }}</option>
          </select>
        </label>
        <label class="alan">İlçe
          <select v-model="seciliIlce" :disabled="!seciliIl">
            <option value="">İlçe seçin</option>
            <option v-for="ilce in ilceler" :key="ilce" :value="ilce">{{ ilce }}</option>
          </select>
        </label>
        <label class="alan">Okul
          <input v-model="okulAdi" />
        </label>
        <p class="not">İl, ilçe ve okul adı bu okul kaydıdır. Değiştirirsen aynı okuldaki öğrenciler de yeni bilgiyi görür.</p>
        <button type="button" class="kaydet profil-kaydet" @click="bilgileriKaydet">Bilgileri kaydet</button>
      </section>
    </main>

    <footer v-if="kart" class="dock ogretmen-dock">
      <nav class="alt-menu">
        <button type="button" :class="{ secili: sekme === 'sinif' }" @click="sekme = 'sinif'">Sınıf</button>
        <button type="button" :class="{ secili: sekme === 'okul' }" @click="sekme = 'okul'">Okul</button>
        <button type="button" :class="{ secili: sekme === 'hesap' }" @click="sekme = 'hesap'">Hesap</button>
      </nav>
    </footer>
  </div>
</template>
