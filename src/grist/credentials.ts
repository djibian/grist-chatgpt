import type { Principal } from "../auth/principal.js";
import { GristClient } from "./client.js";

export interface GristCredentialContext {
  principal: Principal;
}

/**
 * Server-side credential boundary for upstream Grist access.
 *
 * Implementations may resolve credentials dynamically, but must never expose
 * them through model-visible tool inputs/outputs, logs or audit payloads.
 */
export interface GristCredentialProvider {
  getApiKey(context: GristCredentialContext): Promise<string>;
}

/**
 * Development/backward-compatible provider preserving the current single-key
 * deployment while the rest of the runtime depends only on the provider seam.
 */
export class StaticApiKeyCredentialProvider implements GristCredentialProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error("Static Grist API key must not be empty.");
    }
  }

  async getApiKey(_context: GristCredentialContext): Promise<string> {
    return this.apiKey;
  }
}

/**
 * Credential-aware client construction seam. Future user-aware providers can
 * resolve a different credential per principal without changing GristClient or
 * the business services that consume it.
 */
export class GristClientFactory {
  constructor(
    private readonly baseUrl: string,
    private readonly credentialProvider: GristCredentialProvider
  ) {}

  async createClient(context: GristCredentialContext): Promise<GristClient> {
    const apiKey = await this.credentialProvider.getApiKey(context);
    if (!apiKey.trim()) {
      throw new Error("Grist credential provider returned an empty API key.");
    }

    return new GristClient({
      baseUrl: this.baseUrl,
      apiKey
    });
  }
}
