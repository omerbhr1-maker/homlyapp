import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 120,
          background:
            "linear-gradient(135deg, #14b8a6 0%, #06b6d4 50%, #0ea5e9 100%)",
        }}
      >
        <svg
          width="300"
          height="300"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 10.6 12 4l8 6.6V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
          <path d="M9 20v-6.2" />
          <path d="M15 20v-6.2" />
          <path d="M9 14h6" />
          <path d="M16.8 6.1V4.6" />
          <path d="M18.4 3.2v2.1" />
          <path d="M17.35 4.25h2.1" />
        </svg>
      </div>
    ),
    size,
  );
}
