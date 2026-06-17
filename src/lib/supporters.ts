// "Server Supporters" — community support / tier system (a boosting analogue,
// deliberately not a paid "Nitro"). Tier rises with the number of supporters.
export function supporterTier(count: number): number {
  if (count >= 14) return 3;
  if (count >= 7) return 2;
  if (count >= 2) return 1;
  return 0;
}
