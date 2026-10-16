<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ilIlceListesi from '../assets/il_ilce_sade.json'
import GoogleButon from '../components/GoogleButon.vue'
import { supabase } from '../supabase'
import { FormTemizlemeHatasi, hataMetni } from '../services/hata'
import { sifreDenetle, sifreKuraliDurumu } from '../services/sifre'
import { toast } from '../services/toast'
import {
  davetKodundanOgretmenBul,
  ogrenciKaydiOlustur,
  ogretmenKaydiOlustur,
  ogretmenleriGetir,
  okullariGetir,
} from '../services/kayit'

const router = useRouter()
const route = useRoute()

const sekme = ref('ogrenci')
const katilim = ref('davet')
const isLoading = ref(false)
let kayitSuruyor = false

const ad = ref('')
const soyad = ref('')
const eposta = ref('')
const sifre = ref('')
const sifreTekrar = ref('')
const googleOturumu = ref(null)
const brans = ref('')
const okulAdi = ref('')
const rumuz = ref('')
const sinif = ref('')
const davetKodu = ref('')
const seciliIl = ref('')
const seciliIlce = ref('')
const seciliOkulId = ref('')
const seciliOgretmenId = ref('')

const okullar = ref([])
const ogretmenler = ref([])
const okullarYukleniyor = ref(false)
const ogretmenlerYukleniyor = ref(false)
let okulIstekNo = 0
let ogretmenIstekNo = 0

const siniflar = [5, 6, 7, 8, 9, 10, 11, 12]
const iller = ilIlceListesi.map((kayit) => kayit.il)
const ilceler = computed(() => ilIlceListesi.find((kayit) => kayit.il === seciliIl.value)?.ilceler ?? [])
const okulSecimiGerekli = computed(() => sekme.value === 'ogrenci' && katilim.value !== 'davet')
const ogretmenSecimiGerekli = computed(() => sekme.value === 'ogrenci' && katilim.value === 'okul')
const kuralDurumu = computed(() => sifreKuraliDurumu(sifre.value))

const alanSinifi = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-900'

function sekmeDegistir(yeniSekme) {
  sekme.value = yeniSekme
}

function formuTemizle() {
  ad.value = ''
  soyad.value = ''
  eposta.value = ''
  sifre.value = ''
  sifreTekrar.value = ''
  brans.value = ''
  okulAdi.value = ''
  rumuz.value = ''
  sinif.value = ''
  davetKodu.value = ''
  seciliIl.value = ''
  seciliIlce.value = ''
  seciliOkulId.value = ''
  seciliOgretmenId.value = ''
  katilim.value = 'davet'
}

function googleBilgisiDoldur(kullanici) {
  googleOturumu.value = kullanici
  eposta.value = kullanici.email || ''
  const tamAd = kullanici.user_metadata?.full_name || kullanici.user_metadata?.name || ''
  const parcalar = tamAd.trim().split(/\s+/).filter(Boolean)
  if (!ad.value && parcalar[0]) ad.value = parcalar[0]
  if (!soyad.value && parcalar.length > 1) soyad.value = parcalar.slice(1).join(' ')
}

const davetBaglantisiyla = ref(false)

onMounted(async () => {
  const davet = typeof route.query.davet === 'string' ? route.query.davet.trim() : ''
  if (davet) {
    sekme.value = 'ogrenci'
    katilim.value = 'davet'
    davetKodu.value = davet.toUpperCase()
    davetBaglantisiyla.value = true
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) googleBilgisiDoldur(session.user)
})

async function googleCikis() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    toast.hata(hataMetni(error, 'Çıkış yapılamadı.'))
    return
  }
  googleOturumu.value = null
  formuTemizle()
}

watch(seciliIl, () => {
  seciliIlce.value = ''
  seciliOkulId.value = ''
  seciliOgretmenId.value = ''
})

watch(seciliIlce, () => {
  seciliOkulId.value = ''
  seciliOgretmenId.value = ''
})

