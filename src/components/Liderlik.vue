<script setup>
import { computed } from 'vue'
import { netYazi } from '../lib/dersler'

const props = defineProps({
  kisiler: { type: Array, default: () => [] },
  benimId: { type: String, default: '' },
  benimOkul: { type: String, default: '' },
  olcut: { type: String, default: 'soru' },
  baslik: { type: String, default: 'Sıralama' },
  disariListe: { type: Boolean, default: false },
  adGoster: { type: Boolean, default: false },
})

const ETIKET = { soru: 'Soru', net: 'Net', kitap: 'Kitap' }

const ilkOn = computed(() => props.kisiler.filter((kisi) => kisi.sira == null || Number(kisi.sira) <= 10).slice(0, 10))
const toplam = computed(() => Number(props.kisiler[0]?.toplam || 0))
const benim = computed(() => props.kisiler.find((kisi) => kisi.ogrenci_id === props.benimId) || null)
const aralik = computed(() => {
  if (props.olcut === 'kitap') return 'Bu ay biten kitaplar.'
  if (props.olcut === 'net') return 'Bu haftanın neti.'
  return 'Bu hafta çözülen sorular.'
})
const disarida = computed(() => props.kisiler.find((kisi) => kisi.ogrenci_id === props.benimId && Number(kisi.sira) > 10) || null)
const disaridakiler = computed(() => {
  if (props.disariListe) return props.kisiler.filter((kisi) => Number(kisi.sira) > 10)
  return disarida.value ? [disarida.value] : []
})

function gorunenAd(kisi) {
  if (!props.adGoster) return kisi.rumuz
  const ad = kisi.ad_soyad || kisi.rumuz || ''
  return kisi.sinif ? `${ad}(${kisi.sinif})` : ad
}

function puan(kisi) {
  return props.olcut === 'net' ? netYazi(kisi.deger) : Number(kisi.deger || 0)
}

function okulYazi(kisi) {
  return kisi.okul || (kisi.ogrenci_id === props.benimId ? props.benimOkul : '')
}

function madalya(sira) {
  if (Number(sira) === 1) return 'altin'
  if (Number(sira) === 2) return 'gumus'
  if (Number(sira) === 3) return 'bronz'
  return ''
}
</script>

<template>
  <section v-if="ilkOn.length" class="pano">
    <h3 class="pano-baslik">{{ baslik }}</h3>
    <p class="pano-ozet">{{ aralik }}</p>
    <p v-if="toplam" class="pano-ozet">
      İlk 10 kişi sıralanır.
      <template v-if="benim && !disariListe"> {{ toplam }} öğrenci arasında {{ benim.sira }}. sıradasınız.</template>
    </p>
    <ol class="pano-liste">
      <li v-for="kisi in ilkOn" :key="kisi.ogrenci_id" class="pano-satir" :class="{ 'benim-ic': kisi.benim || kisi.ogrenci_id === benimId }">
        <span v-if="madalya(kisi.sira)" class="madalya" :class="madalya(kisi.sira)">{{ kisi.sira }}</span>
        <span v-else class="sira-duz">{{ kisi.sira }}</span>
        <span class="pano-kim">
          <strong>{{ gorunenAd(kisi) }}</strong>
          <small v-if="okulYazi(kisi)">{{ okulYazi(kisi) }}</small>
        </span>
        <span class="pano-puan">{{ puan(kisi) }}<small>{{ ETIKET[olcut] }}</small></span>
      </li>
    </ol>
    <div v-if="disaridakiler.length" class="pano-ayrik">
      <p v-if="!disariListe">İlk 10'un dışındasın</p>
      <div v-for="kisi in disaridakiler" :key="kisi.ogrenci_id" class="pano-satir disarida">
        <span class="sira-duz">{{ kisi.sira }}</span>
        <span class="pano-kim">
          <strong>{{ gorunenAd(kisi) }}</strong>
          <small v-if="okulYazi(kisi)">{{ okulYazi(kisi) }}</small>
        </span>
        <span class="pano-puan">{{ puan(kisi) }}<small>{{ ETIKET[olcut] }}</small></span>
      </div>
    </div>
  </section>
  <p v-else class="bos">Bu aralıkta aynı grupta henüz sıra yok.</p>
</template>
