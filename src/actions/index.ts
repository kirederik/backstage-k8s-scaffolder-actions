import { TemplateAction } from "@backstage/plugin-scaffolder-node";
import { apply } from "./apply";
import { deleteAction } from "./delete";
import { wait } from "./wait";
import { KubernetesClientFactory } from "../lib/kubernetes-client-factory";

export function kubernetesActions(
  kubeClientFactory?: KubernetesClientFactory
): TemplateAction<any, any>[] {
  return [
    apply(kubeClientFactory),
    wait(kubeClientFactory),
    deleteAction(kubeClientFactory)
  ];
}