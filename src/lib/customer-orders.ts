export const customerOrderStates = ["pending", "paid", "blocked", "refunded"] as const;

export type CustomerOrder = {
  id: string;
  state: typeof customerOrderStates[number];
  createdAt: string;
  amountMinor: number | null;
  currency: "SEK" | null;
};

export type CustomerOrders = { items: CustomerOrder[] };
