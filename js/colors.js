const GOLDEN_ANGLE = 137.508;

// Предефинирани hue стойности за ръчен избор — равномерно разположени,
// за да не се сливат със съседни автоматични цветове.
export const PRESET_HUES = [210, 0, 150, 300, 45, 190, 330, 90, 260, 25, 170, 280];

// Hue по позицията на категорията в стабилно подредения списък (по created_at/id),
// не по хеш на id-то — така съседни категории винаги получават далечни по цвят
// hue-та (golden angle spacing), вместо да могат случайно да съвпаднат.
// Ако категорията има ръчно зададен `hue` (от потребителя), той печели.
export function categoryHue(categories, categoryId) {
  const manual = categories.find((c) => c.id === categoryId)?.hue;
  if (manual !== undefined && manual !== null && manual !== '') return Number(manual);

  const sorted = [...categories].sort(
    (a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id)
  );
  const index = sorted.findIndex((c) => c.id === categoryId);
  return Math.round(((index >= 0 ? index : 0) * GOLDEN_ANGLE) % 360);
}
