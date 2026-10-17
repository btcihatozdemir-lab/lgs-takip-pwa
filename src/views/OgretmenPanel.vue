<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ilIlceListesi from '../assets/il_ilce_sade.json'
import { supabase } from '../supabase'
import { toast } from '../services/toast'
import HaftalikCetvel from '../components/HaftalikCetvel.vue'
import Liderlik from '../components/Liderlik.vue'
import { davetBaglantisi, isoGun } from '../lib/dersler'
import { istanbulGunu, raporHazirla, tarihEkle } from '../../supabase/functions/haftalik-posta/raporVerisi.js'
import {
  aralikKayitlari,
  dersOzet,
  kademeOzet,
  kayitTarihleri,
  liderlik,
  ogretmenBilgisiGuncelle,
  ogretmenKart,
  ogrenciBilgisiGuncelle,
  okulBilgisiGuncelle,
  okulOgrencileri,
} from '../services/calisma'

const KADEMELER = [
  { ad: 'İlkokul', alt: 1, ust: 4 },
  { ad: 'Ortaokul', alt: 5, ust: 8 },
  { ad: 'Lise', alt: 9, ust: 12 },
]

const router = useRouter()
const yukleniyor = ref(true)
const kart = ref(null)
const ogrenciler = ref([])
const okul = ref(null)
const bolge = ref(null)
const ilOzet = ref(null)
const kademe = ref(KADEMELER[1])
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
const seciliOgrenci = ref('')
const sonGunler = ref(new Map())
const gecenKayitlar = ref([])
const listeAraligi = ref(sonYediGun())
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
    baslangic: listeAraligi.value.baslangic,
    bitis: listeAraligi.value.bitis,
  })
  return { ogrenci, son, fark, rapor }
}).sort((a, b) => (b.fark ?? 9999) - (a.fark ?? 9999)))
function gunFarki(iso) {
  const bugun = new Date(`${isoGun()}T12:00:00`)
  const gun = new Date(`${iso}T12:00:00`)
  return Math.round((bugun - gun) / 86400000)
}

function kademeSec(liste, okulAdi) {
  const sayilar = liste.filter((ogrenci) => ogrenci.onay_durumu).map((ogrenci) => Number(ogrenci.sinif)).filter((sinif) => sinif >= 1 && sinif <= 12)
  if (sayilar.length) {
    const puan = [0, 0, 0]
    for (const sinif of sayilar) puan[sinif <= 4 ? 0 : sinif <= 8 ? 1 : 2] += 1
    return KADEMELER[puan.indexOf(Math.max(...puan))]
  }
  const ad = String(okulAdi || '').toLocaleLowerCase('tr-TR')
  if (ad.includes('ilkokul')) return KADEMELER[0]
  if (ad.includes('lise')) return KADEMELER[2]
  return KADEMELER[1]
}

function sonYediGun() {
  const bitis = istanbulGunu()
  return { baslangic: tarihEkle(bitis, -6), bitis }
}

