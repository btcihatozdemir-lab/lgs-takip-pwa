-- Bir öğrencinin tek danışmanı vardır (ogrenciler.danisman_id).
-- Pazartesi postasını alacak öğretmenler ayrı listedir; danışman sayılmaz.

create table if not exists public.gunluk_kayitlar (
  id uuid primary key default gen_random_uuid(),
  ogrenci_id uuid not null references public.ogrenciler(id) on delete cascade,
  tarih date not null,
  turkce_soru int not null default 0,
  turkce_dogru int not null default 0,
  turkce_yanlis int not null default 0,
  matematik_soru int not null default 0,
  matematik_dogru int not null default 0,
  matematik_yanlis int not null default 0,
  fen_soru int not null default 0,
  fen_dogru int not null default 0,
  fen_yanlis int not null default 0,
  inkilap_soru int not null default 0,
  inkilap_dogru int not null default 0,
  inkilap_yanlis int not null default 0,
  din_soru int not null default 0,
  din_dogru int not null default 0,
  din_yanlis int not null default 0,
  ingilizce_soru int not null default 0,
  ingilizce_dogru int not null default 0,
  ingilizce_yanlis int not null default 0,
  deneme boolean not null default false,
  kitap_sayfa int not null default 0,
  kitap_bitti boolean not null default false,
  kitap_adi text,
  kitap_yorum text,
  kelime text,
  kelime_anlam text,
  ingilizce_kelime text,
  ingilizce_anlam text,
  deyim text,
  deyim_anlam text,
  verim smallint,
  gun_notu text,
  unique (ogrenci_id, tarih)
);

alter table public.gunluk_kayitlar
  add column if not exists deneme boolean not null default false,
  add column if not exists kitap_sayfa int not null default 0,
  add column if not exists kitap_bitti boolean not null default false,
  add column if not exists kitap_adi text,
  add column if not exists kitap_yorum text,
  add column if not exists kelime text,
  add column if not exists kelime_anlam text,
  add column if not exists ingilizce_kelime text,
  add column if not exists ingilizce_anlam text,
  add column if not exists deyim text,
  add column if not exists deyim_anlam text,
  add column if not exists verim smallint,
  add column if not exists gun_notu text;

create table if not exists public.kitaplar (
  id uuid primary key default gen_random_uuid(),
  ogrenci_id uuid not null references public.ogrenciler(id) on delete cascade,
  ad text not null,
  yorum text,
  bitti_tarihi date not null default current_date
);

alter table public.kitaplar add column if not exists yorum text;

create table if not exists public.cetel_alicilar (
  ogrenci_id uuid not null references public.ogrenciler(id) on delete cascade,
  ogretmen_id uuid not null references public.ogretmenler(id) on delete cascade,
  primary key (ogrenci_id, ogretmen_id)
);

alter table public.gunluk_kayitlar enable row level security;
alter table public.kitaplar enable row level security;
alter table public.cetel_alicilar enable row level security;

drop policy if exists lgs_gunluk_ogrenci on public.gunluk_kayitlar;
create policy lgs_gunluk_ogrenci on public.gunluk_kayitlar
  for all using (ogrenci_id = auth.uid()) with check (ogrenci_id = auth.uid());

drop policy if exists lgs_gunluk_ogretmen on public.gunluk_kayitlar;
create policy lgs_gunluk_ogretmen on public.gunluk_kayitlar
  for select using (
    exists (
      select 1 from public.ogrenciler o
      join public.ogretmenler g on g.okul_id = o.okul_id
      where o.id = gunluk_kayitlar.ogrenci_id and g.id = auth.uid()
    )
  );

drop policy if exists lgs_kitap_ogrenci on public.kitaplar;
create policy lgs_kitap_ogrenci on public.kitaplar
  for all using (ogrenci_id = auth.uid()) with check (ogrenci_id = auth.uid());

