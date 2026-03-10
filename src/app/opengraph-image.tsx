import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DripData — Dividend Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            top: -100,
            left: "50%",
            transform: "translateX(-50%)",
            width: 600,
            height: 400,
            background: "radial-gradient(ellipse, rgba(34,197,94,0.15) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <span style={{ fontSize: 52 }}>💧</span>
          <span style={{ fontSize: 52, fontWeight: 800, color: "#ffffff" }}>
            Drip<span style={{ color: "#22c55e" }}>Data</span>
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#9ca3af",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.4,
            marginBottom: 48,
          }}
        >
          Yield calculators, ETF deep-dives &amp; portfolio tracking for income investors
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: 16 }}>
          {["Dividend Yield Calculator", "ETF Lookup", "DRIP Calculator", "Portfolio Tracker"].map((t) => (
            <div
              key={t}
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#4ade80",
                padding: "8px 18px",
                borderRadius: 999,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: "absolute", bottom: 40, color: "#4b5563", fontSize: 20 }}>
          dripdata.co
        </div>
      </div>
    ),
    { ...size }
  );
}