watch([sekme, katilim, seciliIl, seciliIlce], okullariYukle)
watch(seciliOkulId, ogretmenleriYukle)

async function okullariYukle() {
  const istekNo = ++okulIstekNo
  okullar.value = []
  if (!okulSecimiGerekli.value || !seciliIl.value || !seciliIlce.value) {
    okullarYukleniyor.value = false
    return
  }

  const il = seciliIl.value
  const ilce = seciliIlce.value
  okullarYukleniyor.value = true
  try {
    const liste = await okullariGetir(il, ilce)
    if (istekNo !== okulIstekNo) return
    okullar.value = liste
  } catch (hata) {
    if (istekNo !== okulIstekNo) return
    toast.hata(hata.message || 'Okullar alınamadı.')
  } finally {
    if (istekNo === okulIstekNo) okullarYukleniyor.value = false
  }
}

async function ogretmenleriYukle() {
  const istekNo = ++ogretmenIstekNo
  ogretmenler.value = []
  if (!ogretmenSecimiGerekli.value || !seciliOkulId.value) {
    ogretmenlerYukleniyor.value = false
    return
  }

  const okulId = seciliOkulId.value
  ogretmenlerYukleniyor.value = true
  try {
    const liste = await ogretmenleriGetir(okulId)
    if (istekNo !== ogretmenIstekNo) return
    ogretmenler.value = liste
  } catch (hata) {
    if (istekNo !== ogretmenIstekNo) return
    toast.hata(hata.message || 'Öğretmenler alınamadı.')
  } finally {
    if (istekNo === ogretmenIstekNo) ogretmenlerYukleniyor.value = false
  }
}

async function ogretmenKaydet() {
  const davetKoduSonuc = await ogretmenKaydiOlustur({
    ad: ad.value,
    soyad: soyad.value,
    eposta: eposta.value,
    sifre: sifre.value,
    brans: brans.value,
    il: seciliIl.value,
    ilce: seciliIlce.value,
    okulAdi: okulAdi.value,
    kullaniciId: googleOturumu.value?.id,
  })
  formuTemizle()
  toast.basari(`Kayıt tamamlandı. Davet kodunuz: ${davetKoduSonuc}. Bu kodu öğrencilerinizle paylaşın.`, 15000)
  await router.push('/ogretmen')
}

async function ogrenciKaydet() {
  let okulId = seciliOkulId.value || null
  let danismanId = null
  let onayDurumu = false

  if (katilim.value === 'davet') {
    const ogretmen = await davetKodundanOgretmenBul(davetKodu.value)
    if (!ogretmen) throw new Error('Davet kodu bulunamadı.')
    okulId = ogretmen.okul_id
    danismanId = ogretmen.id
    onayDurumu = true
  } else if (katilim.value === 'okul') {
    if (!seciliOkulId.value || !seciliOgretmenId.value) throw new Error('Okul ve öğretmen seçin.')
    danismanId = seciliOgretmenId.value
    onayDurumu = false
  } else {
    if (!seciliOkulId.value) throw new Error('Okul seçin.')
    onayDurumu = true
  }

  await ogrenciKaydiOlustur({
    ad: ad.value,
    soyad: soyad.value,
    eposta: eposta.value,
    sifre: sifre.value,
    rumuz: rumuz.value,
    sinif: sinif.value,
    okulId,
    danismanId,
    onayDurumu,
    kullaniciId: googleOturumu.value?.id,
  })

  if (!onayDurumu) {
    await supabase.auth.signOut()
    formuTemizle()
    toast.uyari('Kayıt alındı. Öğretmen onayı bekleniyor.')
    return
  }

  formuTemizle()
  toast.basari('Kayıt tamamlandı.')
  await router.push('/ogrenci')
}

