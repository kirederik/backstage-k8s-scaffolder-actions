import {
  TemplateAction,
  createTemplateAction,
} from "@backstage/plugin-scaffolder-node";
import * as k8s from "@kubernetes/client-node";
import { z } from "zod";
import { KubernetesClientFactory } from "../lib/kubernetes-client-factory";

type WaitActionInput = {
  labels: Record<string, string>;
  namespace: string;
  clusterName?: string;
  timeoutSeconds?: number;
  token?: string;
};

export const wait = (
  kubeClientFactory?: KubernetesClientFactory
): TemplateAction<WaitActionInput> => {
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
        clusterName: z
          .string()
          .optional()
          .describe("The name of the Kubernetes cluster to use (from app-config)"),
        timeoutSeconds: z
          .number()
          .optional()
          .default(60)
          .describe("The timeout in seconds to wait for the job to complete"),
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
        const conditions = await kubeWait(
          ctx.input.labels,
          ctx.input.namespace,
          kubeClientFactory,
          ctx.input.clusterName,
          ctx.input.timeoutSeconds || 60,
          ctx.logger,
          ctx.input.token
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
async function kubeWait(
  labels: Record<string, string>,
  namespace: string,
  kubeClientFactory?: KubernetesClientFactory,
  clusterName?: string,
  timeoutSeconds: number = 60,
  logger?: any,
  token?: string
) {
  let attempts: number = 0;
  const maxAttempts = Math.ceil(timeoutSeconds / 5); // Check every 5 seconds
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  let jobApi: k8s.BatchV1Api;

  if (kubeClientFactory) {
    // Use the KubernetesClientFactory if provided
    jobApi = kubeClientFactory.getApiClient(k8s.BatchV1Api, {
      clusterName: clusterName,
      namespace: namespace,
      token: token,
    });
    logger?.info(`Using KubernetesClientFactory for cluster: ${clusterName || 'default'}`);
  } else {
    // Fallback to default KubeConfig
    logger?.info('Using default KubeConfig');
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    jobApi = kc.makeApiClient(k8s.BatchV1Api);
  }

  while (attempts < maxAttempts) {
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
      logger?.info(`Checking job: ${job.metadata?.name}`);
      if (job.status?.completionTime) {
        return job.status?.conditions;
      }
    } catch (err) {
      logger?.error("Error checking job status:", err);
    }
    logger?.info("Waiting for job to complete, attempt: " + (attempts + 1));
    attempts++;
    await delay(5000);
  }
  throw Error(`Timed out waiting for job to complete after ${timeoutSeconds} seconds`);
}
