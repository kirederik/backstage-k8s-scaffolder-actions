import { createTemplateAction } from "@backstage/plugin-scaffolder-node";
import { kubeDelete } from "../lib/delete";
import { KubernetesClientFactory } from "../lib/kubernetes-client-factory";

export const deleteAction = (
  kubeClientFactory?: KubernetesClientFactory
) => {
  return createTemplateAction({
    id: "kube:delete",
    schema: {
      input: {
        apiVersion: (z) => z.string().describe("The apiVersion of the resource"),
        kind: (z) => z.string().describe("The kind of the resource"),
        name: (z) => z.string().describe("The name of the resource"),
        namespace: (z) => z
          .string()
          .default("default")
          .describe("The namespace of the resource"),
        clusterName: (z) => z
          .string()
          .optional()
          .describe("The name of the Kubernetes cluster to use (from app-config)"),
        token: (z) => z
          .string()
          .optional()
          .describe(
            'An optional OIDC token that will be used to authenticate to the Kubernetes cluster',
          ),
      },
    },

    async handler(ctx) {
      try {
        await kubeDelete(
          ctx.input.apiVersion,
          ctx.input.kind,
          ctx.input.name,
          ctx.input.namespace,
          ctx.logger,
          kubeClientFactory,
          ctx.input.clusterName,
          ctx.input.token
        );
        ctx.logger.info(`Successfully deleted the resource`);
      } catch (e) {
        ctx.logger.error(
          `Something went wrong: ${JSON.stringify(
            e.body,
            null,
            2
          )} Response ${JSON.stringify(e.response, null, 2)}.`
        );
        throw e;
      }
    },
  });
};
