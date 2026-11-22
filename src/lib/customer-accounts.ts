export const accountRoleLabels = { owner: "Ägare", billing: "Ekonomi", driver: "Förare" } as const;

export type CustomerAccount = {
  id: string;
  name: string;
  kind: "personal" | "business";
  role: keyof typeof accountRoleLabels;
};
