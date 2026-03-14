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
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
          padding: "60px 72px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 500,
            height: 500,
            background: "radial-gradient(ellipse, rgba(34,197,94,0.18) 0%, transparent 65%)",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        {/* Background glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 400,
            height: 400,
            background: "radial-gradient(ellipse, rgba(34,197,94,0.08) 0%, transparent 65%)",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* Top: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 38 }}>💧</span>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#ffffff", letterSpacing: "-1px" }}>Drip</span>
            <span style={{ fontSize: 38, fontWeight: 800, color: "#22c55e", letterSpacing: "-1px" }}>Data</span>
          </div>
        </div>

        {/* Middle: Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.1,
                letterSpacing: "-2px",
              }}
            >
              Your Dividend Research,
            </span>
            <span
              style={{
                fontSize: 68,
                fontWeight: 800,
                color: "#22c55e",
                lineHeight: 1.1,
                letterSpacing: "-2px",
              }}
            >
              All in One Place
            </span>
          </div>
          <span
            style={{
              fontSize: 26,
              color: "#9ca3af",
              maxWidth: 680,
              lineHeight: 1.45,
            }}
          >
            Real-time yield calculators, ETF deep-dives, and portfolio tracking for income investors.
          </span>
        </div>

        {/* Bottom: Stats + URL */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 48 }}>
            {[
              { value: "8+", label: "Dividend Tools" },
              { value: "Live", label: "Market Data" },
              { value: "$5/mo", label: "Pro Plan" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: "#22c55e" }}>{s.value}</span>
                <span style={{ fontSize: 17, color: "#6b7280" }}>{s.label}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 20, color: "#374151", fontWeight: 500 }}>dripdata.co</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
