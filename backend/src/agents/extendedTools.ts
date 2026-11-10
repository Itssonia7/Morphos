import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const networkTraceTool = tool(
  async ({ endpoint }) => {
    return JSON.stringify({
      endpoint,
      dnsResolution: "12ms",
      tcpHandshake: "45ms",
      ttfb: "850ms",
      status: "Warning: High TTFB detected. Potential database connection pool bottleneck."
    });
  },
  {
    name: "network_trace",
    description: "Simulates a network latency trace against a given API endpoint.",
    schema: z.object({ endpoint: z.string() })
  }
);

export const logAnalyzerTool = tool(
  async ({ query, timeframe }) => {
    return JSON.stringify({
      matches: 42,
      frequentError: "Connection pool exhausted",
      timeframe,
      severity: "CRITICAL"
    });
  },
  {
    name: "log_analyzer",
    description: "Simulates searching through structured JSON server logs.",
    schema: z.object({ query: z.string(), timeframe: z.string() })
  }
);

export const extendedTools = [networkTraceTool, logAnalyzerTool];
