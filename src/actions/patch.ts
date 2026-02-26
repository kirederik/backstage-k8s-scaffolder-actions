import { createTemplateAction, TemplateAction } from "@backstage/plugin-scaffolder-node";
import { z } from "zod";
import { kubePatch } from "../lib/patch";

type PatchActionInput = {
  patchData: any;
};

export const patchAction = (): TemplateAction<PatchActionInput> => {
  return createTemplateAction<PatchActionInput>({
    id: "kube:patch",
    description:
      "Applies a JSON or Merge patch to an existing Kubernetes resource. Equivalent to 'kubectl patch --type json|merge -f patch.json'.",
    schema: {
      input: z.object({
        patchData: z
          .any()
          .describe(
            "Kubernetes manifest containing kind, metadata (name, namespace), and either a full spec (for merge) or an array of operations (for JSON patch)."
          ),
      }),
      output: z.object({
        result: z.any().describe("Kubernetes API response after applying the patch."),
      }),
    },

    async handler(ctx) {
      const { patchData } = ctx.input;
      const kind = patchData?.kind ?? "UnknownKind";
      const ns = patchData?.metadata?.namespace ?? "default";
      const name = patchData?.metadata?.name ?? "unknown";

      ctx.logger.info(`kube:patch → Applying patch to ${kind}/${ns}/${name}`);

      try {
        const result = await kubePatch(patchData, ctx.logger);
        ctx.logger.info(`kube:patch → Patch applied successfully to ${kind}/${ns}/${name}`);
        ctx.output("result", result);
      } catch (e: any) {
        const msg = e?.body ? JSON.stringify(e.body) : e?.message || String(e);
        ctx.logger.error(`kube:patch → Failed to patch ${kind}/${ns}/${name}: ${msg}`);
        throw e;
      }
    },
  });
};
