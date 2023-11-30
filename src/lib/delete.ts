import * as k8s from "@kubernetes/client-node";

export async function kubeDelete(
  apiVersion: string,
  kind: string,
  name: string,
  namespace: string,
  logger: any
) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();

  const client = k8s.KubernetesObjectApi.makeApiClient(kc);

  try {
    logger.info("attempting to delete resource");
    const obj: k8s.KubernetesObject = {
      apiVersion,
      kind,
      metadata: { name, namespace },
    };
    return await client.delete(obj);
  } catch (e) {
    logger.error(e);
    throw e;
  }
}
