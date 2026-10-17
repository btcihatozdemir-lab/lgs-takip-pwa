<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { toast } from '../services/toast'
import Liderlik from '../components/Liderlik.vue'
import { DERSLER, gunEkle, gunOzeti, isoGun, netYazi } from '../lib/dersler'
import {
  aylikOzet,
  bugunuGetir,
  bugunuKaydet,
  cetelAlicilari,
  cetelAlicilariniKaydet,
  danismaniBul,
  kitapEkle,
  liderlik,
  ogrenciBilgisiGuncelle,
  rumuzKontrol,
  ogrenciKart,
  okulOgretmenleri,
  sonYediGun,
} from '../services/calisma'

const router = useRouter()
const yukleniyor = ref(true)
const kaydediyor = ref(false)
const kart = ref(null)
const bugun = ref({})
const gunler = ref([])
const aylar = ref([])
const ogretmenler = ref([])
const seciliAlicilar = ref([])
const siralamaOlcut = ref('soru')
const sira = ref([])
const danismanKodu = ref('')
const adSoyad = ref('')
const rumuz = ref('')

const sekme = ref('bugun')
const simdi = new Date()
const gunSayi = simdi.getDate()
const ayAdi = simdi.toLocaleDateString('tr-TR', { month: 'long' })
const gunAdi = simdi.toLocaleDateString('tr-TR', { weekday: 'long' })
const bugunOzet = computed(() => gunOzeti(bugun.value))
const hafta = computed(() => {
  const bugunIso = isoGun()
  const harita = new Map(gunler.value.map((gun) => [gun.tarih, gun]))
  return Array.from({ length: 7 }, (_, index) => {
    const tarih = gunEkle(bugunIso, index - 6)
    return harita.get(tarih) || { tarih }
  })
})
const haftaTavan = computed(() => Math.max(1, ...hafta.value.map((gun) => gunOzeti(gun).soru)))

function basHarf(ad) {
  return (ad || '?').trim().charAt(0).toLocaleUpperCase('tr-TR')
}

function gunYazi(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function kisaGun(iso) {
  return ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'][new Date(`${iso}T12:00:00`).getDay()]
}

function ayYazi(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
}

async function yukle() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  kart.value = await ogrenciKart(session.user.id)
  if (!kart.value) return
  adSoyad.value = kart.value.ad_soyad || ''
  rumuz.value = kart.value.rumuz || ''

  const [gunKaydi, hafta, ay, hocalar, alicilar] = await Promise.all([
    bugunuGetir(kart.value.id),
    sonYediGun(kart.value.id),
    aylikOzet(kart.value.id),
    okulOgretmenleri(kart.value.okul_id),
    cetelAlicilari(kart.value.id),
  ])
  bugun.value = gunKaydi.kayit
  gunler.value = hafta
  aylar.value = ay || []
  ogretmenler.value = hocalar
  seciliAlicilar.value = danismaniDahilEt(alicilar)
  await sirayiGetir()
}

async function sirayiGetir() {
  if (!kart.value?.okullar?.il) return
  sira.value = (await liderlik(kart.value.sinif, kart.value.okullar.il, siralamaOlcut.value)) || []
}

async function kaydet() {
  if (kaydediyor.value || !kart.value) return
  if (bugun.value.kitap_bitti && !String(bugun.value.kitap_adi || '').trim()) {
    toast.hata('Kitabı bitirdiysen adını yaz.')
    return
  }
  kaydediyor.value = true
  try {
    await bugunuKaydet(kart.value.id, bugun.value)
    if (bugun.value.kitap_bitti) await kitapEkle(kart.value.id, bugun.value.kitap_adi, bugun.value.kitap_yorum)
    gunler.value = await sonYediGun(kart.value.id)
    aylar.value = (await aylikOzet(kart.value.id)) || []
    toast.basari('Bugün kaydedildi.')
  } catch (hata) {
    toast.hata(hata.message || 'Kayıt yazılamadı.')
  } finally {
    kaydediyor.value = false
  }
}

function rakamDisiniEngelle(olay) {
  if (!olay.data || olay.inputType?.startsWith('delete') || olay.inputType === 'insertFromPaste') return
  if (/\D/.test(olay.data)) olay.preventDefault()
}

function rakamYaz(olay, alan) {
  const rakam = olay.target.value.replace(/\D/g, '')
  olay.target.value = rakam
  bugun.value[alan] = rakam === '' ? 0 : Number(rakam)
}

