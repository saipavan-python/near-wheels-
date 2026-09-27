import Razorpay from "razorpay";

let client: Razorpay | null = null;

export function hasRazorpayCreds(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

// Lazily construct the client only when creds exist and an SDK call is actually
// made. Constructing at module load (with empty keys) throws, which breaks
// `next build` when Razorpay env vars are absent.
export function getRazorpay(): Razorpay {
  if (!hasRazorpayCreds()) {
    throw new Error("Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID as string,
      key_secret: process.env.RAZORPAY_KEY_SECRET as string,
    });
  }
  return client;
}