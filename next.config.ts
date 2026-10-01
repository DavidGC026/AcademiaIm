import type { NextConfig } from "next";
import { execSync } from "node:child_process";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

function getTailscaleOrigins(): string[] {
  try {
    const ip = execSync("tailscale ip -4", { encoding: "utf8" }).trim();
    const status = JSON.parse(
      execSync("tailscale status --json", { encoding: "utf8" })
    ) as { Self?: { DNSName?: string } };
    const dnsName = status.Self?.DNSName?.replace(/\.$/, "");
    return [ip, dnsName].filter(Boolean) as string[];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  allowedDevOrigins: ["192.168.0.230", "*.ts.net", ...getTailscaleOrigins()],
};

export default nextConfig;
