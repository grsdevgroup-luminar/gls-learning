import { describe, it, expect, vi, afterEach } from "vitest";
import { ConfigService } from "@nestjs/config";
import { E164, SmsService } from "../sms.service";

const config = (env: Record<string, string | undefined>) =>
  ({ get: (key: string) => env[key] }) as unknown as ConfigService<never, true>;

const configured = {
  TWILIO_ACCOUNT_SID: "AC123",
  TWILIO_AUTH_TOKEN: "secret",
  TWILIO_FROM_NUMBER: "+15005550006",
};

afterEach(() => vi.unstubAllGlobals());

describe("E164", () => {
  it.each(["+8801712345678", "+15005550006", "+441632960961"])("accepts %s", (n) => {
    expect(E164.test(n)).toBe(true);
  });

  it.each(["01712345678", "+0123456789", "+1234567", "not a number", "+1 555 0100"])(
    "rejects %s",
    (n) => {
      expect(E164.test(n)).toBe(false);
    },
  );
});

describe("SmsService", () => {
  it("reports nothing sent when there is no usable number", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sms = new SmsService(config(configured));

    expect(await sms.send(null, "hi")).toBe(false);
    expect(await sms.send("01712345678", "hi")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs instead of calling Twilio when unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sms = new SmsService(config({}));

    expect(await sms.send("+8801712345678", "hi")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to Twilio with basic auth and truncates to one segment", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const sms = new SmsService(config(configured));

    expect(await sms.send("+8801712345678", "x".repeat(400))).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(init.headers.authorization).toBe(
      `Basic ${Buffer.from("AC123:secret").toString("base64")}`,
    );
    const body = init.body as URLSearchParams;
    expect(body.get("To")).toBe("+8801712345678");
    expect(body.get("From")).toBe("+15005550006");
    expect(body.get("Body")).toHaveLength(160);
    expect(body.get("Body")!.endsWith("...")).toBe(true);
  });

  it("throws on a provider failure so the job retries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad creds" }),
    );
    const sms = new SmsService(config(configured));

    await expect(sms.send("+8801712345678", "hi")).rejects.toThrow("SMS delivery failed");
  });
});