function yakinYazi(fark) {
  if (fark == null) return 'Hiç yok'
  if (fark <= 0) return 'Bugün'
  if (fark === 1) return 'Dün'
  return `${fark} gün`
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
  listeAraligi.value = sonYediGun()
  kademe.value = kademeSec(ogrenciler.value, kart.value.okullar?.okul_adi)
  const ortak = { il: kart.value.okullar?.il, alt: kademe.value.alt, ust: kademe.value.ust }
  const [okulSonuc, bolgeSonuc, ilSonuc, dersSonuc, tarihler, gecen] = await Promise.all([
    kademeOzet({ ...ortak, okulId: kart.value.okul_id }),
    kademeOzet({ ...ortak, ilce: kart.value.okullar?.ilce }),
    kademeOzet(ortak),
    dersOzet(kart.value.okul_id),
    kayitTarihleri(onayliIdler),
    aralikKayitlari(onayliIdler, listeAraligi.value.baslangic, listeAraligi.value.bitis),
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
  ilOzet.value = ilSonuc
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

async function koduKopyala() {
  await navigator.clipboard.writeText(kart.value?.davet_kodu || '')
  toast.basari('Davet kodu kopyalandı.')
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
    return true
  } catch (hata) {
    toast.hata(hata.message || 'Öğrenci bağlanamadı.')
    return false
  }
}

async function secileniBagla() {
  const ogrenci = danismansizlar.value.find((kayit) => kayit.id === seciliOgrenci.value)
  if (!ogrenci) {
    toast.hata('Önce öğrenciyi seç.')
    return
  }
  if (await kendimeBagla(ogrenci)) seciliOgrenci.value = ''
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
        <div class="davet-satir">
          <p>
            <small>Öğrenci davet bağlantısı</small>
            <strong>{{ baglantiKisa }}</strong>
          </p>
          <button type="button" class="beyaz-dugme" @click="kopyala">Bağlantıyı kopyala</button>
        </div>
        <div class="davet-satir">
          <p>
            <small>Davet kodu</small>
            <strong>{{ kart.davet_kodu }}</strong>
          </p>
          <button type="button" class="beyaz-dugme" @click="koduKopyala">Kodu kopyala</button>
        </div>
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
            <div class="bolum-baslik"><h2>Öğrencilerim</h2></div>
            <article v-for="satir in bilgiSatirlari" :key="satir.ogrenci.id" class="kisi-kart" :class="{ acik: acikOgrenci === satir.ogrenci.id, sessiz: satir.fark == null || satir.fark >= 3 }">
              <div class="kisi-ust">
                <strong>{{ satir.ogrenci.ad_soyad }}</strong>
                <span class="kisi-olcu"><b>{{ satir.rapor.toplamSoru }}</b> Soru <em>({{ yakinYazi(satir.fark) }})</em></span>
                <button type="button" class="cetvel-dugme" :class="{ acik: acikOgrenci === satir.ogrenci.id }" :aria-expanded="acikOgrenci === satir.ogrenci.id" aria-label="Çizelge" @click="cizelgeAc(satir.ogrenci.id)">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 7h14M5 12h14M5 17h14" />
                    <circle cx="8" cy="7" r="1.2" />
                    <circle cx="8" cy="12" r="1.2" />
                    <circle cx="8" cy="17" r="1.2" />
                  </svg>
                </button>
              </div>
              <HaftalikCetvel v-if="acikOgrenci === satir.ogrenci.id" :rapor="satir.rapor" />
            </article>

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
              <form v-if="danismansizlar.length" class="ekle-satir" @submit.prevent="secileniBagla">
                <select v-model="seciliOgrenci" class="yazi-alani">
                  <option value="">Öğrenci seç</option>
                  <option v-for="ogrenci in danismansizlar" :key="ogrenci.id" :value="ogrenci.id">{{ ogrenci.ad_soyad }}</option>
                </select>
                <button type="submit" class="kucuk-dugme">Bana bağla</button>
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
            <h2>Son 7 gün</h2>
            <span class="soluk">{{ kademe.ad }}</span>
          </div>
          <p class="not">{{ kademe.alt }}–{{ kademe.ust }}. sınıflar birlikte sayılır. Toplam 7'ye bölünür.</p>
          <div class="ozet-liste">
            <article class="ozet-kutu">
              <header>
                <span class="ozet-simge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg></span>
                <strong>Okul</strong>
              </header>
              <dl>
                <div><dt>Soru</dt><dd>{{ okul?.soru ?? '—' }}</dd></div>
                <div><dt>Net</dt><dd>{{ okul?.net ?? '—' }} <span>% {{ okul?.basari ?? '—' }}</span></dd></div>
                <div><dt>Kitap okuma</dt><dd>{{ okul?.kitap ?? '—' }}</dd></div>
              </dl>
            </article>
            <article class="ozet-kutu">
              <header>
                <span class="ozet-simge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/></svg></span>
                <strong>{{ kart.okullar?.ilce || 'İlçe' }}</strong>
              </header>
              <dl>
                <div><dt>Soru</dt><dd>{{ bolge?.soru ?? '—' }}</dd></div>
                <div><dt>Net</dt><dd>{{ bolge?.net ?? '—' }} <span>% {{ bolge?.basari ?? '—' }}</span></dd></div>
                <div><dt>Kitap okuma</dt><dd>{{ bolge?.kitap ?? '—' }}</dd></div>
              </dl>
            </article>
            <article class="ozet-kutu">
              <header>
                <span class="ozet-simge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M4 10h16M9 6v12M15 6v12"/></svg></span>
                <strong>{{ kart.okullar?.il || 'İl' }}</strong>
              </header>
              <dl>
                <div><dt>Soru</dt><dd>{{ ilOzet?.soru ?? '—' }}</dd></div>
                <div><dt>Net</dt><dd>{{ ilOzet?.net ?? '—' }} <span>% {{ ilOzet?.basari ?? '—' }}</span></dd></div>
                <div><dt>Kitap okuma</dt><dd>{{ ilOzet?.kitap ?? '—' }}</dd></div>
              </dl>
            </article>
          </div>

          <div class="kutu" style="margin-top: 0.9rem;">
            <div class="bolum-baslik"><h2>Ders ders</h2><span class="soluk">Son 7 gün</span></div>
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
