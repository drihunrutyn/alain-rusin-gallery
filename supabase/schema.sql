-- Дополнительная схема исходного ТЗ. Активная реализация использует Drizzle/Turso.
begin;
create extension if not exists pgcrypto;
create table if not exists public.artworks (
 id uuid primary key default gen_random_uuid(), title text not null,
 series text not null check (series in ('aquatica','quiet_life','iris_flowers','northern_palmyra')),
 technique text, year int, dimensions text, framing text, price numeric default 0 check (price >= 0),
 status text default 'available' check (status in ('available','reserved','sold','private')),
 description text, image_url text not null, is_featured bool default false, created_at timestamptz default now()
);
create table if not exists public.requests (
 id uuid primary key default gen_random_uuid(), client_name text, client_contact text,
 artwork_id uuid references public.artworks on delete set null, artwork_title text, message text,
 status text default 'new' check (status in ('new','processed')), created_at timestamptz default now()
);
create table if not exists public.content (
 id uuid primary key default gen_random_uuid(), type text check (type in ('interview','article','press','exhibition')),
 title text, description text, link text, embed_url text, image_url text, location text, event_date text, created_at timestamptz default now()
);
create table if not exists public.subscribers (id uuid primary key default gen_random_uuid(), email text unique, created_at timestamptz default now());
create table if not exists public.page_views (id uuid primary key default gen_random_uuid(), route text, artwork_id uuid, viewed_at timestamptz default now());
create table if not exists public.admin_settings (key text primary key, value text not null);
create table if not exists public.rooms (id uuid primary key default gen_random_uuid(), image_url text not null, created_at timestamptz default now());
alter table public.artworks enable row level security;
alter table public.content enable row level security;
alter table public.requests enable row level security;
alter table public.subscribers enable row level security;
alter table public.page_views enable row level security;
alter table public.admin_settings enable row level security;
alter table public.rooms enable row level security;
drop policy if exists artworks_read on public.artworks;
create policy artworks_read on public.artworks for select to anon using (true);
drop policy if exists content_read on public.content;
create policy content_read on public.content for select to anon using (true);
drop policy if exists rooms_read on public.rooms;
create policy rooms_read on public.rooms for select to anon using (true);
drop policy if exists requests_insert on public.requests;
create policy requests_insert on public.requests for insert to anon with check (true);
drop policy if exists subscribers_insert on public.subscribers;
create policy subscribers_insert on public.subscribers for insert to anon with check (true);
drop policy if exists views_insert on public.page_views;
create policy views_insert on public.page_views for insert to anon with check (true);
-- Отсутствие SELECT/UPDATE/DELETE policies закрывает эти операции для anon.
insert into storage.buckets (id,name,public) values ('artworks','artworks',true),('content','content',true),('rooms','rooms',true) on conflict (id) do nothing;
insert into public.artworks(id,title,series,technique,year,dimensions,framing,price,image_url,description,is_featured) values
 ('00000000-0000-4000-8000-000000000001','Шёпот прибоя в сумерках','aquatica','Сухая пастель, мел, бумага Pastelmat',2025,'30×40 см','дубовая рама лёгкой патины',18000,'/images/seeds/aquatika.jpg','Исследование физики света на гребне волны: пастель передаёт не форму воды, а её дыхание и температуру в час заката.',true),
 ('00000000-0000-4000-8000-000000000002','Полуденный кофе и тени','quiet_life','Акрил, фактурная паста, холст на подрамнике',2025,'40×50 см','рама Certa, итальянская патина, бронза',25000,'/images/seeds/quiet-life.jpg','Предмет как живой собеседник: бытовая сцена, наполненная теплом и драматургией света в традиции французских импрессионистов.',true),
 ('00000000-0000-4000-8000-000000000003','Ирис. Индиго и золото','iris_flowers','Сухая пастель, цветной карандаш, тонированная крафтовая бумага',2025,'30×40 см','паспарту, стекло с УФ-защитой',15000,'/images/seeds/iris-flowers.jpg','Портрет цветка на границе фотореализма и абстракции: внутреннее сияние лепестка важнее ботанической точности.',true),
 ('00000000-0000-4000-8000-000000000004','Отражение в канале Грибоедова','northern_palmyra','Смешанная техника, акрил и пастель, холст',2025,'40×50 см','сдержанный современный багет',22000,'/images/seeds/northern-palmyra.jpg','Серебряный свет Невы и геометрия гранита, пропущенные через взгляд средового дизайнера.',true)
on conflict(id) do nothing;
insert into public.content(id,type,title,embed_url,link) values
 ('00000000-0000-4000-8000-000000000011','interview','Видео-интервью: о синтезе дизайна и живописи','https://vk.com/video_ext.php?oid=-30015658&id=456242764','https://vkvideo.ru/video-30015658_456242764'),
 ('00000000-0000-4000-8000-000000000012','article','Авторская статья на Артхиве',null,'https://artchive.ru/alain_rusin/stories/31862'),
 ('00000000-0000-4000-8000-000000000013','press','СМИ обо мне: публикация о творческом пути',null,'https://bst.bratsk.ru/news/50656')
on conflict(id) do nothing;
commit;