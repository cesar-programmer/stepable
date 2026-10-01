import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["pg-boss"],
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
