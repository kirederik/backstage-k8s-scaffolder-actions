import {
  TemplateAction,
  createTemplateAction,
} from "@backstage/plugin-scaffolder-node";
import { z } from "zod";
import { kubeDelete } from "../lib/delete";

type DeleteActionInput = {
  namespace: string;
  apiVersion: string;
  kind: string;
  name: string;
};

export const deleteAction: () => TemplateAction<DeleteActionInput> = () => {
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
      }),
    },

    async handler(ctx) {
      try {
        await kubeDelete(
          ctx.input.apiVersion,
          ctx.input.kind,
          ctx.input.name,
          ctx.input.namespace,
          ctx.logger
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
