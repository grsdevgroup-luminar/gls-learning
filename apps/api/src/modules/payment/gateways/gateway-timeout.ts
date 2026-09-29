/**
 * Upper bound for a single outbound call to a payment provider. Without it a
 * stalled provider socket holds the checkout request open indefinitely and the
 * buyer's Pay button spins forever. Kept well under the web client's checkout
 * timeout so the API always answers first with a real error.
 */
export const GATEWAY_TIMEOUT_MS = 15_000;

export const gatewaySignal = (): AbortSignal =>
  AbortSignal.timeout(GATEWAY_TIMEOUT_MS);
