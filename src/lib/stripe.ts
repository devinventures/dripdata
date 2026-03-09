import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[stripe] Missing STRIPE_SECRET_KEY env var");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/** The $5/month price ID from your Stripe dashboard */
export const PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";

/** URL helpers */
export function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
