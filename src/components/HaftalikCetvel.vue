<script setup>
import { DERSLER, netYazi } from '../lib/dersler'

defineProps({
  rapor: { type: Object, required: true },
})

function hucre(gun, kod, alan) {
  const deger = gun.dersler[kod][alan]
  return alan === 'net' ? netYazi(deger) : deger
}
</script>

<template>
  <section class="kutu cetvel-kutu">
    <div class="bolum-baslik">
      <h2>{{ rapor.adSoyad }}</h2>
      <span class="soluk">{{ rapor.baslangic }} – {{ rapor.bitis }}</span>
    </div>
    <div class="sayi-serit cetvel-ozet">
      <article class="sayi-kart"><em>Toplam soru</em><strong>{{ rapor.toplamSoru }}</strong></article>
      <article class="sayi-kart"><em>Toplam net</em><strong>{{ rapor.netYazi }}</strong></article>
      <article class="sayi-kart"><em>Başarı</em><strong>% {{ rapor.basariYazi }}</strong></article>
      <article class="sayi-kart"><em>7 gün ort.</em><strong>{{ rapor.ortalamaYazi }}</strong></article>
      <article class="sayi-kart"><em>Sayfa</em><strong>{{ rapor.toplamSayfa }}</strong></article>
    </div>
    <article v-for="gun in rapor.gunler" :key="gun.tarih" class="gun-kart">
      <header>
        <strong>{{ gun.kisa }} {{ gun.uzun }}</strong>
        <span>{{ gun.soru }} soru · {{ netYazi(gun.net) }} net</span>
      </header>
      <ul>
        <li v-for="ders in DERSLER" :key="ders.kod">
          <b>{{ ders.ad }}</b>
          <span>{{ hucre(gun, ders.kod, 'dogru') }} doğru · {{ hucre(gun, ders.kod, 'yanlis') }} yanlış · {{ hucre(gun, ders.kod, 'net') }} net</span>
        </li>
      </ul>
      <footer>Deneme {{ gun.deneme ? 'Evet' : 'Hayır' }} · {{ gun.sayfa }} sayfa</footer>
    </article>
  </section>
</template>
