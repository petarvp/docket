const GOLDEN_ANGLE = 137.508;

// Hue по позицията на категорията в стабилно подредения списък (по created_at/id),
// не по хеш на id-то — така съседни категории винаги получават далечни по цвят
// hue-та (golden angle spacing), вместо да могат случайно да съвпаднат.
export function categoryHue(categories, categoryId) {
  const sorted = [...categories].sort(
    (a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id)
  );
  const index = sorted.findIndex((c) => c.id === categoryId);
  return Math.round(((index >= 0 ? index : 0) * GOLDEN_ANGLE) % 360);
}
