// =============================================================================
// Catalog display groups — shared by the landing pricing section and the
// booking wizard's "Select service" step.
// =============================================================================
// One source of truth so the wizard is ALWAYS separated the same way the
// landing page is (owner directive): Men / Women tabs with a shared
// "For the home & everything else" strip underneath both.
//
// Grouping rules:
//   • Gendered items sit under their own tab — Agbada & Kaftan under Men;
//     the women's-wear catalog plus Iro & Buba and the Ankara Gown under
//     Women (fashion-retail "Men"/"Women", not "male/female").
//   • Household and Extras apply to everyone, so they render as a shared
//     strip under BOTH retail tabs — exactly like the landing page.
//   • Men's and women's underwear stay in the shared Extras strip — the
//     client wants them listed, and the landing page already shows them
//     under both tabs.
//   • Shoes: the landing page lists them in the shared strip, but the
//     booking wizard gives them their own dedicated tab, so the wizard's
//     shared strip excludes them.

import { GARMENT_CATALOG, type GarmentCatalogItem } from '@/lib/types'

export interface CatalogDisplayGroup {
  title: string
  /** Either a catalog category or an explicit item-id list (not both) */
  category?: string
  itemIds?: string[]
}

export const MEN_CATALOG_GROUPS: CatalogDisplayGroup[] = [
  { title: 'Shirts & Tops', category: 'Shirts' },
  { title: 'Trousers & Jeans', category: 'Trousers' },
  { title: 'Suits & Blazers', category: 'Suits' },
  { title: "Men's Traditional", itemIds: ['agbada', 'kaftan'] },
]

export const WOMEN_CATALOG_GROUPS: CatalogDisplayGroup[] = [
  { title: 'Everyday Wear', itemIds: ['blouse', 'skirt', 'womens-dress', 'jumpsuit'] },
  {
    title: 'Occasion & Traditional',
    itemIds: ['lace-gown', 'gele', 'iro-buba', 'ankara-gown'],
  },
]

export const HOUSEHOLD_GROUP: CatalogDisplayGroup = { title: 'Household', category: 'Household' }
export const EXTRAS_GROUP: CatalogDisplayGroup = { title: 'Extras', category: 'Extras' }
export const SHOES_GROUP: CatalogDisplayGroup = { title: 'Shoes & Sneakers', category: 'Shoes' }
// Other — wedding dress, couture & bespoke. Never flat-priced: booked, then
// assessed and quoted for approval (owner directive — there was no category
// for wedding dresses, so "Other" lets customers know a quote is available).
export const OTHER_COUTURE_GROUP: CatalogDisplayGroup = {
  title: 'Other & Bespoke — quoted',
  category: 'Other',
}

/** Landing pricing section — shared strip under both retail tabs (incl. shoes). */
export const LANDING_SHARED_GROUPS: CatalogDisplayGroup[] = [
  HOUSEHOLD_GROUP,
  SHOES_GROUP,
  EXTRAS_GROUP,
]

/** Booking wizard — shared strip under the Men and Women tabs. Shoes are
 *  excluded here because they have their own dedicated tab in the wizard.
 *  The Other & Bespoke quote group IS included — wedding dresses and couture
 *  apply to everyone, exactly like household and extras. */
export const WIZARD_SHARED_GROUPS: CatalogDisplayGroup[] = [
  HOUSEHOLD_GROUP,
  EXTRAS_GROUP,
  OTHER_COUTURE_GROUP,
]

/** Resolve a display group to its catalog items (order preserved). */
export function itemsForGroup(group: CatalogDisplayGroup): GarmentCatalogItem[] {
  const list = group.itemIds
    ? group.itemIds.map((id) => GARMENT_CATALOG.find((g) => g.id === id))
    : GARMENT_CATALOG.filter((g) => g.category === group.category)
  return list.filter((g): g is GarmentCatalogItem => Boolean(g))
}

// =============================================================================
// Wizard catalog tabs
// =============================================================================

/** The three tabs of the wizard's "Select service" step. */
export type CatalogTab = 'men' | 'women' | 'shoes'

/** Which wizard tab a catalog category belongs to. */
export function catalogTabForCategory(category: string | undefined): CatalogTab {
  if (category === 'Shoes') return 'shoes'
  if (category === "Women's Wear") return 'women'
  return 'men'
}
