const { PrismaClient } = require('@prisma/client');
const taco = require('./taco.json');

const normalize = (t) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

async function main() {
  const prisma = new PrismaClient();
  const count = await prisma.food.count({ where: { source: 'TACO' } });
  if (count === 0) {
    await prisma.food.createMany({
      data: taco.map((f) => ({
        name: f.name,
        searchName: normalize(f.name),
        category: f.category,
        source: 'TACO',
        kcal: f.kcal,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber: f.fiber,
        micros: f.micros,
      })),
    });
    console.log(`Seeded ${taco.length} TACO foods`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
