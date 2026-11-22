export const accountRoleLabels = { owner: "Ägare", billing: "Ekonomi", driver: "Förare" } as const;

const customerUuid = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

export function isCustomerResourceId(value: unknown): value is string {
  return typeof value === "string" && customerUuid.test(value);
}

export type CustomerAccount = {
  id: string;
  name: string;
  kind: "personal" | "business";
  role: keyof typeof accountRoleLabels;
};
