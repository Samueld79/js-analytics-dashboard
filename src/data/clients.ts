export type ClientRecord = {
  name: string;
  investment: number;
  sales: number | null;
};

export const clients: ClientRecord[] = [
  { name: "Tienda de la Platería", investment: 931713, sales: 30158300 },
  { name: "Empaques y Suministros", investment: 871653, sales: 3596900 },
  { name: "Ángeles Creando", investment: 1306220, sales: 21007000 },
  { name: "Platería Rossy 2", investment: 570277, sales: 500000 },
  { name: "Libell Joyería", investment: 3716870, sales: 47453394 },
  { name: "Ivalent", investment: 1062755, sales: 23235000 },
  { name: "Dulce María Collection", investment: 600000, sales: null },
];
