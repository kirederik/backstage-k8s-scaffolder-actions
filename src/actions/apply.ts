import {
  TemplateAction,
  createTemplateAction,
} from "@backstage/plugin-scaffolder-node";
import { z } from "zod";
import { kubeApply } from "../lib/apply";
import { KubernetesClientFactory } from "../lib/kubernetes-client-factory";

type ApplyActionInput = {
  manifest: string;
  namespaced: boolean;
  clusterName?: string;
  token?: string;
};

export const apply = (
  kubeClientFactory?: KubernetesClientFactory
): TemplateAction<ApplyActionInput> => {
  return createTemplateAction<ApplyActionInput>({
    id: "kube:apply",
    schema: {
      input: z.object({
        manifest: z
          .string()
          .describe("The resource manifest to apply in the Platform cluster"),
        namespaced: z
          .boolean()
          .describe("Whether the API is namespaced or if its not"),
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

    async handler(ctx: any) {
      try {
        const resp = await kubeApply(
          ctx.input.manifest,
          ctx.logger,
          kubeClientFactory,
          ctx.input.clusterName,
          ctx.input.token
        );
        if (ctx.namespaced) {
          ctx.logger.info(
            `Successfully created/updated ${resp[0]?.kind}/${resp[0]?.metadata?.namespace}/${resp[0]?.metadata?.name}.`
          );
        } else {
          ctx.logger.info(
            `Successfully created/updated ${resp[0]?.kind}/${resp[0]?.metadata?.name}.`
          );
        }
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
