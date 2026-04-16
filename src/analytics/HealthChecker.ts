import { IEmailProvider } from "../providers/IEmailProvider";
import { ProviderHealth } from "../types/ProviderHealth";

/**
 * HealthChecker - Monitors the health status of email providers.
 * 
 * Performs health checks on all configured providers to determine:
 * - Provider availability (UP, DOWN, DEGRADED)
 * - Response latency
 * - Overall system health for monitoring and alerting
 */
export class HealthChecker {
  /**
   * Constructs a HealthChecker for specified providers.
   * 
   * @param providers - List of providers to monitor
   */
  constructor(private readonly providers: IEmailProvider[]) {}

  /**
   * Performs health checks on all providers concurrently.
   * 
   * @returns Promise resolving to array of provider health statuses
   */
  public async check(): Promise<ProviderHealth[]> {
    return Promise.all(this.providers.map((provider) => provider.healthCheck()));
  }
}
