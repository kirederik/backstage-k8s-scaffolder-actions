import { TemplateAction } from "@backstage/plugin-scaffolder-node";
import { apply } from "./apply";
import { deleteAction } from "./delete";
import { wait } from "./wait";

export function kubernetesActions(): TemplateAction<any, any>[] {
  return [apply(), wait(), deleteAction()];
}
