import { pathToFileURL } from "node:url";
import { loadConfig, type Config } from "../src/config.js";

export interface DeploymentCheck {
  id: string;
  passed: boolean;
}

/** Offline transport checks only; never reports configuration values or credentials. */
export function checkOAuthDeployment(config: Config): DeploymentCheck[] {
  const oauth = config.mcpAuth.mode === "oauth" ? config.mcpAuth : undefined;
  const resource = oauth ? new URL(oauth.resourceUri) : undefined;
  const grist = new URL(config.gristBaseUrl);
  return [
    { id: "oauth_mode", passed: oauth !== undefined },
    {
      id: "canonical_mcp_resource",
      passed: resource !== undefined && resource.protocol === "https:" &&
        resource.pathname === "/mcp" && resource.search === "" &&
        resource.hash === "" && resource.username === "" && resource.password === ""
    },
    {
      id: "public_resource_host_allowed",
      passed: resource !== undefined && config.mcpAllowedHosts.includes(resource.hostname)
    },
    { id: "grist_https", passed: grist.protocol === "https:" },
    {
      id: "bounded_operation_limits",
      passed: config.maxReadRecords > 0 && config.maxWriteRecords > 0 && config.maxSchemaItems > 0
    }
  ];
}

export function runPreflight(): number {
  let config: Config;
  try {
    config = loadConfig();
  } catch {
    // Some configuration exceptions include supplied values. Never print them.
    console.log("configuration_valid: FAIL");
    return 1;
  }
  const checks = checkOAuthDeployment(config);
  console.log("configuration_valid: PASS");
  for (const check of checks) console.log(`${check.id}: ${check.passed ? "PASS" : "FAIL"}`);
  console.log("multi_user_readiness: BLOCKED_C5_STATIC_GRIST_CREDENTIAL");
  console.log("live_oauth_validation: REQUIRED_SEPARATELY");
  return checks.every((check) => check.passed) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = runPreflight();
}
