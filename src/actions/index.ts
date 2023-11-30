import { apply } from "./apply";
import { wait } from "./wait";
import { deleteAction } from "./delete";

export function kubernetesActions(): any[] {
  return [apply(), wait(), deleteAction()];
}