drop policy if exists lgs_kitap_ogretmen on public.kitaplar;
create policy lgs_kitap_ogretmen on public.kitaplar
  for select using (
    exists (
      select 1 from public.ogrenciler o
      join public.ogretmenler g on g.okul_id = o.okul_id
      where o.id = kitaplar.ogrenci_id and g.id = auth.uid()
    )
  );

drop policy if exists lgs_cetel_ogrenci on public.cetel_alicilar;
create policy lgs_cetel_ogrenci on public.cetel_alicilar
  for all using (ogrenci_id = auth.uid()) with check (ogrenci_id = auth.uid());

create or replace function public.gun_soru(k public.gunluk_kayitlar)
returns int language sql immutable as $$
  select k.turkce_soru + k.matematik_soru + k.fen_soru + k.inkilap_soru + k.din_soru + k.ingilizce_soru
$$;

create or replace function public.gun_net(k public.gunluk_kayitlar)
returns numeric language sql immutable as $$
  select
    (k.turkce_dogru - k.turkce_yanlis / 4.0) +
    (k.matematik_dogru - k.matematik_yanlis / 4.0) +
    (k.fen_dogru - k.fen_yanlis / 4.0) +
    (k.inkilap_dogru - k.inkilap_yanlis / 4.0) +
    (k.din_dogru - k.din_yanlis / 4.0) +
    (k.ingilizce_dogru - k.ingilizce_yanlis / 4.0)
$$;

drop function if exists public.liderlik(text, text, text);

create function public.liderlik(p_sinif text, p_il text, p_olcut text)
returns table (ogrenci_id uuid, rumuz text, okul text, deger numeric, sira int, toplam int)
language sql stable security definer set search_path = public as $$
  with aday as (
    select o.id, o.rumuz, k.okul_adi
    from ogrenciler o
    join okullar k on k.id = o.okul_id
    where o.onay_durumu is true and o.sinif::text = p_sinif and k.il = p_il
  ),
  zaman as (
    select (timezone('Europe/Istanbul', now()))::date as bugun
  ),
  sinir as (
    select bugun,
      bugun - (extract(isodow from bugun)::int - 1) as hafta_basi,
      date_trunc('month', bugun)::date as ay_basi
    from zaman
  ),
  puan as (
    select a.id, a.rumuz, a.okul_adi,
      case p_olcut
        when 'kitap' then (
          select count(*) from kitaplar b, sinir z
          where b.ogrenci_id = a.id and b.bitti_tarihi >= z.ay_basi
        )::numeric
        when 'net' then coalesce((
          select sum(gun_net(g)) from gunluk_kayitlar g, sinir z
          where g.ogrenci_id = a.id and g.tarih >= z.hafta_basi and g.tarih <= z.bugun
        ), 0)
        else coalesce((
          select sum(gun_soru(g)) from gunluk_kayitlar g, sinir z
          where g.ogrenci_id = a.id and g.tarih >= z.hafta_basi and g.tarih <= z.bugun
        ), 0)
      end as deger
    from aday a
  ),
  sirali as (
    select p.id, p.rumuz, p.okul_adi, p.deger,
      row_number() over (order by p.deger desc, p.rumuz)::int as sira,
      count(*) over ()::int as toplam
    from puan p
  )
  select s.id, s.rumuz, s.okul_adi, s.deger, s.sira, s.toplam
  from sirali s
  where s.sira <= 10 or s.id = auth.uid()
  order by s.sira
$$;

