import {
  TemplateAction,
  createTemplateAction,
} from "@backstage/plugin-scaffolder-node";
import * as k8s from "@kubernetes/client-node";
import { z } from "zod";

type WaitActionInput = {
  labels: Record<string, string>;
  namespace: string;
};

export const wait: () => TemplateAction<WaitActionInput> = () => {
  return createTemplateAction<WaitActionInput>({
    id: "kube:job:wait",
    schema: {
      input: z.object({
        labels: z
          .record(z.string())
          .describe("The labels of the job resource to wait on"),
        namespace: z
          .string()
          .default("default")
          .describe("The namespace of the resource to wait on, e.g. default"),
      }),
    },

    async handler(ctx) {
      try {
        const conditions = await kubeWait(
          ctx.input.labels,
          ctx.input.namespace
        );
        ctx.logger.info("returning successfully");
        conditions?.forEach((condition) => {
          ctx.logger.info(JSON.stringify(condition));
        });
        return;
      } catch (err) {
        ctx.logger.error(err);
        return;
      }
    },
  });
};

// https://github.com/kubernetes-client/javascript/blob/master/examples/typescript/apply/apply-example.ts
async function kubeWait(labels: Record<string, string>, namespace: string) {
  let attempts: number = 0;
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();

  const jobApi = kc.makeApiClient(k8s.BatchV1Api);
  while (attempts < 10) {
    try {
      // get the job by labels
      const req = await jobApi.listNamespacedJob(
        namespace || "default",
        undefined,
        undefined,
        undefined,
        undefined,
        Object.entries(labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(",")
      );
      if (req.body.items.length > 1) {
        // return true if the jobcompleted
        throw Error(`Found multiple jobs: ${req.body.items.length}`);
      }
      const job = req.body.items[0];
      // return true if the jobcompleted
      console.log(job.metadata?.name);
      if (job.status?.completionTime) {
        return job.status?.conditions;
      }
    } catch (err) {
      console.log("exploded here");
    }
    console.log("requeue");
    attempts++;
    await delay(5000);
  }
  throw Error("Timed out waiting for job to complete");
}
