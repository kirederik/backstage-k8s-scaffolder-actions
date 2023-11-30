import {
  TemplateAction,
  createTemplateAction,
} from "@backstage/plugin-scaffolder-node";
import { z } from "zod";
import { kubeApply } from "../lib/apply";

type ApplyActionInput = {
  manifest: string;
  namespaced: boolean;
};

export const apply: () => TemplateAction<ApplyActionInput> = () => {
  return createTemplateAction<ApplyActionInput>({
    id: "kube:apply",
    schema: {
      input: z.object({
        manifest: z
          .string()
          .describe("The resource manifest to apply in the Platform cluster"),
        namespaced: z
          .boolean()
          .describe("Whether the API is namespaced or not"),
      }),
    },

    async handler(ctx) {
      try {
        const resp = await kubeApply(ctx.input.manifest, ctx.logger);
        ctx.logger.info(
          `Successfully created/updated ${resp[0]?.metadata?.namespace}/${resp[0]?.metadata?.name} the resource.`
        );
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