create or replace function public.aylik_ozet(p_ogrenci uuid)
returns table (ay date, soru bigint, net numeric, kitap bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is distinct from p_ogrenci and not exists (
    select 1 from ogrenciler o
    join ogretmenler t on t.okul_id = o.okul_id
    where o.id = p_ogrenci and t.id = auth.uid()
  ) then
    return;
  end if;

  return query
  with aylar as (
    select date_trunc('month', g.tarih)::date as ay,
      sum(gun_soru(g))::bigint as soru,
      trunc(sum(gun_net(g)), 2) as net
    from gunluk_kayitlar g
    where g.ogrenci_id = p_ogrenci
      and g.tarih >= (current_date - interval '5 months')::date
    group by 1
  )
  select a.ay, a.soru, a.net,
    (select count(*) from kitaplar b
      where b.ogrenci_id = p_ogrenci
        and date_trunc('month', b.bitti_tarihi)::date = a.ay)
  from aylar a
  order by a.ay desc;
end;
$$;

create or replace function public.okul_ozet(p_okul uuid)
returns table (ogrenci_sayisi bigint, soru numeric, net numeric, kitap numeric)
language sql stable security definer set search_path = public as $$
  with ogr as (
    select id from ogrenciler where okul_id = p_okul and onay_durumu is true
  )
  select count(*),
    coalesce(round(avg(s.soru), 1), 0),
    coalesce(trunc(avg(s.net), 2), 0),
    coalesce(round(avg(s.kitap), 1), 0)
  from ogr o
  left join lateral (
    select coalesce(sum(gun_soru(g)), 0) soru, coalesce(sum(gun_net(g)), 0) net,
      (select count(*) from kitaplar b where b.ogrenci_id = o.id and b.bitti_tarihi >= (timezone('Europe/Istanbul', now()))::date - (extract(isodow from timezone('Europe/Istanbul', now()))::int - 1)) kitap
    from gunluk_kayitlar g
    where g.ogrenci_id = o.id
      and g.tarih >= (timezone('Europe/Istanbul', now()))::date - (extract(isodow from timezone('Europe/Istanbul', now()))::int - 1)
      and g.tarih <= (timezone('Europe/Istanbul', now()))::date
  ) s on true
$$;

create or replace function public.bolge_ozet(p_il text, p_ilce text)
returns table (ogrenci_sayisi bigint, soru numeric, net numeric)
language sql stable security definer set search_path = public as $$
  with ogr as (
    select o.id from ogrenciler o
    join okullar k on k.id = o.okul_id
    where o.onay_durumu is true and k.il = p_il and k.ilce = p_ilce
  )
  select count(*),
    coalesce(round(avg(s.soru), 1), 0),
    coalesce(trunc(avg(s.net), 2), 0)
  from ogr o
  left join lateral (
    select coalesce(sum(gun_soru(g)), 0) soru, coalesce(sum(gun_net(g)), 0) net
    from gunluk_kayitlar g
    where g.ogrenci_id = o.id
      and g.tarih >= (timezone('Europe/Istanbul', now()))::date - (extract(isodow from timezone('Europe/Istanbul', now()))::int - 1)
      and g.tarih <= (timezone('Europe/Istanbul', now()))::date
  ) s on true
$$;

create or replace function public.ders_ozet(p_okul uuid)
returns table (ders text, soru bigint, net numeric)
language sql stable security definer set search_path = public as $$
  with g as (
    select gunluk_kayitlar.*
    from gunluk_kayitlar
    join ogrenciler o on o.id = gunluk_kayitlar.ogrenci_id
    where o.okul_id = p_okul and o.onay_durumu is true
      and gunluk_kayitlar.tarih >= (timezone('Europe/Istanbul', now()))::date - 6
      and gunluk_kayitlar.tarih <= (timezone('Europe/Istanbul', now()))::date
  )
  select * from (
    select 'Türkçe' ders, coalesce(sum(turkce_soru), 0)::bigint soru, trunc(coalesce(sum(turkce_dogru - turkce_yanlis / 4.0), 0), 2) net from g
    union all select 'Matematik', coalesce(sum(matematik_soru), 0)::bigint, trunc(coalesce(sum(matematik_dogru - matematik_yanlis / 4.0), 0), 2) from g
    union all select 'Fen', coalesce(sum(fen_soru), 0)::bigint, trunc(coalesce(sum(fen_dogru - fen_yanlis / 4.0), 0), 2) from g
    union all select 'İnkılap', coalesce(sum(inkilap_soru), 0)::bigint, trunc(coalesce(sum(inkilap_dogru - inkilap_yanlis / 4.0), 0), 2) from g
    union all select 'Din', coalesce(sum(din_soru), 0)::bigint, trunc(coalesce(sum(din_dogru - din_yanlis / 4.0), 0), 2) from g
    union all select 'İngilizce', coalesce(sum(ingilizce_soru), 0)::bigint, trunc(coalesce(sum(ingilizce_dogru - ingilizce_yanlis / 4.0), 0), 2) from g
  ) d
$$;

create unique index if not exists ogrenciler_rumuz_tekil
  on public.ogrenciler (lower(btrim(rumuz)));

create or replace function public.rumuz_musait(p_rumuz text)
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from ogrenciler
    where lower(btrim(rumuz)) = lower(btrim(p_rumuz))
      and id is distinct from auth.uid()
  );