async function kaydet() {
  if (kayitSuruyor) return
  kayitSuruyor = true
  isLoading.value = true

  try {
    if (!googleOturumu.value) {
      const sifreSorunu = sifreDenetle(sifre.value, eposta.value)
      if (sifreSorunu) throw new Error(sifreSorunu)
      if (sifre.value !== sifreTekrar.value) throw new Error('Şifreler aynı değil.')
    }
    if (sekme.value === 'ogretmen') await ogretmenKaydet()
    else await ogrenciKaydet()
  } catch (hata) {
    if (hata instanceof FormTemizlemeHatasi) {
      formuTemizle()
      toast.uyari(hata.message)
      return
    }
    toast.hata(hataMetni(hata, 'Kayıt tamamlanamadı.'))
  } finally {
    isLoading.value = false
    kayitSuruyor = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
    <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow">
      <p class="text-sm font-medium text-slate-500">LGS Günlük Takip</p>
      <h1 class="text-2xl font-semibold text-slate-900">Kayıt</h1>

      <div class="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
        <button type="button" class="rounded-lg px-3 py-2 text-sm font-medium" :class="sekme === 'ogrenci' ? 'bg-slate-900 text-white' : 'text-slate-700'" @click="sekmeDegistir('ogrenci')">
          Öğrenci
        </button>
        <button type="button" class="rounded-lg px-3 py-2 text-sm font-medium" :class="sekme === 'ogretmen' ? 'bg-slate-900 text-white' : 'text-slate-700'" @click="sekmeDegistir('ogretmen')">
          Öğretmen
        </button>
      </div>

      <div v-if="!googleOturumu" class="mt-4 space-y-3">
        <GoogleButon amac="kayit" metin="Google ile kayıt ol" />
        <p class="text-center text-xs text-slate-400">veya e-posta ile</p>
      </div>
      <div v-else class="mt-4 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span>Google hesabı bağlandı.</span>
        <button type="button" class="font-medium underline" @click="googleCikis">Çıkış</button>
      </div>

      <form class="mt-4 space-y-4" @submit.prevent="kaydet">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm text-slate-700">
            Ad
            <input v-model="ad" required :class="alanSinifi" />
          </label>
          <label class="block text-sm text-slate-700">
            Soyad
            <input v-model="soyad" required :class="alanSinifi" />
          </label>
        </div>

        <label class="block text-sm text-slate-700">
          E-posta
          <input v-model="eposta" type="email" required autocomplete="email" :readonly="!!googleOturumu" :class="alanSinifi" />
        </label>
        <template v-if="!googleOturumu">
          <label class="block text-sm text-slate-700">
            Şifre
            <input v-model="sifre" type="password" required autocomplete="new-password" spellcheck="false" :class="alanSinifi" />
          </label>
          <ul class="space-y-1 text-xs">
            <li v-for="kural in kuralDurumu" :key="kural.id" :class="kural.tamam ? 'text-emerald-700' : 'text-slate-500'">
              {{ kural.tamam ? '✓' : '•' }} {{ kural.metin }}
            </li>
          </ul>
          <label class="block text-sm text-slate-700">
            Şifre tekrar
            <input v-model="sifreTekrar" type="password" required autocomplete="new-password" :class="alanSinifi" />
          </label>
        </template>

        <template v-if="sekme === 'ogretmen'">
          <label class="block text-sm text-slate-700">
            Branş
            <input v-model="brans" required :class="alanSinifi" />
          </label>
          <label class="block text-sm text-slate-700">
            İl
            <select v-model="seciliIl" required :class="alanSinifi">
              <option value="">İl seçin</option>
              <option v-for="il in iller" :key="il" :value="il">{{ il }}</option>
            </select>
          </label>
          <label class="block text-sm text-slate-700">
            İlçe
            <select v-model="seciliIlce" required :disabled="!seciliIl" :class="alanSinifi">
              <option value="">İlçe seçin</option>
              <option v-for="ilce in ilceler" :key="ilce" :value="ilce">{{ ilce }}</option>
            </select>
          </label>
          <label class="block text-sm text-slate-700">
            Okul adı
            <input v-model="okulAdi" required :class="alanSinifi" />
          </label>
        </template>

        <template v-else>
          <label class="block text-sm text-slate-700">
            Rumuz
            <input v-model="rumuz" required :class="alanSinifi" />
          </label>
          <label class="block text-sm text-slate-700">
            Sınıf
            <select v-model="sinif" required :class="alanSinifi">
              <option value="">Sınıf seçin</option>
              <option v-for="sinifNo in siniflar" :key="sinifNo" :value="sinifNo">{{ sinifNo }}</option>
            </select>
          </label>
          <label class="block text-sm text-slate-700">
            Sisteme katılım
            <select v-model="katilim" :class="alanSinifi">
              <option value="davet">Öğretmen Davet Kodum Var</option>
              <option value="okul">Okul ve Öğretmenimi Seçeceğim</option>
              <option value="bireysel">Bireysel Kullanacağım</option>
            </select>
          </label>

          <label v-if="katilim === 'davet'" class="block text-sm text-slate-700">
            Davet kodu
            <input v-model="davetKodu" required placeholder="BEY-4F2A" class="uppercase" :readonly="davetBaglantisiyla" :class="alanSinifi" />
            <span v-if="davetBaglantisiyla" class="mt-1 block text-xs text-slate-500">Davet bağlantısı kodu getirdi.</span>
          </label>

          <template v-else>
            <label class="block text-sm text-slate-700">
              İl
              <select v-model="seciliIl" required :class="alanSinifi">
                <option value="">İl seçin</option>
                <option v-for="il in iller" :key="il" :value="il">{{ il }}</option>
              </select>
            </label>
            <label class="block text-sm text-slate-700">
              İlçe
              <select v-model="seciliIlce" required :disabled="!seciliIl" :class="alanSinifi">
                <option value="">İlçe seçin</option>
                <option v-for="ilce in ilceler" :key="ilce" :value="ilce">{{ ilce }}</option>
              </select>
            </label>
            <label class="block text-sm text-slate-700">
              Okul
              <select v-model="seciliOkulId" required :disabled="!seciliIlce || okullarYukleniyor" :class="alanSinifi">
                <option value="">{{ okullarYukleniyor ? 'Okullar yükleniyor...' : 'Okul seçin' }}</option>
                <option v-for="okul in okullar" :key="okul.id" :value="okul.id">{{ okul.okul_adi }}</option>
              </select>
            </label>
            <p v-if="seciliIlce && !okullarYukleniyor && okullar.length === 0" class="text-sm text-slate-500">
              Bu ilçede kayıtlı okul yok.
            </p>
            <label v-if="katilim === 'okul'" class="block text-sm text-slate-700">
              Öğretmen
              <select v-model="seciliOgretmenId" required :disabled="!seciliOkulId || ogretmenlerYukleniyor" :class="alanSinifi">
                <option value="">{{ ogretmenlerYukleniyor ? 'Öğretmenler yükleniyor...' : 'Öğretmen seçin' }}</option>
                <option v-for="ogretmen in ogretmenler" :key="ogretmen.id" :value="ogretmen.id">
                  {{ ogretmen.ad_soyad }} ({{ ogretmen.brans }})
                </option>
              </select>
            </label>
            <p v-if="katilim === 'okul' && seciliOkulId && !ogretmenlerYukleniyor && ogretmenler.length === 0" class="text-sm text-slate-500">
              Bu okulda kayıtlı öğretmen yok.
            </p>
          </template>
        </template>

        <button type="submit" class="w-full rounded-lg bg-slate-900 px-3 py-2 text-white disabled:opacity-60" :disabled="isLoading">
          {{ isLoading ? 'Kaydediliyor...' : (googleOturumu ? 'Kaydı tamamla' : 'Kayıt ol') }}
        </button>
      </form>

      <p class="mt-4 text-sm text-slate-600">
        Hesabın var mı?
        <router-link to="/login" class="font-medium text-slate-900 underline">Giriş yap</router-link>
      </p>
    </div>
  </main>
</template>
