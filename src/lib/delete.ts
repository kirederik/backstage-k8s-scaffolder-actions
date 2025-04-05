import * as k8s from "@kubernetes/client-node";
import { KubernetesClientFactory } from "./kubernetes-client-factory";

export async function kubeDelete(
  apiVersion: string,
  kind: string,
  name: string,
  namespace: string,
  logger: any,
  kubeClientFactory?: KubernetesClientFactory,
  clusterName?: string,
  token?: string
) {
  let client: k8s.KubernetesObjectApi;

  if (kubeClientFactory) {
    // Use the KubernetesClientFactory if provided
    client = kubeClientFactory.getObjectsClient({
      clusterName: clusterName,
      namespace: namespace,
      token: token,
    });
    logger.info(`Using KubernetesClientFactory for cluster: ${clusterName || 'default'}`);
  } else {
    // Fallback to default KubeConfig
    logger.info('Using default KubeConfig');
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    client = k8s.KubernetesObjectApi.makeApiClient(kc);
  }

  try {
    logger.info(`Attempting to delete ${kind}/${namespace != undefined ? namespace + "/" : ""}${name} `);
    const obj: k8s.KubernetesObject = {
      apiVersion,
      kind,
      metadata: { name, namespace },
    };
    return await client.delete(obj);
  } catch (e) {
    logger.error(`Error deleting resource: ${e}`);
    throw e;
  }
}
