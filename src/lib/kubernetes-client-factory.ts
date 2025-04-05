import { Config } from '@backstage/config';
import * as k8s from '@kubernetes/client-node';
import { Logger } from 'winston';

/**
 * Options for creating a Kubernetes client.
 */
export interface KubernetesClientFactoryOptions {
  /** The cluster name to use (as defined in app-config.yaml) */
  clusterName?: string;
  /** The entity ref to use for authorization (optional) */
  entityRef?: {
    kind: string;
    namespace: string;
    name: string;
  };
  /** The namespace to use (optional) */
  namespace?: string;
  /** The token to use for OIDC authentication (optional) */
  token?: string;
}

/**
 * Factory for creating Kubernetes clients that leverages Backstage's Kubernetes integration.
 */
export class KubernetesClientFactory {
  private configuredClusters: Map<string, k8s.KubeConfig> = new Map();
  private readonly logger: Logger;
  private readonly config: Config;

  constructor(options: { logger: Logger; config: Config }) {
    this.logger = options.logger;
    this.config = options.config;
    
    // Initialize the cluster configurations from app-config
    this.initializeClusters();
  }

  /**
   * Initializes cluster configurations from Backstage config.
   */
  private initializeClusters() {
    try {
      // Check if kubernetes config section exists
      if (!this.config.has('kubernetes')) {
        this.logger.info('No Kubernetes configuration found in app-config, will use default kubeconfig');
        return;
      }

      // Get Kubernetes cluster configurations from app-config.yaml
      const clusterConfigs = this.config.getOptionalConfigArray('kubernetes.clusterLocatorMethods') || [];
      
      for (const locatorConfig of clusterConfigs) {
        const type = locatorConfig.getString('type');
        
        if (type === 'config') {
          // Handle config-based cluster locator
          const clusters = locatorConfig.getConfigArray('clusters');
          
          for (const clusterConfig of clusters) {
            const name = clusterConfig.getString('name');
            const url = clusterConfig.getString('url');
            const authProvider = clusterConfig.getString('authProvider');
            const skipTLSVerify = clusterConfig.getOptionalBoolean('skipTLSVerify') ?? false;
            const caData = clusterConfig.getOptionalString('caData');
            
            const kubeConfig = new k8s.KubeConfig();
            
            // Create a cluster entry
            kubeConfig.addCluster({
              name: name,
              server: url,
              skipTLSVerify: skipTLSVerify,
              caData: caData,
            });
            
            // Add auth based on the authProvider type
            switch (authProvider) {
              case 'serviceAccount':
                const serviceAccountToken = clusterConfig.getString('serviceAccountToken');
                kubeConfig.addUser({
                  name: name,
                  token: serviceAccountToken,
                });
                break;
              case 'oidc':
                // For OIDC auth provider, we'll add a placeholder user with the authProvider set to 'oidc'. Token will be set later from the user input.
                kubeConfig.addUser({
                  name: name,
                  authProvider: 'oidc',
                });
                break;
              default:
                this.logger.warn(`Unsupported auth provider: ${authProvider} for cluster ${name}, falling back to default`);
                // For unsupported auth providers, we'll still add a placeholder user
                kubeConfig.addUser({
                  name: name,
                });
                break;
            }
            
            // Set the context to use the cluster and user
            kubeConfig.addContext({
              name: name,
              cluster: name,
              user: name,
            });
            
            // Set the current context
            kubeConfig.setCurrentContext(name);
            
            // Store the KubeConfig in the map
            this.configuredClusters.set(name, kubeConfig);
            this.logger.info(`Added Kubernetes cluster "${name}" from app-config`);
          }
        } else {
          this.logger.info(`Cluster locator type "${type}" is not directly supported in this plugin yet`);
        }
      }
      
      this.logger.info(`Initialized ${this.configuredClusters.size} Kubernetes clusters from config`);
    } catch (error) {
      this.logger.warn(`Failed to initialize Kubernetes clusters from config: ${error}. Will use default kubeconfig.`);
    }
  }

