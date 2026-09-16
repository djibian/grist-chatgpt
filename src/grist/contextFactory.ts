import type { AuditLogger } from "../audit/auditLogger.js";
import { AuthorizationService } from "../auth/authorizationService.js";
import type { Principal } from "../auth/principal.js";
import {
  AccessPolicy,
  DeploymentResourcePolicy,
  GristResourceDiscovery
} from "./accessPolicy.js";
import { AuthorizedGristService } from "./authorizedService.js";
import type { GristClientFactory } from "./credentials.js";
import { GristService, type GristServiceOptions } from "./service.js";
import { GristUiActionsAdapter } from "./uiActionsAdapter.js";

export interface GristContextFactoryOptions extends GristServiceOptions {
  discoveryCacheTtlMs?: number;
}

/**
 * Builds one complete Grist service graph for one bridge principal.
 *
 * The deployment policy and audit sink are safe to share, but every call gets
 * a fresh credential-derived client, discovery cache, access policy and
 * authorization/service graph. The factory deliberately does not retain or
 * reuse user-derived contexts across principals.
 */
export class GristContextFactory {
  constructor(
    private readonly clientFactory: GristClientFactory,
    private readonly deploymentPolicy: DeploymentResourcePolicy,
    private readonly audit: AuditLogger,
    private readonly options: GristContextFactoryOptions
  ) {}

  async create(principal: Principal): Promise<AuthorizedGristService> {
    const client = await this.clientFactory.createClient({ principal });
    const discovery = new GristResourceDiscovery(client, {
      ...(this.options.discoveryCacheTtlMs !== undefined
        ? { cacheTtlMs: this.options.discoveryCacheTtlMs }
        : {})
    });
    const accessPolicy = new AccessPolicy(
      client,
      this.deploymentPolicy,
      discovery
    );
    const baseGrist = new GristService(client, accessPolicy, {
      maxReadRecords: this.options.maxReadRecords,
      maxWriteRecords: this.options.maxWriteRecords,
      writeBatchRecords: this.options.writeBatchRecords,
      maxSchemaItems: this.options.maxSchemaItems
    });
    const authorization = new AuthorizationService(accessPolicy);
    const uiActions = new GristUiActionsAdapter(client);

    return new AuthorizedGristService(
      baseGrist,
      authorization,
      this.audit,
      principal,
      uiActions
    );
  }
}
