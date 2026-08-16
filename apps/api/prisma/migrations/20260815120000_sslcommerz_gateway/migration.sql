-- Add SSLCommerz to the PaymentGateway enum and its kill-switch on PlatformSettings.
ALTER TYPE "PaymentGateway" ADD VALUE 'SSLCOMMERZ';

ALTER TABLE "PlatformSettings"
    ADD COLUMN "sslcommerzEnabled" BOOLEAN NOT NULL DEFAULT true;