$$;

grant execute on function public.liderlik(text, text, text) to authenticated;
grant execute on function public.rumuz_musait(text) to anon, authenticated;
grant execute on function public.aylik_ozet(uuid) to authenticated;
grant execute on function public.okul_ozet(uuid) to authenticated;
grant execute on function public.bolge_ozet(text, text) to authenticated;
grant execute on function public.ders_ozet(uuid) to authenticated;

create or replace function public.kademe_ozet(p_il text, p_ilce text, p_okul uuid, p_alt int, p_ust int)
returns table (soru numeric, net numeric, kitap numeric, basari numeric)
language sql stable security definer set search_path = public as $$
  with pencere as (
    select (timezone('Europe/Istanbul', now()))::date as bitis,
           (timezone('Europe/Istanbul', now()))::date - 6 as baslangic
  ),
  ogr as (
    select o.id
    from ogrenciler o
    join okullar k on k.id = o.okul_id
    where o.onay_durumu is true
      and k.il = p_il
      and (p_ilce is null or p_ilce = '' or k.ilce = p_ilce)
      and (p_okul is null or o.okul_id = p_okul)
      and o.sinif between p_alt and p_ust
  ),
  gun as (
    select coalesce(sum(gun_soru(g)), 0) as soru,
           coalesce(sum(gun_net(g)), 0) as net,
           coalesce(sum(g.turkce_dogru + g.matematik_dogru + g.fen_dogru + g.inkilap_dogru + g.din_dogru + g.ingilizce_dogru), 0) as dogru,
           coalesce(sum(g.kitap_sayfa), 0) as sayfa
    from pencere p
    left join gunluk_kayitlar g
      on g.ogrenci_id in (select id from ogr)
     and g.tarih >= p.baslangic
     and g.tarih <= p.bitis
  )
  select round(gun.soru / 7.0, 1),
         trunc(gun.net / 7.0, 2),
         round(gun.sayfa / 7.0, 1),
         case when gun.soru = 0 then 0 else trunc((gun.dogru::numeric / gun.soru) * 100, 1) end
  from gun
$$;

grant execute on function public.kademe_ozet(text, text, uuid, int, int) to authenticated;

