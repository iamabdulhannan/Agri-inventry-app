import { useOrg } from './app'
import { fetchAll, useLoad } from './data'
import { supabase } from './supabase'
import type { BatchStock, Category, Company, PartyBalance, PartyKind, ProductStock } from './types'
import { baseOf, measureOf } from './units'

const MEASURE_ORDER = { volume: 0, weight: 1, count: 2 }

export function sortProducts<T extends { name: string; pack_size: number; pack_unit: ProductStock['pack_unit'] }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      a.name.localeCompare(b.name) ||
      MEASURE_ORDER[measureOf(a.pack_unit)] - MEASURE_ORDER[measureOf(b.pack_unit)] ||
      baseOf(a.pack_size, a.pack_unit) - baseOf(b.pack_size, b.pack_unit),
  )
}

export interface Catalog {
  products: ProductStock[]
  categories: Category[]
  companies: Company[]
  byId: Map<string, ProductStock>
}

export async function loadCatalog(orgId: string): Promise<Catalog> {
  const [products, categories, companies] = await Promise.all([
    fetchAll<ProductStock>((a, b) => supabase.from('product_stock').select('*').eq('org_id', orgId).order('id').range(a, b)),
    fetchAll<Category>((a, b) => supabase.from('categories').select('*').eq('org_id', orgId).order('name').range(a, b)),
    fetchAll<Company>((a, b) => supabase.from('companies').select('*').eq('org_id', orgId).order('name').range(a, b)),
  ])
  const sorted = sortProducts(
    products.map((p) => ({
      ...p,
      qty: Number(p.qty),
      pack_size: Number(p.pack_size),
      min_stock: Number(p.min_stock),
      purchase_price: Number(p.purchase_price),
      sale_price: Number(p.sale_price),
      stock_value: Number(p.stock_value),
    })),
  )
  return { products: sorted, categories, companies, byId: new Map(sorted.map((p) => [p.id, p])) }
}

/** Products (with live stock), categories and companies of the current organization */
export function useCatalog() {
  const { org, version } = useOrg()
  return useLoad(() => loadCatalog(org.id), [org.id, version])
}

export async function loadBatches(orgId: string, onlyInStock = true): Promise<BatchStock[]> {
  const rows = await fetchAll<BatchStock>((a, b) => {
    let q = supabase.from('batch_stock').select('*').eq('org_id', orgId)
    if (onlyInStock) q = q.gt('qty', 0)
    return q.order('expiry_date').order('created_at').range(a, b)
  })
  return rows.map((b) => ({ ...b, qty: Number(b.qty) }))
}

export async function loadParties(orgId: string, kind?: PartyKind): Promise<PartyBalance[]> {
  const rows = await fetchAll<PartyBalance>((a, b) => {
    let q = supabase.from('party_balances').select('*').eq('org_id', orgId)
    if (kind) q = q.eq('kind', kind)
    return q.order('name').range(a, b)
  })
  return rows.map((p) => ({ ...p, balance: Number(p.balance), opening_balance: Number(p.opening_balance) }))
}
