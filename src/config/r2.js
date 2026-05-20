import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

let r2Client = null;

export const getR2Client = () => {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
  }

  return r2Client;
};

export const getR2BucketName = () => {
  return env.R2_BUCKET_NAME;
};

export const ensureR2Configured = () => {
  const missing = [];

  if (!env.R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!env.R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!env.R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!env.R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");
  if (!env.R2_ENDPOINT) missing.push("R2_ENDPOINT");

  if (missing.length > 0) {
    throw new Error(`Cloudflare R2 is not configured. Missing: ${missing.join(", ")}`);
  }
};