create or replace function public.ders_kademe_ozet(p_il text, p_ilce text, p_okul uuid, p_alt int, p_ust int)
returns table (ders text, soru numeric, net numeric, basari numeric)
language sql stable security definer set search_path = public as $$
  with pencere as (
    select (timezone('Europe/Istanbul', now()))::date as bitis,
           (timezone('Europe/Istanbul', now()))::date - 6 as baslangic
  ),
  g as (
    select gunluk_kayitlar.*
    from gunluk_kayitlar
    join ogrenciler o on o.id = gunluk_kayitlar.ogrenci_id
    join okullar k on k.id = o.okul_id
    cross join pencere p
    where o.onay_durumu is true
      and k.il = p_il
      and (p_ilce is null or p_ilce = '' or k.ilce = p_ilce)
      and (p_okul is null or o.okul_id = p_okul)
      and o.sinif between p_alt and p_ust
      and gunluk_kayitlar.tarih >= p.baslangic
      and gunluk_kayitlar.tarih <= p.bitis
  )
  select * from (
    select 'Türkçe' ders,
      round(coalesce(sum(turkce_soru), 0) / 7.0, 1),
      trunc(coalesce(sum(turkce_dogru - turkce_yanlis / 4.0), 0) / 7.0, 2),
      case when coalesce(sum(turkce_soru), 0) = 0 then 0 else trunc(sum(turkce_dogru)::numeric / sum(turkce_soru) * 100, 1) end
    from g
    union all select 'Matematik',
      round(coalesce(sum(matematik_soru), 0) / 7.0, 1),
      trunc(coalesce(sum(matematik_dogru - matematik_yanlis / 4.0), 0) / 7.0, 2),
      case when coalesce(sum(matematik_soru), 0) = 0 then 0 else trunc(sum(matematik_dogru)::numeric / sum(matematik_soru) * 100, 1) end
    from g
    union all select 'Fen',
      round(coalesce(sum(fen_soru), 0) / 7.0, 1),
      trunc(coalesce(sum(fen_dogru - fen_yanlis / 4.0), 0) / 7.0, 2),
      case when coalesce(sum(fen_soru), 0) = 0 then 0 else trunc(sum(fen_dogru)::numeric / sum(fen_soru) * 100, 1) end
    from g
    union all select 'İnkılap',
      round(coalesce(sum(inkilap_soru), 0) / 7.0, 1),
      trunc(coalesce(sum(inkilap_dogru - inkilap_yanlis / 4.0), 0) / 7.0, 2),
      case when coalesce(sum(inkilap_soru), 0) = 0 then 0 else trunc(sum(inkilap_dogru)::numeric / sum(inkilap_soru) * 100, 1) end
    from g
    union all select 'Din',
      round(coalesce(sum(din_soru), 0) / 7.0, 1),
      trunc(coalesce(sum(din_dogru - din_yanlis / 4.0), 0) / 7.0, 2),
      case when coalesce(sum(din_soru), 0) = 0 then 0 else trunc(sum(din_dogru)::numeric / sum(din_soru) * 100, 1) end
    from g
    union all select 'İngilizce',
      round(coalesce(sum(ingilizce_soru), 0) / 7.0, 1),
      trunc(coalesce(sum(ingilizce_dogru - ingilizce_yanlis / 4.0), 0) / 7.0, 2),
      case when coalesce(sum(ingilizce_soru), 0) = 0 then 0 else trunc(sum(ingilizce_dogru)::numeric / sum(ingilizce_soru) * 100, 1) end
    from g
  ) d
$$;

grant execute on function public.ders_kademe_ozet(text, text, uuid, int, int) to authenticated;

drop policy if exists lgs_okul_ogretmen_guncelle on public.okullar;
create policy lgs_okul_ogretmen_guncelle on public.okullar
  for update using (
    exists (
      select 1 from public.ogretmenler g
      where g.okul_id = okullar.id and g.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ogretmenler g
      where g.okul_id = okullar.id and g.id = auth.uid()
    )
  );

create table if not exists public.posta_gunlugu (
  ogrenci_id uuid not null references public.ogrenciler(id) on delete cascade,
  ogretmen_id uuid not null references public.ogretmenler(id) on delete cascade,
  hafta_baslangic date not null,
  gonderildi_at timestamptz not null default now(),
  primary key (ogrenci_id, ogretmen_id, hafta_baslangic)
);

alter table public.posta_gunlugu enable row level security;

-- Pazartesi 08:00 İstanbul = 05:00 UTC. pg_cron ve pg_net açık olmalı.
-- Sırlar Supabase gizli anahtarlarında: CRON_SECRET, RESEND_API_KEY, POSTA_GONDEREN.
-- select cron.schedule(
--   'lgs-haftalik-cetvel',
--   '0 5 * * 1',
--   $$
--   select net.http_post(
--     url := 'https://mktwodzgublgohanzmtw.supabase.co/functions/v1/haftalik-posta',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'x-cron-secret', 'CRON_SECRET_BURAYA'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
