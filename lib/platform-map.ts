// salesPlatform numeric code -> display name
// Derived from actual API data observation
export const PLATFORM_MAP: Record<string, string> = {
  '1':  'AliExpress',
  '2':  'Amazon',
  '3':  'Amazon VC',
  '4':  'eBay',
  '5':  'Lazada',
  '6':  'Shopee',
  '7':  'Shopify',
  '8':  'Walmart',
  '9':  'Wayfair',
  '10': 'MercadoLibre',
  '11': 'Wish',
  '12': 'Other',
  '13': 'MercadoLibre',  // variant
  '14': 'Woocommerce',
  '15': 'HomeDepot',
  '16': 'Overstock',
  '17': 'Joom',
  '18': 'Tophatter',
  '19': 'UeeShop',
  '20': 'Shoplazza',
  '21': 'Jumia',
  '22': 'TikTok',
  '23': 'Xshoppy',
  '24': 'Shopline',
  '25': 'Allegro',
  '26': 'Daraz',
  '27': 'Etsy',
  '28': 'Allvalue',
  '29': 'Fnac',
  '30': 'Rakuten',
  '31': 'Shoplus',
  '32': 'Sears',
  '33': 'Shein',
  '34': 'Temu',
  '35': 'Yahoo',
}

export function getPlatformName(code: string | number | undefined): string {
  if (!code) return '-'
  const str = String(code)
  return PLATFORM_MAP[str] ?? `Platform(${str})`
}
