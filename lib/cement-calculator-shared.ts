export type CementBrandId = "argos" | "ultracem";

export type CementCalculatorProductDefinition = {
  defaultSalePriceRef: number | null;
  defaultUnitWeightKg: number | null;
  id: string;
  label: string;
};

export type CementCalculatorBrandDefinition = {
  defaultMulaBagsQty: number;
  defaultTotalCoteros: number;
  defaultTotalMula: number;
  id: CementBrandId;
  ivaRate: number;
  label: string;
  products: CementCalculatorProductDefinition[];
};

export type CementCalculatorProductConfig = {
  id: string;
  label: string;
  salePriceRef: number | null;
  unitWeightKg: number | null;
};

export type CementCalculatorBrandConfig = {
  id: CementBrandId;
  ivaRate: number;
  label: string;
  mulaBagsQty: number;
  products: CementCalculatorProductConfig[];
  totalCoteros: number;
  totalMula: number;
};

export type CementCalculatorConfig = {
  brands: CementCalculatorBrandConfig[];
};

export const CEMENT_REFERENCE_BAG_WEIGHT_KG = 42.5;
export const CEMENT_REFERENCE_BAGS_PER_MULA = 823;

export const CEMENT_CALCULATOR_DEFINITIONS: CementCalculatorBrandDefinition[] = [
  {
    defaultMulaBagsQty: CEMENT_REFERENCE_BAGS_PER_MULA,
    defaultTotalCoteros: 117500,
    defaultTotalMula: 0,
    id: "argos",
    ivaRate: 0.19,
    label: "Argos (Aros)",
    products: [
      {
        defaultSalePriceRef: 31500,
        defaultUnitWeightKg: 42.5,
        id: "uso_general",
        label: "Uso general"
      },
      {
        defaultSalePriceRef: null,
        defaultUnitWeightKg: 42.5,
        id: "estructural",
        label: "Estructural"
      },
      {
        defaultSalePriceRef: null,
        defaultUnitWeightKg: 42.5,
        id: "cemento_blanco",
        label: "Cemento blanco"
      },
      {
        defaultSalePriceRef: null,
        defaultUnitWeightKg: 42.5,
        id: "cal",
        label: "Cal"
      }
    ]
  },
  {
    defaultMulaBagsQty: CEMENT_REFERENCE_BAGS_PER_MULA,
    defaultTotalCoteros: 411500,
    defaultTotalMula: 2800000,
    id: "ultracem",
    ivaRate: 0.19,
    label: "Ultracem",
    products: [
      {
        defaultSalePriceRef: 30000,
        defaultUnitWeightKg: 42.5,
        id: "uso_general",
        label: "Uso general"
      },
      {
        defaultSalePriceRef: 29000,
        defaultUnitWeightKg: 42.5,
        id: "ecocem",
        label: "Ecocem"
      },
      {
        defaultSalePriceRef: null,
        defaultUnitWeightKg: 42.5,
        id: "estructural",
        label: "Estructural"
      },
      {
        defaultSalePriceRef: null,
        defaultUnitWeightKg: 25,
        id: "pegante_ceramica",
        label: "Pegante ceramica"
      },
      {
        defaultSalePriceRef: null,
        defaultUnitWeightKg: 25,
        id: "pegante_porcelanato",
        label: "Pegante porcelanato"
      }
    ]
  }
];

const definitionById = new Map<CementBrandId, CementCalculatorBrandDefinition>(
  CEMENT_CALCULATOR_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function getCementBrandDefinition(brandId: string) {
  return definitionById.get(brandId as CementBrandId) ?? null;
}
