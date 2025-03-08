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
   * Falls back to default kubeconfig if no specific cluster is requested or none is configured.
   */
  public getKubeConfig(options?: KubernetesClientFactoryOptions): k8s.KubeConfig {
    const clusterName = options?.clusterName;
    
    if (clusterName) {
      const kubeConfig = this.configuredClusters.get(clusterName);
      if (!kubeConfig) {
        this.logger.info(`No configuration found for Kubernetes cluster "${clusterName}", falling back to default kubeconfig`);
        const fallbackKubeConfig = new k8s.KubeConfig();
        fallbackKubeConfig.loadFromDefault();
        return fallbackKubeConfig;
      }
      
      this.logger.info(`Using Kubernetes configuration for cluster "${clusterName}"`);
      return kubeConfig;
    }
    
    // If no specific cluster is requested, use the default (first) cluster
    if (this.configuredClusters.size > 0) {
      const defaultCluster = Array.from(this.configuredClusters.keys())[0];
      this.logger.info(`No specific cluster requested, using default cluster "${defaultCluster}"`);
      return this.configuredClusters.get(defaultCluster)!;
    }
    
    // Fall back to using the local kubeconfig as a last resort
    this.logger.info('No configured clusters available, falling back to local kubeconfig');
    const fallbackKubeConfig = new k8s.KubeConfig();
    fallbackKubeConfig.loadFromDefault();
    return fallbackKubeConfig;
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
}