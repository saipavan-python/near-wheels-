/**
 * Pure payment-state helpers (no DB / gateway imports → unit-testable).
 */

/** A payment+booking pair is already settled and must never be re-credited. */
export function paymentSettled(paymentStatus: string, bookingPaymentStatus: string): boolean {
  return (
    paymentStatus === "SUCCESS" ||
    paymentStatus === "REFUNDED" ||
    bookingPaymentStatus === "PAID" ||
    bookingPaymentStatus === "REFUNDED"
  );
}

/** Expected Razorpay order amount in paise for an INR booking total. */
export function expectedAmountPaise(totalAmount: number): number {
  return Math.round(totalAmount * 100);
}

/** Commission = rate × total, rounded to paise, so payout arithmetic stays exact. */
export function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}