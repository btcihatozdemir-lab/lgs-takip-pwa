const KURALLAR = [
  { id: 'uzunluk', metin: 'En az 10 karakter', gecerli: (sifre) => sifre.length >= 10 },
  { id: 'kucuk', metin: 'Küçük harf', gecerli: (sifre) => /[a-zçğıöşü]/.test(sifre) },
  { id: 'buyuk', metin: 'Büyük harf', gecerli: (sifre) => /[A-ZÇĞİÖŞÜ]/.test(sifre) },
  { id: 'rakam', metin: 'Rakam', gecerli: (sifre) => /\d/.test(sifre) },
  { id: 'ozel', metin: 'Özel karakter', gecerli: (sifre) => /[^\p{L}\p{N}]/u.test(sifre) },
]

const YAYGIN_SIFRELER = new Set([
  'password1!',
  'parola123!',
  'sifre1234!',
  'lgs12345!',
  '123456789a!',
  'qwerty123!',
])

export function sifreKuraliDurumu(sifre) {
  return KURALLAR.map((kural) => ({
    id: kural.id,
    metin: kural.metin,
    tamam: kural.gecerli(sifre || ''),
  }))
}

export function sifreDenetle(sifre, eposta = '') {
  const eksikler = sifreKuraliDurumu(sifre).filter((kural) => !kural.tamam).map((kural) => kural.metin)
  if (eksikler.length) return `Şifre şunları karşılamalı: ${eksikler.join(', ')}.`

  const yerel = String(eposta).split('@')[0].trim().toLowerCase()
  if (yerel.length >= 4 && String(sifre).toLowerCase().includes(yerel)) {
    return 'Şifre, e-posta adresinizin kullanıcı adını içeremez.'
  }

  if (YAYGIN_SIFRELER.has(String(sifre).toLowerCase())) {
    return 'Bu şifre çok yaygın. Daha zor bir şifre seçin.'
  }

  return ''
}
