import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Fully static — no server runtime needed. Ideal for Vercel static hosting.
  output: "export",
  images: { unoptimized: true },
  // Pin the tracing root to this app so a stray lockfile elsewhere on the
  // machine does not confuse Next's workspace detection.
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
