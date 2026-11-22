export const customerProductKeys = [
  "charging_subscription", "electricity_contract", "energy_optimization", "grid_rewards", "external_api",
] as const;

export type CustomerProductKey = typeof customerProductKeys[number];

export type CustomerProductAccess = {
  items: Array<{
    product_key: CustomerProductKey;
    status: "active" | "revoked";
    version: number;
    expires_at: string | null;
    enabled: boolean;
  }>;
  requests: Array<{
    product_key: CustomerProductKey;
    requested_at: string;
  }>;
};
