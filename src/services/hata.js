import { toast } from './toast'

export class FormTemizlemeHatasi extends Error {
  constructor(mesaj) {
    super(mesaj)
    this.name = 'FormTemizlemeHatasi'
  }
}

export function hataMetni(hata, yedek = 'Beklenmeyen bir hata oluştu.') {
  const mesaj = typeof hata === 'string' ? hata : hata?.message
  if (!mesaj) return yedek

  const kucuk = mesaj.toLowerCase()
  if (kucuk.includes('invalid login')) return 'E-posta veya şifre hatalı.'
  if (kucuk.includes('email not confirmed') || kucuk.includes('not confirmed')) {
    return 'E-posta adresiniz henüz doğrulanmamış.'
  }
  if (kucuk.includes('failed to fetch') || kucuk.includes('network')) {
    return 'Bağlantı kurulamadı. İnternetinizi kontrol edin.'
  }
  if (kucuk.includes('already') || kucuk.includes('registered') || kucuk.includes('user already')) {
    return 'Bu e-posta zaten kayıtlı. Giriş yapın.'
  }
  return mesaj
}

export function hataBildir(hata) {
  if (hata?.name === 'FormTemizlemeHatasi') {
    toast.uyari(hata.message)
    return
  }
  toast.hata(hataMetni(hata))
}