  /**
   * Gets a Kubernetes client for the specified cluster or the default one.
   * If specified cluster uses OIDC authentication, provided user token will be set in the kubeconfig.
   * Falls back to default kubeconfig if no specific cluster is requested or none is configured.
   */
  public getKubeConfig(
    options?: KubernetesClientFactoryOptions,
  ): k8s.KubeConfig {
    const clusterName = this.getEffectiveClusterName(options?.clusterName);

    if (!clusterName) {
      return this.getFallbackKubeConfig('No configured clusters available');
    }

    const kubeConfig = this.configuredClusters.get(clusterName);
    if (!kubeConfig) {
      return this.getFallbackKubeConfig(
        `No configuration found for Kubernetes cluster "${clusterName}"`,
      );
    }

    if (this.isOIDCCluster(kubeConfig)) {
      return this.handleOIDCKubeConfig(kubeConfig, clusterName, options);
    }

    this.logger.info(
      `Using Kubernetes configuration for cluster "${clusterName}"`,
    );
    return kubeConfig;
  }

  /**
   * Gets a Kubernetes API client for a specific Kubernetes resource type
   */
  public getApiClient<T extends k8s.ApiType>(
    apiClientConstructor: new (server: string, opts?: k8s.HTTPOptions) => T,
    options?: KubernetesClientFactoryOptions,
  ): T {
    const kubeConfig = this.getKubeConfig(options);
    return kubeConfig.makeApiClient(apiClientConstructor);
  }

  /**
   * Gets a Kubernetes object client that works with any resource type
   */
  public getObjectsClient(options?: KubernetesClientFactoryOptions): k8s.KubernetesObjectApi {
    const kubeConfig = this.getKubeConfig(options);
    return k8s.KubernetesObjectApi.makeApiClient(kubeConfig);
  }

  /**
   * If a cluster name is provided, that name is returned. Otherwise, if any clusters are configured,
   * the first configured cluster is returned as the default. If no clusters are configured, undefined
   * is returned.
   */ 
  private getEffectiveClusterName(clusterName?: string): string | undefined {
    if (clusterName) {
      return clusterName;
    }

    if (this.configuredClusters.size > 0) {
      const defaultCluster = Array.from(this.configuredClusters.keys())[0];
      this.logger.info(
        `No specific cluster requested, using default cluster "${defaultCluster}"`,
      );
      return defaultCluster;
    }

    return undefined;
  }

  /**
   * This method is invoked when a specific cluster configuration is unavailable or invalid.
   * It logs the provided reason and loads the default kubeconfig from the system, which is then returned.
   */
  private getFallbackKubeConfig(reason: string): k8s.KubeConfig {
    this.logger.info(`${reason}, falling back to default kubeconfig`);

    const fallbackKubeConfig = new k8s.KubeConfig();
    fallbackKubeConfig.loadFromDefault();

    return fallbackKubeConfig;
  }

  private isOIDCCluster(kubeConfig: k8s.KubeConfig): boolean {
    return kubeConfig.getCurrentUser()?.authProvider === 'oidc';
  }

  /**
   * This method creates a new kubeconfig by copying the cluster details from the provided configuration,
   * and then sets up a user with the given OIDC token. If the token is missing or the cluster configuration is invalid,
   * it falls back to loading the default kubeconfig.
   */
  private handleOIDCKubeConfig(
    kubeConfig: k8s.KubeConfig,
    clusterName: string,
    options?: KubernetesClientFactoryOptions,
  ): k8s.KubeConfig {
    const userToken = options?.token;
    if (!userToken) {
      return this.getFallbackKubeConfig(
        `No user token provided for OIDC cluster "${clusterName}"`,
      );
    }
    const cluster = kubeConfig.getCluster(clusterName);
    if (!cluster) {
      return this.getFallbackKubeConfig(
        `No cluster configuration found for OIDC cluster "${clusterName}"`,
      );
    }

    const newKubeConfig = new k8s.KubeConfig();
    newKubeConfig.addCluster(cluster);
    newKubeConfig.addUser({
      name: cluster.name,
      token: userToken,
      authProvider: 'oidc',
    });
    newKubeConfig.addContext({
      name: cluster.name,
      cluster: cluster.name,
      user: cluster.name,
    });
    newKubeConfig.setCurrentContext(cluster.name);

    return newKubeConfig;
  }
}
