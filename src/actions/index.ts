import { apply } from "./apply";
import { wait } from "./wait";
import { deleteAction } from "./delete";
import { TemplateAction } from "@backstage/plugin-scaffolder-node";

export function kubernetesActions(): TemplateAction<any, any>[] {
  return [apply(), wait(), deleteAction()];
}
