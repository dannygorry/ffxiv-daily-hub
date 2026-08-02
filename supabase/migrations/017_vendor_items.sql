-- Phase 3 of the Gil Opportunity Engines: vendor arbitrage.
--
-- Buying from an NPC vendor at a fixed price and reselling on the market board
-- needs one fact the Item sheet cannot give us: whether a vendor actually sells
-- the item.
--
-- `Item.PriceMid` is NOT that fact. It is populated on thousands of items no
-- vendor stocks, so treating a non-null PriceMid as "buyable from an NPC" would
-- invent an entire engine's worth of fake opportunities. The authoritative
-- source is the GilShopItem sheet, which lists ~6,700 genuinely vendor-sold
-- items, and it has to be enumerated and stored explicitly.
--
-- Null means "we have not checked", not "no vendor sells this" — the engine
-- requires an explicit true, so an unwarmed catalogue yields no vendor rows
-- rather than wrong ones.
alter table public.item_catalog
  add column sold_by_vendor boolean;

-- The engine filters hard on this flag, so it is worth an index despite the
-- table being small.
create index item_catalog_sold_by_vendor_idx
  on public.item_catalog (sold_by_vendor)
  where sold_by_vendor = true;

-- Computed per-world results, same versioned envelope as the other engines.
alter table public.marketplace_scans
  add column vendor_flips jsonb not null default '{"v":1,"items":[]}'::jsonb;
