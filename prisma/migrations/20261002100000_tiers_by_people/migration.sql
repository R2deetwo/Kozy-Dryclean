-- Oct 2026 client directive — the tiers are sized by PEOPLE (1 / 3 / 5) and
-- the bedding perks are explicit:
--   Essentials  = one person's weekly kit (7 of each garment — bag-regulated,
--                 no new column needed: the bag system is unchanged).
--   Household   = 3 people. Bedding: 4 bed sheets a month (two every two
--                 weeks) + 2 duvet washes a quarter (was 3).
--   Whole Home  = 5 people. Bedding: 6 bed sheets a month (three every two
--                 weeks) + 3 duvet washes a quarter (unchanged).
-- Prices, bag/box allowances, shoe pairs, curtains and the yearly deep clean
-- are all untouched — this migration only adds the sheet allowance, wires its
-- usage counter, and sets the Household duvet count + refreshed taglines.

ALTER TABLE "SubscriptionPlan" ADD COLUMN "bedsheetsPerMonth" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "bedsheetsUsed" INTEGER NOT NULL DEFAULT 0;

-- Household: bedding perks per the directive (duvets 3 → 2, sheets = 4/mo).
UPDATE "SubscriptionPlan"
   SET "bedsheetsPerMonth" = 4,
       "duvetsPerQuarter" = 2,
       "tagline" = 'Three people, kitted for the week — three times the Essentials kit in one box, plus the beds.'
 WHERE "code" = 'HOUSEHOLD';

-- Whole Home: 5 people, bedding scaled to a three-bed house (6/mo, duvets stay 3/q).
UPDATE "SubscriptionPlan"
   SET "bedsheetsPerMonth" = 6,
       "tagline" = 'Five people, kitted for the week — five times the kit, plus the beds, the curtains and a yearly deep clean.'
 WHERE "code" = 'WHOLEHOME';

-- Essentials: the same bag, retold as the one-person weekly kit.
UPDATE "SubscriptionPlan"
   SET "tagline" = 'One person, kitted for a full week — seven shirts, vests, underwear, trousers and pairs of socks in every bag.'
 WHERE "code" = 'ESSENTIALS';
