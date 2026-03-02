export type MonthKey = "2026-02" | "2026-03" | string;

export type MonthlyMetrics = {
  investment: number;
  sales: number | null;
  messages: number | null;
  reach: number | null;
  impressions: number | null;
};

export type ClientMonthlyData = {
  clientName: string;
  months: Record<MonthKey, MonthlyMetrics>;
};

export const clientsMonthlyData: ClientMonthlyData[] = [
  {
    clientName: "Tienda de la Platería",
    months: {
      "2026-02": {
        investment: 931713,
        sales: 30158300,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
  {
    clientName: "Empaques y Suministros",
    months: {
      "2026-02": {
        investment: 871653,
        sales: 3596900,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
  {
    clientName: "Ángeles Creando",
    months: {
      "2026-02": {
        investment: 1306220,
        sales: 21007000,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
  {
    clientName: "Platería Rossy 2",
    months: {
      "2026-02": {
        investment: 570277,
        sales: 500000,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
  {
    clientName: "Libell Joyería",
    months: {
      "2026-02": {
        investment: 3716870,
        sales: 56590594,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
  {
    clientName: "Ivalent",
    months: {
      "2026-02": {
        investment: 1062755,
        sales: 23235000,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
  {
    clientName: "Dulce María Collection",
    months: {
      "2026-02": {
        investment: 600000,
        sales: null,
        messages: null,
        reach: null,
        impressions: null,
      },
    },
  },
];
