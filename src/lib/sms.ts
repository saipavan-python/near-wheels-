// Pluggable SMS delivery for OTP + alerts.
// Provider priority: MSG91 → Fast2SMS → Twilio → console (dev) fallback.
// Configure via .env (see .env.example for key names).

export interface SmsResult {
  provider: string;
  sid?: string;
}

function has(env: string): boolean {
  const v = process.env[env];
  return !!v && v.trim().length > 0;
}

function devFallback(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.OTP_CONSOLE_LOG === "true";
}

export async function sendOtpSms(phone: string, code: string): Promise<SmsResult> {
  const message = `Near Wheels verification code: ${code}. Never share this OTP with anyone. It is valid for 5 minutes.`;
  if (has("MSG91_AUTH_KEY")) return sendMsg91(phone, code);
  if (has("FAST2SMS_API_KEY")) return sendFast2Sms(phone, code);
  if (has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN")) return sendTwilio(phone, message);
  if (devFallback()) {
    console.log(`[NearWheels OTP][console fallback] To ${phone}: ${code}`);
    return { provider: "console" };
  }
  throw new Error(
    "SMS service not configured: set MSG91_AUTH_KEY, FAST2SMS_API_KEY, or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN."
  );
}

async function sendMsg91(phone: string, code: string): Promise<SmsResult> {
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("authkey", process.env.MSG91_AUTH_KEY!);
  url.searchParams.set("mobile", "91" + phone);
  url.searchParams.set("otp", code);
  url.searchParams.set("otp_expiry", "5");
  if (has("MSG91_TEMPLATE_ID")) url.searchParams.set("template_id", process.env.MSG91_TEMPLATE_ID!);
  if (has("MSG91_SENDER_ID")) url.searchParams.set("sender", process.env.MSG91_SENDER_ID!);
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data && (data as any).type !== "success")) {
    throw new Error(`MSG91 OTP send failed: ${JSON.stringify(data)}`);
  }
  return { provider: "msg91" };
}

async function sendFast2Sms(phone: string, code: string): Promise<SmsResult> {
  const url = new URL("https://www.fast2sms.com/dev/bulkV2");
  url.searchParams.set("authorization", process.env.FAST2SMS_API_KEY!);
  url.searchParams.set("route", "otp");
  url.searchParams.set("variables_values", code);
  url.searchParams.set("numbers", "91" + phone);
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as any)?.return !== true) {
    throw new Error(`Fast2SMS OTP send failed: ${JSON.stringify(data)}`);
  }
  return { provider: "fast2sms" };
}

async function sendTwilio(phone: string, message: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  if (!from) throw new Error("TWILIO_FROM_NUMBER is required when using Twilio.");
  const body = new URLSearchParams({ To: "+91" + phone, From: from, Body: message });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as any)?.status === "failed" || (data as any)?.error_message) {
    throw new Error(`Twilio send failed: ${JSON.stringify(data)}`);
  }
  return { provider: "twilio", sid: (data as any)?.sid };
}