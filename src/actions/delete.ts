import {
  TemplateAction,
  createTemplateAction,
} from "@backstage/plugin-scaffolder-node";
import { z } from "zod";
import { kubeDelete } from "../lib/delete";
import { KubernetesClientFactory } from "../lib/kubernetes-client-factory";

type DeleteActionInput = {
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
  clusterName?: string;
  token?: string;
};

export const deleteAction = (
  kubeClientFactory?: KubernetesClientFactory
): TemplateAction<DeleteActionInput> => {
  return createTemplateAction<DeleteActionInput>({
    id: "kube:delete",
    schema: {
      input: z.object({
        apiVersion: z.string().describe("The apiVersion of the resource"),
        kind: z.string().describe("The kind of the resource"),
        name: z.string().describe("The name of the resource"),
        namespace: z
          .string()
          .default("default")
          .describe("The namespace of the resource"),
        clusterName: z
          .string()
          .optional()
          .describe("The name of the Kubernetes cluster to use (from app-config)"),
        token: z
          .string()
          .optional()
          .describe(
            'An optional OIDC token that will be used to authenticate to the Kubernetes cluster',
          ),
      }),
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
