import { resolve } from "node:path";
import { config } from "dotenv";
import { preprocess } from "zod";

export const NODE_ENV: string = process.env.NODE_ENV ?? "development";

config({ path: resolve(`./src/config/.env.${NODE_ENV}`) });

export const PORT: number = Number.parseInt(process.env.PORT ?? "7000", 10);
export const DB_URI: string = process.env.DB_URI ?? "";

// The project previously used UPSTASH_REDIS_REST_URL for a rediss:// URI.
// REDIS_URI is the preferred name; the old variable remains as a fallback.
export const REDIS_URI: string =
    process.env.REDIS_URI || process.env.UPSTASH_REDIS_REST_URL || "";

export const KEY_ACCESS: string =
    process.env.KEY_ACCESS || process.env.ACCESS_TOKEN_SIGNATURE || "";
export const KEY_REFRESH: string =
    process.env.KEY_REFRESH || process.env.REFRESH_TOKEN_SIGNATURE || "";

export const WEB_CLIENT_ID: string = process.env.WEB_CLIENT_ID ?? "";
export const SMTP_EMAIL: string = process.env.APP_EMAIL || process.env.SMTP_EMAIL || "";
export const EMAIL_PASS: string = process.env.APP_PASSWORD || process.env.EMAIL_PASS || "";
export const PROJECT_NAME: string = process.env.PROJECT_NAME || "Social App";
export const AWS_REGION=process.env.AWS_REGION;
export const AWS_ACCESS_KEY=process.env.AWS_ACCESS_KEY;
export const AWS_SECRET_ACCESS_KEY=process.env.AWS_SECRET_ACCESS_KEY;
export const ALLOWED_ORIGINS: string[] = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : ["*"];

export const validateRuntimeConfig = (): void => {
    const required: Record<string, string> = {
        DB_URI,
        REDIS_URI,
        KEY_ACCESS,
        KEY_REFRESH,
        SMTP_EMAIL,
        EMAIL_PASS
    };

    const missing = Object.entries(required)
        .filter(([, value]) => !value.trim())
        .map(([key]) => key);

    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    if (KEY_ACCESS.length < 32 || KEY_REFRESH.length < 32) {
        throw new Error("KEY_ACCESS and KEY_REFRESH must each be at least 32 characters long.");
    }

    if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
        throw new Error("PORT must be a valid TCP port number.");
    }
};

