# Kunlik hisobot tizimi

HTML + CSS + JS (freymvorksiz) va Supabase. Loginsiz, ochiq tizim. Minimal dizayn, mobilga moslashgan.

## Ishga tushirish

1. **Lokal sinov:** `index.html` ni brauzerda oching (yoki `python3 -m http.server`).
   Supabase sozlanmagan bo'lsa, ma'lumot shu brauzerning o'zida saqlanadi ("Lokal rejim").
2. **Supabase:**
   - Supabase'da yangi loyiha oching → **SQL Editor** → `supabase/schema.sql` ni ishga tushiring.
   - **Project Settings → API** dan URL va anon/publishable kalitni `js/config.js` ga yozing.
   - Yuqori o'ng burchakda "● Supabase" chiqadi.
3. **Hosting:** papkani istalgan statik hostingga joylang (Vercel, Netlify, GitHub Pages).

## Imkoniyatlar

- Birinchi ochilishda: 1) markaz yaratish → 2) filiallarni qo'shish → 3) hisobot
- Header: filiallar orasida almashish va "Barchasi" (umumiy yig'indi)
- Sozlamalar (⚙): filiallar, ustunlar, markaz (nomi, boshqa markazlar, o'chirish)
- Har bir kun 2 qatordan iborat: qiymat va foiz (foizlar avtomatik hisoblanadi)
- O'sish hajmi = Shartnoma + Qaytganlar − Ketganlar − Muzlatilganlar (formula)
- Yakshanbalar avtomatik dam olish kuni (qizil); sanani bosib o'zgartirish mumkin
- Klaviatura: ↑ ↓ ← →, Enter, Esc; Excel/Sheets'dan bir nechta katakni nusxalab qo'yish
- Uch ko'rinish: Jadval (oylik) · Haftalik (kunlikdan avtomatik yig'iladi, Du–Ya) · Kunlik (mobil shakl)
- Kun / tun rejimi (header'dagi tugma, tanlov eslab qolinadi)
- Ustunlarni sozlash: qo'shish, nomini o'zgartirish, yashirish, tartib, foiz asosi, formula
- CSV eksport (Excel ochadi)
- Supabase realtime: boshqa qurilmadagi o'zgarishlar jonli ko'rinadi

## Tuzilma

```
index.html
css/style.css
js/config.js   — Supabase kalitlari
js/db.js       — Supabase / lokal ma'lumot qatlami
js/icons.js    — SVG ikonkalar
js/util.js     — yordamchilar, ustunlar va hisob-kitob
js/views.js    — header, boshlang'ich sozlash, sozlamalar
js/sheet.js    — hisobot jadvali va kunlik ko'rinish
js/app.js      — marshrutlash
supabase/schema.sql
```

> Diqqat: tizim ochiq — anon kalitga ega har kim ma'lumotni o'qiy va o'zgartira oladi.
