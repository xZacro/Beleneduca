import {
  buildCatalogAreaDtosFromSchema,
  buildCatalogIndicatorDtosFromSchema,
  DEFAULT_CYCLES,
  DEMO_SCHOOLS,
  loadAreasSchema,
} from "./fni-domain.mjs";

export async function seedCycles(prisma) {
  for (const cycle of DEFAULT_CYCLES) {
    const existing = await prisma.cycle.findUnique({
      where: { id: cycle.id },
      select: { id: true },
    });

    if (!existing) {
      await prisma.cycle.create({
        data: cycle,
      });
    }
  }
}

export async function seedSchools(prisma) {
  for (const school of DEMO_SCHOOLS) {
    const existing = await prisma.school.findUnique({
      where: { id: school.id },
      select: { id: true },
    });

    if (!existing) {
      await prisma.school.create({
        data: {
          id: school.id,
          code: school.code,
          name: school.name,
          managerName: school.managerName ?? null,
          managerEmail: school.managerEmail ?? null,
          status: "ACTIVE",
        },
      });
      continue;
    }

    await prisma.school.update({
      where: { id: school.id },
      data: {
        code: school.code,
        name: school.name,
        managerName: school.managerName ?? null,
        managerEmail: school.managerEmail ?? null,
        status: "ACTIVE",
      },
    });
  }
}

export async function seedCatalog(prisma) {
  const areasSchema = await loadAreasSchema();
  const areaDtos = buildCatalogAreaDtosFromSchema(areasSchema);
  const indicatorDtos = buildCatalogIndicatorDtosFromSchema(areasSchema);
  const indicatorDtoById = new Map(indicatorDtos.map((indicator) => [indicator.id, indicator]));

  for (const [areaIndex, area] of areasSchema.entries()) {
    const areaDto = areaDtos[areaIndex];

    const existingArea = await prisma.area.findUnique({
      where: { id: area.id },
      select: { id: true },
    });

    if (!existingArea) {
      await prisma.area.create({
        data: {
          id: area.id,
          code: areaDto.code,
          name: area.name,
          sortOrder: areaDto.order,
          status: "ACTIVE",
        },
      });
    }

    for (const [indicatorIndex, indicator] of area.indicators.entries()) {
      const indicatorDto = indicatorDtoById.get(indicator.id);

      const existingIndicator = await prisma.indicator.findUnique({
        where: { id: indicator.id },
        select: { id: true },
      });

      if (!existingIndicator) {
        await prisma.indicator.create({
          data: {
            id: indicator.id,
            areaId: area.id,
            code: indicatorDto?.code ?? indicator.id,
            name: indicator.name,
            sortOrder: indicatorDto?.order ?? indicatorIndex + 1,
            expectedPct: indicator.expectedPct ?? 100,
            hasDocumentFields: Boolean(indicator.hasDocumentFields),
            questions: indicator.questions,
            visibleWhen: indicator.visibleWhen ?? null,
            status: "ACTIVE",
          },
        });
      }
    }
  }

  return {
    areas: areasSchema.length,
    indicators: indicatorDtos.length,
  };
}

export async function seedReferenceData(prisma) {
  await seedCycles(prisma);
  await seedSchools(prisma);
  return seedCatalog(prisma);
}
