import * as k8s from '@kubernetes/client-node';
import { KubernetesClientFactory } from './kubernetes-client-factory';
import { ConfigReader } from '@backstage/config';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('KubernetesClientFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize from default when kubernetes config is not present', () => {
      const mockConfig = new ConfigReader({});

      new KubernetesClientFactory({
        logger: mockLogger,
        config: mockConfig,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No Kubernetes configuration found in app-config, will use default kubeconfig'
      );
    });

    it('should initialize with clusters from config', () => {
      const mockConfig = new ConfigReader({
        kubernetes: {
          clusterLocatorMethods: [
            {
              type: 'config',
              clusters: [
                {
                  name: 'test-cluster',
                  url: 'https://test-cluster.example.com',
                  authProvider: 'serviceAccount',
                  serviceAccountToken: 'test-token',
                },
              ],
            },
          ],
        },
      });

      new KubernetesClientFactory({
        logger: mockLogger,
        config: mockConfig,
      });


      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initialized 1 Kubernetes clusters from config'
      );
    });
  });

  describe('getKubeConfig', () => {
    it('should fall back to default kubeConfig when no clusters are configured', () => {
      const mockConfig = new ConfigReader({});
      const mockLoadFromDefault = jest.fn();
      jest.spyOn(k8s.KubeConfig.prototype, 'loadFromDefault').mockImplementation(mockLoadFromDefault);

      const factory = new KubernetesClientFactory({
        logger: mockLogger,
        config: mockConfig,
      });

      factory.getKubeConfig();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No Kubernetes configuration found in app-config, will use default kubeconfig'
      );

      expect(mockLoadFromDefault).toHaveBeenCalled();
    });

    it('should return configured kubeConfig when clusters are configured', () => {
      const mockConfig = new ConfigReader({
        kubernetes: {
          clusterLocatorMethods: [
            {
              type: 'config',
              clusters: [
                {
                  name: 'test-cluster',
                  url: 'https://test-cluster.example.com',
                  authProvider: 'serviceAccount',
                  serviceAccountToken: 'test-token',
                  skipTLSVerify: false,
                  caData: 'test-ca-data',
                },
              ],
            },
          ],
        },
      });

      const factory = new KubernetesClientFactory({
        logger: mockLogger,
        config: mockConfig,
      });

      const kc = factory.getKubeConfig({ clusterName: 'test-cluster' });
      expect(kc.getContextObject('test-cluster')).toEqual({
        cluster: 'test-cluster',
        name: 'test-cluster',
        user: 'test-cluster',
      });
      expect(kc.getUser('test-cluster')).toEqual({
        name: 'test-cluster',
        token: 'test-token',
      });
      expect(kc.getCluster('test-cluster')).toEqual({
        name: 'test-cluster',
        server: 'https://test-cluster.example.com',
        skipTLSVerify: false,
        caData: 'test-ca-data',
      });
    });

    it('should use the token when cluster uses OIDC authentication', () => {
      const mockConfig = new ConfigReader({
        kubernetes: {
          clusterLocatorMethods: [
            {
              type: 'config',
              clusters: [
                {
                  name: 'test-oidc',
                  url: 'https://test-oidc.example.com',
                  authProvider: 'oidc',
                  skipTLSVerify: false,
                  caData: 'test-ca-data',
                },
              ],
            },
          ],
        },
      });

      const factory = new KubernetesClientFactory({
        logger: mockLogger,
        config: mockConfig,
      });

      const kc = factory.getKubeConfig({ clusterName: 'test-oidc', token: 'oidc-token' });
      expect(kc.getContextObject('test-oidc')).toEqual({
        cluster: 'test-oidc',
        name: 'test-oidc',
        user: 'test-oidc',
      });
      expect(kc.getUser('test-oidc')).toEqual({
        name: 'test-oidc',
        token: 'oidc-token',
        authProvider: 'oidc',
      });
      expect(kc.getCluster('test-oidc')).toEqual({
        name: 'test-oidc',
        server: 'https://test-oidc.example.com',
        skipTLSVerify: false,
        caData: 'test-ca-data',
      });
    });
  });

  describe('client creation', () => {
    it('should create an API client', () => {
      const mockConfig = new ConfigReader({});

      const factory = new KubernetesClientFactory({
        logger: mockLogger,
        config: mockConfig,
      });
      const mockMakeApi = jest.fn();
      const mockKubeConfig = new k8s.KubeConfig();
      jest.spyOn(mockKubeConfig, 'makeApiClient').mockImplementation(mockMakeApi);
      jest.spyOn(factory, 'getKubeConfig').mockReturnValue(mockKubeConfig);

      factory.getApiClient(k8s.BatchV1Api);

      expect(factory.getKubeConfig).toHaveBeenCalled();
      expect(mockKubeConfig.makeApiClient).toHaveBeenCalledWith(k8s.BatchV1Api);
    });
  });
});

