/** Isolated illustrative planner. Never used for billing, dispatch or a mobility guarantee. */
export const previewSlots = [
  { hour: "18", price: 1.6 }, { hour: "19", price: 1.4 }, { hour: "20", price: 1.15 },
  { hour: "21", price: 0.95 }, { hour: "22", price: 0.8 }, { hour: "23", price: 0.7 },
  { hour: "00", price: 0.65 }, { hour: "01", price: 0.5 }, { hour: "02", price: 0.4 },
  { hour: "03", price: 0.45 }, { hour: "04", price: 0.6 }, { hour: "05", price: 0.85 }, { hour: "06", price: 1.2 },
];
export function previewPlan(current: number, target: number, capacity: number, departure: number) {
  if (![current,target,capacity,departure].every(Number.isFinite) || current<0 || current>100 || target<0 || target>100 || capacity<=0 || !Number.isInteger(departure) || departure<1 || departure>7) throw new Error("INVALID_PREVIEW_INPUT");
  const requested = Math.max(0, (target-current)/100*capacity);
  const available = previewSlots.slice(0, 6+departure);
  const batteryPower = 11*0.9;
  let remaining = requested;
  const allocations = new Map<string,number>();
  for(const slot of [...available].sort((a,b)=>a.price-b.price)) {const amount=Math.min(remaining,batteryPower);if(amount>0)allocations.set(slot.hour,amount/batteryPower);remaining=Math.max(0,remaining-amount);}
  const cost = available.reduce((sum,slot)=>sum+(allocations.get(slot.hour)||0)*11*slot.price,0);
  return { requested, gridEnergy: (requested-remaining)/0.9, unmet: remaining, cost, hours: (requested-remaining)/batteryPower, allocations: Object.fromEntries(allocations) };
}
