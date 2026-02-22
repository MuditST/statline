import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-poppler shells out to native binaries (pdftotext.exe) — these must
  // NOT be bundled by Turbopack. Let Node.js resolve them at runtime.
  serverExternalPackages: ['node-poppler', 'node-poppler-win32'],
};

export default nextConfig;
