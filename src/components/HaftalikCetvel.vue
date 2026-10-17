<script setup>
import { DERSLER } from '../lib/dersler'

defineProps({
  rapor: { type: Object, required: true },
})

const HAFTA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

function haftaAdi(iso) {
  const [yil, ay, gun] = iso.split('-').map(Number)
  return HAFTA[new Date(Date.UTC(yil, ay - 1, gun)).getUTCDay()]
}

function hucre(gun, kod) {
  const soru = gun.dersler[kod].soru
  return soru ? soru : '·'
}
</script>

<template>
  <section class="ogrenci-cetvel">
    <p class="cetvel-aralik">{{ rapor.baslangic }} – {{ rapor.bitis }}</p>
    <div class="cetvel-kaydir">
      <table class="cetvel-tablo">
        <thead>
          <tr>
            <th></th>
            <th v-for="gun in rapor.gunler" :key="gun.tarih" :class="{ bugun: gun.tarih === rapor.bitis }">
              <b>{{ haftaAdi(gun.tarih) }}</b>
              <small>{{ gun.kisa }}</small>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ders in DERSLER" :key="ders.kod">
            <th>{{ ders.ad }}</th>
            <td v-for="gun in rapor.gunler" :key="gun.tarih" :class="{ dolu: gun.dersler[ders.kod].soru, bugun: gun.tarih === rapor.bitis }">{{ hucre(gun, ders.kod) }}</td>
          </tr>
          <tr class="cetvel-toplam">
            <th>Soru</th>
            <td v-for="gun in rapor.gunler" :key="gun.tarih" :class="{ dolu: gun.soru, bugun: gun.tarih === rapor.bitis }">{{ gun.soru || '·' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
