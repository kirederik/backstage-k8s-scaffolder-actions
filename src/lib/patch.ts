import * as k8s from "@kubernetes/client-node";

export async function kubePatch(
  patchData: any,
  logger: any,
): Promise<any> {
  try {
    const { apiVersion, kind, metadata } = patchData || {};
    const name = metadata?.name;
    const namespace = metadata?.namespace;

    if (!apiVersion || !kind || !name || !namespace) {
      throw new Error(
        "patchData must include apiVersion, kind, metadata.name, and metadata.namespace"
      );
    }

    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

    const isJsonPatch = Array.isArray(patchData.patch);
    logger.info(
      `Applying ${isJsonPatch ? "JSON" : "merge"} patch to ${kind}/${namespace}/${name}`
    );

    const [group, version] = apiVersion.includes("/")
      ? apiVersion.split("/")
      : ["", apiVersion];

    const plural = `${kind.toLowerCase()}s`;

    const body = isJsonPatch ? patchData.patch : patchData;
    const contentType = isJsonPatch
      ? "application/json-patch+json"
      : "application/merge-patch+json";

    const response = await customObjectsApi.patchNamespacedCustomObject(
      group,
      version,
      namespace,
      plural,
      name,
      body,
      undefined,      // 7: pretty
      undefined,      // 8: dryRun
      undefined,      // 9: fieldManager
      { headers: { "Content-Type": contentType } }
    );

    logger.info(`Patch applied successfully to ${kind}/${namespace}/${name}`);
    return response.body;
  } catch (err: any) {
    const msg = err?.body ? JSON.stringify(err.body) : err?.message || String(err);
    logger.error(`kubePatch failed: ${msg}`);
    throw err;
  }
}
