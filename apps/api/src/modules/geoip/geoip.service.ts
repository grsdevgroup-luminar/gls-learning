import {
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reader, AddressNotFoundError } from "@maxmind/geoip2-node";
import type { Env } from "../../config/env";
import { isPrivateOrLocalIp } from "../../common/utils/client-ip";
import {
  CHECKOUT_GEO_MESSAGES,
  evaluateCheckoutGeo,
  type GeoIpCheckoutVerdict,
} from "./geoip-checkout";

type MmdbReader = Awaited<ReturnType<typeof Reader.open>>;

@Injectable()
export class GeoIpService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpService.name);
  private countryReader: MmdbReader | null = null;
  private anonymousReader: MmdbReader | null = null;
  private active = false;

  constructor(private readonly config: ConfigService<Env, true>) {}

  get checkoutEnabled(): boolean {
    return this.config.get("GEOIP_CHECKOUT_ENABLED", { infer: true });
  }

  async onModuleInit(): Promise<void> {
    if (!this.checkoutEnabled) {
      this.logger.log("Checkout geo verification disabled (GEOIP_CHECKOUT_ENABLED=false)");
      return;
    }

    const countryPath = this.config.get("MAXMIND_COUNTRY_DB_PATH", { infer: true });
    if (!countryPath) {
      this.logger.warn(
        "GEOIP_CHECKOUT_ENABLED is true but MAXMIND_COUNTRY_DB_PATH is unset — geo checks disabled",
      );
      return;
    }

    try {
      this.countryReader = await Reader.open(countryPath);
    } catch (err) {
      this.logger.error(
        `Failed to open MaxMind country database at ${countryPath}`,
        err instanceof Error ? err.stack : String(err),
      );
      return;
    }

    const anonymousPath = this.config.get("MAXMIND_ANONYMOUS_IP_DB_PATH", {
      infer: true,
    });
    if (anonymousPath) {
      try {
        this.anonymousReader = await Reader.open(anonymousPath);
      } catch (err) {
        this.logger.warn(
          `Failed to open MaxMind Anonymous IP database at ${anonymousPath} — VPN detection disabled`,
          err instanceof Error ? err.message : String(err),
        );
      }
    } else {
      this.logger.warn(
        "MAXMIND_ANONYMOUS_IP_DB_PATH not set — VPN/proxy detection disabled at checkout",
      );
    }

    this.active = true;
    this.logger.log("Checkout geo verification enabled");
  }

  verifyCheckout(
    ip: string | null,
    profileCountry: string | null,
  ): GeoIpCheckoutVerdict {
    const nodeEnv = this.config.get("NODE_ENV", { infer: true });
    if (!this.checkoutEnabled || !this.active || !this.countryReader) {
      return evaluateCheckoutGeo({
        enabled: false,
        nodeEnv,
        ip,
        profileCountry,
        geoCountry: null,
        anonymous: null,
      });
    }

    const normalizedIp = ip?.trim() ?? null;
    if (!normalizedIp || isPrivateOrLocalIp(normalizedIp)) {
      return evaluateCheckoutGeo({
        enabled: true,
        nodeEnv,
        ip: normalizedIp,
        profileCountry,
        geoCountry: null,
        anonymous: null,
      });
    }

    let anonymous = null;
    if (this.anonymousReader) {
      try {
        const record = this.anonymousReader.anonymousIP(normalizedIp);
        anonymous = {
          isAnonymousVpn: record.isAnonymousVpn,
          isPublicProxy: record.isPublicProxy,
          isTorExitNode: record.isTorExitNode,
          isResidentialProxy: record.isResidentialProxy,
        };
      } catch (err) {
        if (!(err instanceof AddressNotFoundError)) {
          this.logger.warn(
            `Anonymous IP lookup failed for ${normalizedIp}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    let geoCountry: string | null = null;
    try {
      const record = this.countryReader.country(normalizedIp);
      geoCountry = record.country?.isoCode ?? null;
    } catch (err) {
      if (!(err instanceof AddressNotFoundError)) {
        this.logger.warn(
          `Country lookup failed for ${normalizedIp}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return evaluateCheckoutGeo({
      enabled: true,
      nodeEnv,
      ip: normalizedIp,
      profileCountry,
      geoCountry,
      anonymous,
    });
  }

  messageFor(verdict: GeoIpCheckoutVerdict): string | null {
    if (verdict.allowed) return null;
    return CHECKOUT_GEO_MESSAGES[verdict.reason];
  }
}
