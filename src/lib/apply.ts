// https://github.com/kubernetes-client/javascript/blob/master/examples/typescript/apply/apply-example.ts
import * as k8s from "@kubernetes/client-node";
import * as yaml from "js-yaml";
import { KubernetesClientFactory } from "./kubernetes-client-factory";

export async function kubeApply(
  specString: string,
  logger: any,
  kubeClientFactory?: KubernetesClientFactory,
  clusterName?: string,
  token?: string
): Promise<k8s.KubernetesObjectWithSpec[]> {
  let client: k8s.KubernetesObjectApi;

  if (kubeClientFactory) {
    // Use the KubernetesClientFactory if provided
    client = kubeClientFactory.getObjectsClient({
      clusterName: clusterName,
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

  const specs: k8s.KubernetesObjectWithSpec[] = yaml.loadAll(specString) as any;
  const validSpecs = specs.filter((s) => s && s.kind && s.metadata);
  const created: k8s.KubernetesObjectWithSpec[] = [];
  for (const spec of validSpecs) {
    spec.metadata = spec.metadata || {};
    spec.metadata.annotations = spec.metadata.annotations || {};
    delete spec.metadata.annotations[
      "kubectl.kubernetes.io/last-applied-configuration"
    ];
    spec.metadata.annotations[
      "kubectl.kubernetes.io/last-applied-configuration"
    ] = JSON.stringify(spec);
    try {
      // try to get the resource, if it does not exist an error will be thrown and we will end up in the catch
      // block.
      logger.info(`Attempting to get resource ${spec.kind}/${spec.metadata.name}`);
      await client.read(spec as any);
      logger.info(`Resource exists, attempting to patch ${spec.kind}/${spec.metadata.name}`);
      // patch with merge strategy
      // the body of the request was in an unknown format - accepted media types include: application/json-patch+json, application/merge-patch+json, application/apply-patch+yaml
      const response = await client.patch(
        spec,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          headers: {
            "Content-Type": "application/merge-patch+json",
          },
        }
      );
      created.push(response.body);
    } catch (e) {
      // we did not get the resource, so it does not exist, so create it
      logger.info(`Resource not found, attempting to create ${spec.kind}/${spec.metadata.name}`);
      const response = await client.create(spec);
      created.push(response.body);
    }
  }

  return created;
}
