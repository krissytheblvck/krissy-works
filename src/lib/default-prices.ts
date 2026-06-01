import type { ResolvedPrices } from '@/types'

export const DEFAULT_RESOLVED_PRICES: ResolvedPrices = {
  // Default sheet per thickness (smallest / most common size)
  sheets: {
    1.5: { price: 32000, width_mm: 2000, height_mm: 1000, name: '1.5mm Sheet 2000×1000' },
    2:   { price: 45000, width_mm: 2000, height_mm: 1000, name: '2mm Sheet 2000×1000' },
    3:   { price: 65000, width_mm: 2000, height_mm: 1000, name: '3mm Sheet 2000×1000' },
    4:   { price: 88000, width_mm: 2000, height_mm: 1000, name: '4mm Sheet 2000×1000' },
  },

  // All available sheet sizes — shown in the sheet size picker
  allSheets: [
    { thickness_mm: 1.5, width_mm: 2000, height_mm: 1000, price: 32000,  name: '1.5mm — 2000×1000mm' },
    { thickness_mm: 1.5, width_mm: 2440, height_mm: 1220, price: 48000,  name: '1.5mm — 2440×1220mm' },
    { thickness_mm: 1.5, width_mm: 3000, height_mm: 1500, price: 72000,  name: '1.5mm — 3000×1500mm' },
    { thickness_mm: 2,   width_mm: 2000, height_mm: 1000, price: 45000,  name: '2mm — 2000×1000mm' },
    { thickness_mm: 2,   width_mm: 2440, height_mm: 1220, price: 67000,  name: '2mm — 2440×1220mm' },
    { thickness_mm: 2,   width_mm: 3000, height_mm: 1500, price: 101000, name: '2mm — 3000×1500mm' },
    { thickness_mm: 3,   width_mm: 2000, height_mm: 1000, price: 65000,  name: '3mm — 2000×1000mm' },
    { thickness_mm: 3,   width_mm: 2440, height_mm: 1220, price: 97000,  name: '3mm — 2440×1220mm' },
    { thickness_mm: 3,   width_mm: 3000, height_mm: 1500, price: 146000, name: '3mm — 3000×1500mm' },
    { thickness_mm: 4,   width_mm: 2000, height_mm: 1000, price: 88000,  name: '4mm — 2000×1000mm' },
    { thickness_mm: 4,   width_mm: 2440, height_mm: 1220, price: 131000, name: '4mm — 2440×1220mm' },
    { thickness_mm: 4,   width_mm: 3000, height_mm: 1500, price: 198000, name: '4mm — 3000×1500mm' },
  ],

  profiles: {
    '20x20': { price: 10000, bar_length_mm: 6000, name: '20×20 SHS' },
    '40x20': { price: 14000, bar_length_mm: 6000, name: '40×20 RHS' },
    '40x40': { price: 18000, bar_length_mm: 6000, name: '40×40 SHS' },
    '60x40': { price: 22000, bar_length_mm: 6000, name: '60×40 RHS' },
  },
  cutting: {
    1.5: { price: 60000, name: 'Laser Cut 1.5mm' },
    2:   { price: 60000, name: 'Laser Cut 2mm' },
    3:   { price: 75000, name: 'Laser Cut 3mm' },
    4:   { price: 90000, name: 'Laser Cut 4mm' },
  },
  glass: {
    8:  { price: 65000, name: '8mm Glass' },
    10: { price: 85000, name: '10mm Glass' },
    12: { price: 110000, name: '12mm Glass' },
  },
  fabrication_per_day: 15000,
  installation_per_day: 15000,
  glass_hardware: {
    spigot_price:   25000,   // per floor-mount stainless steel spigot
    top_rail_per_m:  8000,   // aluminium top rail / handrail per metre
    channel_per_m:  12000,   // aluminium U-channel (bottom shoe) per metre
  },
}
