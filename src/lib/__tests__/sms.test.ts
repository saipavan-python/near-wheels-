import { describe, it, expect, afterEach, vi } from "vitest";
import { sendOtpSms } from "../sms";

const KEYS = [
  "MSG91_AUTH_KEY",
  "MSG91_TEMPLATE_ID",
  "MSG91_SENDER_ID",
  "FAST2SMS_API_KEY",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "OTP_CONSOLE_LOG",
];

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
  vi.unstubAllGlobals();
});

describe("sendOtpSms", () => {
  it("falls back to the console provider when no SMS keys are configured", async () => {
    const res = await sendOtpSms("9999999999", "123456");
    expect(res.provider).toBe("console");
  });

  it("uses MSG91 when MSG91_AUTH_KEY is set", async () => {
    process.env.MSG91_AUTH_KEY = "authkey123";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ type: "success" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendOtpSms("9999999999", "123456");
    expect(res.provider).toBe("msg91");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("control.msg91.com/api/v5/otp");
    expect(url).toContain("mobile=919999999999");
    expect(url).toContain("otp=123456");
  });

  it("uses Fast2SMS when FAST2SMS_API_KEY is set", async () => {
    process.env.FAST2SMS_API_KEY = "key123";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ return: true }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendOtpSms("9999999999", "123456");
    expect(res.provider).toBe("fast2sms");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("fast2sms.com/dev/bulkV2");
    expect(url).toContain("numbers=919999999999");
  });

  it("uses Twilio when Twilio creds are set", async () => {
    process.env.TWILIO_ACCOUNT_SID = "ACxxx";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_FROM_NUMBER = "+12025550123";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ sid: "sm123", status: "queued" }), { status: 201, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await sendOtpSms("9999999999", "123456");
    expect(res.provider).toBe("twilio");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json");
    expect(String(init!.body)).toContain("To=%2B919999999999");
  });

  it("throws when a provider replies with an error", async () => {
    process.env.MSG91_AUTH_KEY = "authkey123";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ type: "failure", errors: ["invalid authkey"] }), { status: 403, headers: { "Content-Type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendOtpSms("9999999999", "123456")).rejects.toThrow("MSG91 OTP send failed");
  });
});