<script setup>
import { computed } from 'vue'
import { netYazi } from '../lib/dersler'

const props = defineProps({
  kisiler: { type: Array, default: () => [] },
  benimId: { type: String, default: '' },
  benimOkul: { type: String, default: '' },
  olcut: { type: String, default: 'soru' },
  baslik: { type: String, default: 'Sıralama' },
})

const ETIKET = { soru: 'Soru', net: 'Net', kitap: 'Kitap' }
const RENKLER = ['#8d4b32', '#1e4d3a', '#21596f', '#6d5424', '#5a4874', '#3c5c49']

const ilkOn = computed(() => props.kisiler.filter((kisi) => kisi.sira == null || Number(kisi.sira) <= 10).slice(0, 10))
const toplam = computed(() => Number(props.kisiler[0]?.toplam || 0))
const benim = computed(() => props.kisiler.find((kisi) => kisi.ogrenci_id === props.benimId) || null)
const disarida = computed(() => props.kisiler.find((kisi) => kisi.ogrenci_id === props.benimId && Number(kisi.sira) > 10) || null)

function harf(ad) {
  return (ad || '?').trim().charAt(0).toLocaleUpperCase('tr-TR')
}

function renk(ad) {
  const toplamKod = [...(ad || '?')].reduce((sayi, karakter) => sayi + karakter.charCodeAt(0), 0)
  return RENKLER[toplamKod % RENKLER.length]
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
    <p v-if="toplam" class="pano-ozet">
      İlk 10 kişi sıralanır.
      <template v-if="benim"> {{ toplam }} öğrenci arasında {{ benim.sira }}. sıradasınız.</template>
    </p>
    <ol class="pano-liste">
      <li v-for="kisi in ilkOn" :key="kisi.ogrenci_id" class="pano-satir" :class="{ 'benim-ic': kisi.ogrenci_id === benimId }">
        <span v-if="madalya(kisi.sira)" class="madalya" :class="madalya(kisi.sira)">{{ kisi.sira }}</span>
        <span v-else class="sira-duz">{{ kisi.sira }}</span>
        <span class="pano-avatar" :style="{ background: renk(kisi.rumuz) }">{{ harf(kisi.rumuz) }}</span>
        <span class="pano-kim">
          <strong>{{ kisi.rumuz }}</strong>
          <small v-if="okulYazi(kisi)">{{ okulYazi(kisi) }}</small>
        </span>
        <span class="pano-puan">{{ puan(kisi) }}<small>{{ ETIKET[olcut] }}</small></span>
      </li>
    </ol>
    <div v-if="disarida" class="pano-ayrik">
      <p>İlk 10'un dışındasın</p>
      <div class="pano-satir disarida">
        <span class="sira-duz">{{ disarida.sira }}</span>
        <span class="pano-avatar" :style="{ background: renk(disarida.rumuz) }">{{ harf(disarida.rumuz) }}</span>
        <span class="pano-kim">
          <strong>{{ disarida.rumuz }}</strong>
          <small v-if="okulYazi(disarida)">{{ okulYazi(disarida) }}</small>
        </span>
        <span class="pano-puan">{{ puan(disarida) }}<small>{{ ETIKET[olcut] }}</small></span>
      </div>
    </div>
  </section>
  <p v-else class="bos">Bu ay aynı grupta henüz sıra yok.</p>
</template>