function danismaniDahilEt(idler) {
  const danismanId = kart.value?.danisman_id
  if (!danismanId) return idler
  return [...new Set([danismanId, ...idler])]
}

async function alicilariKaydet() {
  try {
    seciliAlicilar.value = danismaniDahilEt(seciliAlicilar.value)
    await cetelAlicilariniKaydet(kart.value.id, seciliAlicilar.value)
    toast.basari('Pazartesi postası alıcıları kaydedildi.')
  } catch (hata) {
    toast.hata(hata.message || 'Alıcılar kaydedilemedi.')
  }
}

function aliciDegistir(id, secili) {
  if (id === kart.value?.danisman_id) return
  if (secili) seciliAlicilar.value = [...new Set([...seciliAlicilar.value, id])]
  else seciliAlicilar.value = seciliAlicilar.value.filter((ogretmenId) => ogretmenId !== id)
}

async function danismanBagla() {
  try {
    const ogretmen = await danismaniBul(danismanKodu.value)
    if (!ogretmen) throw new Error('Öğretmen kodu bulunamadı.')
    if (ogretmen.okul_id !== kart.value.okul_id) throw new Error('Bu öğretmen senin okulunda değil.')
    await ogrenciBilgisiGuncelle(kart.value.id, { danisman_id: ogretmen.id })
    kart.value.danisman_id = ogretmen.id
    danismanKodu.value = ''
    toast.basari(`${ogretmen.ad_soyad} danışmanın oldu.`)
  } catch (hata) {
    toast.hata(hata.message || 'Danışman bağlanamadı.')
  }
}

async function bilgileriKaydet() {
  try {
    const tekilRumuz = await rumuzKontrol(rumuz.value)
    await ogrenciBilgisiGuncelle(kart.value.id, { ad_soyad: adSoyad.value.trim(), rumuz: tekilRumuz })
    rumuz.value = tekilRumuz
    kart.value.rumuz = tekilRumuz
    kart.value.ad_soyad = adSoyad.value.trim()
    toast.basari('Bilgilerin güncellendi.')
  } catch (hata) {
    toast.hata(hata.message || 'Bilgiler kaydedilemedi.')
  }
}

async function cikisYap() {
  await supabase.auth.signOut()
  await router.push('/login')
}

