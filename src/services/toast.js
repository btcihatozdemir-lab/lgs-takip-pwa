import { reactive } from 'vue'

export const toastDurumu = reactive({
  bildirimler: [],
})

const sonGosterim = new Map()
let siradakiId = 0

export function toastKapat(id) {
  const sira = toastDurumu.bildirimler.findIndex((bildirim) => bildirim.id === id)
  if (sira !== -1) toastDurumu.bildirimler.splice(sira, 1)
}

export function toastGoster(mesaj, tur = 'bilgi', sure = 5000) {
  const metin = String(mesaj || '').trim()
  if (!metin) return

  const simdi = Date.now()
  const anahtar = `${tur}:${metin}`
  const onceki = sonGosterim.get(anahtar)
  if (onceki && simdi - onceki < 5000) return
  sonGosterim.set(anahtar, simdi)

  const id = ++siradakiId
  toastDurumu.bildirimler.push({ id, metin, tur })
  window.setTimeout(() => toastKapat(id), sure)
}

export const toast = {
  basari: (mesaj, sure = 7000) => toastGoster(mesaj, 'basari', sure),
  hata: (mesaj, sure = 7000) => toastGoster(mesaj, 'hata', sure),
  uyari: (mesaj, sure = 9000) => toastGoster(mesaj, 'uyari', sure),
  bilgi: (mesaj, sure = 5000) => toastGoster(mesaj, 'bilgi', sure),
}
