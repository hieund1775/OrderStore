export function beginProductAvailabilityRequest(inFlight: Set<number>, productId: number): boolean {
  if (!Number.isInteger(productId) || productId <= 0 || inFlight.has(productId)) return false;
  inFlight.add(productId);
  return true;
}

export function finishProductAvailabilityRequest(inFlight: Set<number>, productId: number) {
  inFlight.delete(productId);
}