async function olcutSec(olcut) {
  siralamaOlcut.value = olcut
  try {
    await sirayiGetir()
  } catch (hata) {
    toast.hata(hata.message || 'Sıralama alınamadı.')
  }
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
      <div class="ust-ic" style="width: min(720px, 100%);">
      <div class="marka">
        <span class="marka-damga">{{ basHarf(kart?.rumuz || kart?.ad_soyad) }}</span>
        <span>
          <small>{{ kart?.okullar?.okul_adi || 'LGS Günlük Takip' }}</small>
          <strong>{{ kart?.sinif ? `${kart.sinif}. sınıf` : 'Öğrenci' }}</strong>
        </span>
      </div>
      <button type="button" class="cikis" @click="cikisYap">Çıkış</button>
      </div>
    </header>

    <p v-if="yukleniyor" class="yukleniyor ogrenci-govde">Yükleniyor...</p>

    <main v-else-if="kart" class="ogrenci-govde">
      <section v-show="sekme === 'bugun'">
        <div class="tarih-blok">
          <div>
            <p class="tarih-sayi">{{ gunSayi }}</p>
            <p class="tarih-ay">{{ ayAdi }}</p>
            <p class="tarih-gun">{{ gunAdi }}</p>
          </div>
          <div class="canli-ozet">
            <div>
              <b>{{ bugunOzet.soru }}</b>
              <span>soru</span>
            </div>
            <div>
              <b>{{ netYazi(bugunOzet.net) }}</b>
              <span>net</span>
            </div>
          </div>
        </div>

        <div class="cetvel">
          <div class="cetvel-bas">
            <span></span><span>Soru</span><span>Doğru</span><span>Yanlış</span>
          </div>
          <div v-for="ders in DERSLER" :key="ders.kod" class="cetvel-satir">
            <span class="ders-ad"><i class="ders-nokta" :style="{ background: ders.renk }" />{{ ders.ad }}</span>
            <input :value="bugun[`${ders.kod}_soru`]" :aria-label="`${ders.ad} soru`" inputmode="numeric" autocomplete="off" class="sayi-kutu" @beforeinput="rakamDisiniEngelle" @input="rakamYaz($event, `${ders.kod}_soru`)" />
            <input :value="bugun[`${ders.kod}_dogru`]" :aria-label="`${ders.ad} doğru`" inputmode="numeric" autocomplete="off" class="sayi-kutu" @beforeinput="rakamDisiniEngelle" @input="rakamYaz($event, `${ders.kod}_dogru`)" />
            <input :value="bugun[`${ders.kod}_yanlis`]" :aria-label="`${ders.ad} yanlış`" inputmode="numeric" autocomplete="off" class="sayi-kutu" @beforeinput="rakamDisiniEngelle" @input="rakamYaz($event, `${ders.kod}_yanlis`)" />
          </div>
        </div>

        <div class="gun-ek">
          <p class="soru-bas">Bu çözdüğün deneme mi?</p>
          <div class="parca">
            <button type="button" :class="{ secili: bugun.deneme === true }" @click="bugun.deneme = true">Evet</button>
            <button type="button" :class="{ secili: bugun.deneme === false }" @click="bugun.deneme = false">Hayır</button>
          </div>

          <label class="alan">Kaç sayfa kitap okudun?
            <input :value="bugun.kitap_sayfa" inputmode="numeric" autocomplete="off" @beforeinput="rakamDisiniEngelle" @input="rakamYaz($event, 'kitap_sayfa')" />
          </label>
          <p class="soru-bas">Kitabın bitti mi?</p>
          <div class="parca">
            <button type="button" :class="{ secili: bugun.kitap_bitti === true }" @click="bugun.kitap_bitti = true">Evet</button>
            <button type="button" :class="{ secili: bugun.kitap_bitti === false }" @click="bugun.kitap_bitti = false">Hayır</button>
          </div>
          <div v-if="bugun.kitap_bitti" class="kitap-acik">
            <label class="alan">Kitabın adı nedir?
              <input v-model="bugun.kitap_adi" placeholder="Kitabın adı" />
            </label>
            <label class="alan">Kitap hakkında yorumun nedir?
              <textarea v-model="bugun.kitap_yorum" rows="3" class="not-alani" placeholder="Kısaca" />
            </label>
          </div>

          <div class="cift">
            <p class="soru-bas">Öğrendiğin 1. yeni kelime ve anlamı nedir?</p>
            <input v-model="bugun.kelime" class="yazi-alani" placeholder="Kelime" />
            <input v-model="bugun.kelime_anlam" class="yazi-alani" placeholder="Anlamı" />
          </div>
          <div class="cift">
            <p class="soru-bas">What is the English word learned today and its meaning?</p>
            <input v-model="bugun.ingilizce_kelime" class="yazi-alani" placeholder="Word" />
            <input v-model="bugun.ingilizce_anlam" class="yazi-alani" placeholder="Meaning" />
          </div>
          <div class="cift">
            <p class="soru-bas">Öğrendiğin yeni deyim ve anlamı nedir?</p>
            <input v-model="bugun.deyim" class="yazi-alani" placeholder="Deyim" />
            <input v-model="bugun.deyim_anlam" class="yazi-alani" placeholder="Anlamı" />
          </div>

          <p class="soru-bas">Bugün senin için ne kadar verimliydi?</p>
          <div class="verim" role="group" aria-label="Verim puanı">
            <button v-for="puan in 5" :key="puan" type="button" :class="{ secili: bugun.verim >= puan }" @click="bugun.verim = puan">{{ puan }}</button>
          </div>

          <label class="alan">Gününden bahseder misin?
            <textarea v-model="bugun.gun_notu" rows="4" class="not-alani" placeholder="Bugün nasıl geçti?" />
          </label>
        </div>
      </section>

      <section v-show="sekme === 'hafta'">
        <div class="bolum-baslik"><h2>Son 7 gün</h2></div>
        <div class="hafta-cubuk">
          <div v-for="gun in hafta" :key="gun.tarih" class="gun-sutun" :class="{ bugun: gun.tarih === isoGun() }">
            <b>{{ gunOzeti(gun).soru }}</b>
            <div class="cubuk-iz">
              <div class="cubuk" :style="{ height: `${Math.max(8, (gunOzeti(gun).soru / haftaTavan) * 100)}%` }" />
            </div>
            <small>{{ kisaGun(gun.tarih) }}</small>
          </div>
        </div>
        <ul class="satir-liste">
          <li v-for="gun in [...hafta].reverse()" :key="`l-${gun.tarih}`">
            <span>{{ gunYazi(gun.tarih) }}</span>
            <span>{{ gunOzeti(gun).soru }} soru · {{ netYazi(gunOzeti(gun).net) }} net</span>
          </li>
        </ul>

        <div class="bolum-baslik" style="margin-top: 1.6rem;"><h2>Aylar</h2></div>
        <ul v-if="aylar.length" class="satir-liste">
          <li v-for="ay in aylar" :key="ay.ay">
            <span style="text-transform: capitalize;">{{ ayYazi(ay.ay) }}</span>
            <span>{{ ay.soru }} soru · {{ netYazi(ay.net) }} net · {{ ay.kitap }} kitap</span>
          </li>
        </ul>
        <p v-else class="bos">Aylık özet, kayıt geldikçe burada durur.</p>
      </section>

      <section v-show="sekme === 'sira'">
        <div class="bolum-baslik">
          <h2>Sıra</h2>
          <span class="soluk">{{ kart.okullar?.il }} · {{ kart.sinif }}. sınıf</span>
        </div>
        <div class="parca">
          <button v-for="olcut in [{ id: 'soru', ad: 'Soru' }, { id: 'net', ad: 'Net' }, { id: 'kitap', ad: 'Kitap' }]" :key="olcut.id" type="button" :class="{ secili: siralamaOlcut === olcut.id }" @click="olcutSec(olcut.id)">{{ olcut.ad }}</button>
        </div>
        <Liderlik :kisiler="sira" :benim-id="kart.id" :olcut="siralamaOlcut" baslik="Sıralama" />
      </section>

      <section v-show="sekme === 'ben'">
        <div class="bolum-baslik"><h2>Pazartesi postası</h2></div>
        <p class="not">Her pazartesi sabah 08:00'de son 7 gününün özeti danışmanına ve seçtiğin öğretmenlere gider.</p>
        <div class="cip-grup">
          <button v-for="ogretmen in ogretmenler" :key="ogretmen.id" type="button" class="cip" :class="{ secili: seciliAlicilar.includes(ogretmen.id) }" @click="aliciDegistir(ogretmen.id, !seciliAlicilar.includes(ogretmen.id))">
            <span class="harf">{{ basHarf(ogretmen.ad_soyad) }}</span>
            {{ ogretmen.ad_soyad }}{{ ogretmen.id === kart.danisman_id ? ' · danışman' : '' }}
          </button>
        </div>
        <p v-if="!ogretmenler.length" class="bos">Okulunda kayıtlı öğretmen yok.</p>
        <button type="button" class="kaydet profil-kaydet" @click="alicilariKaydet">Alıcıları kaydet</button>

        <div class="bolum-baslik" style="margin-top: 1.8rem;"><h2>Bilgilerim</h2></div>
        <label class="alan">Ad soyad
          <input v-model="adSoyad" />
        </label>
        <label class="alan">Rumuz
          <input v-model="rumuz" />
        </label>
        <button type="button" class="kaydet profil-kaydet" @click="bilgileriKaydet">Bilgileri kaydet</button>

        <template v-if="!kart.danisman_id">
        <div class="bolum-baslik" style="margin-top: 1.8rem;"><h2>Danışman</h2></div>
        <form class="ekle-satir" @submit.prevent="danismanBagla">
          <input v-model="danismanKodu" required placeholder="Öğretmen kodu" class="yazi-alani" style="margin-top: 0; text-transform: uppercase;" />
          <button type="submit" class="kucuk-dugme">Bağla</button>
        </form>
        </template>
      </section>
    </main>

    <footer class="dock">
      <div class="dock-ic">
        <button v-show="sekme === 'bugun'" type="button" class="kaydet" :disabled="kaydediyor || yukleniyor || !kart" @click="kaydet">
          {{ kaydediyor ? 'Kaydediliyor...' : 'Bugünü kaydet' }}
        </button>
        <nav class="alt-menu">
          <button type="button" :class="{ secili: sekme === 'bugun' }" @click="sekme = 'bugun'">Bugün</button>
          <button type="button" :class="{ secili: sekme === 'hafta' }" @click="sekme = 'hafta'">Hafta</button>
          <button type="button" :class="{ secili: sekme === 'sira' }" @click="sekme = 'sira'">Sıra</button>
          <button type="button" :class="{ secili: sekme === 'ben' }" @click="sekme = 'ben'">Ben</button>
        </nav>
      </div>
    </footer>
  </div>
</template>
