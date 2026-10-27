import { warehouse } from "./config";

/** warehouse-site (episode 015): the quote math. Pure, so the browser and the server agree. */
export type QuoteInput = {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLb: number;
  ordersPerMonth: number;
  itemsPerOrder: number;
  unitsStored: number;
  unitsInbound: number;
};

export type Quote = {
  input: QuoteInput;
  cubicFeetPerUnit: number;
  oversize: boolean;
  receiving: number;
  storage: number;
  pick: number;
  oversizeFee: number;
  minimumTopUp: number;
  total: number;
  perOrder: number;
};

const n = (v: unknown, max = 1e7) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.min(x, max) : 0;
};
const cents = (x: number) => Math.round(x * 100) / 100;

export function cleanInput(raw: Partial<Record<keyof QuoteInput, unknown>>): QuoteInput {
  return {
    lengthIn: n(raw.lengthIn, 200),
    widthIn: n(raw.widthIn, 200),
    heightIn: n(raw.heightIn, 200),
    weightLb: n(raw.weightLb, 500),
    ordersPerMonth: Math.round(n(raw.ordersPerMonth, 1e6)),
    itemsPerOrder: Math.max(1, n(raw.itemsPerOrder, 100)),
    unitsStored: Math.round(n(raw.unitsStored, 1e7)),
    unitsInbound: Math.round(n(raw.unitsInbound, 1e7)),
  };
}

export function estimate(raw: Partial<Record<keyof QuoteInput, unknown>>, rates = warehouse.rates): Quote {
  const input = cleanInput(raw);
  const cubicFeetPerUnit = (input.lengthIn * input.widthIn * input.heightIn) / 1728;
  const oversize = input.weightLb > rates.oversizeWeightLb || Math.max(input.lengthIn, input.widthIn, input.heightIn) > rates.oversizeLongestIn;
  const receiving = input.unitsInbound * rates.receivingPerUnit;
  const storage = input.unitsStored * cubicFeetPerUnit * rates.storagePerCubicFootMonth;
  const pick = input.ordersPerMonth * (rates.pickFirstItem + rates.pickExtraItem * (input.itemsPerOrder - 1));
  const oversizeFee = oversize ? input.ordersPerMonth * rates.oversizePerOrder : 0;
  const subtotal = receiving + storage + pick + oversizeFee;
  const minimumTopUp = Math.max(0, rates.minimumMonthly - subtotal);
  const total = subtotal + minimumTopUp;
  return {
    input,
    cubicFeetPerUnit: Math.round(cubicFeetPerUnit * 1000) / 1000,
    oversize,
    receiving: cents(receiving),
    storage: cents(storage),
    pick: cents(pick),
    oversizeFee: cents(oversizeFee),
    minimumTopUp: cents(minimumTopUp),
    total: cents(total),
    perOrder: input.ordersPerMonth ? cents(total / input.ordersPerMonth) : 0,
  };
}
