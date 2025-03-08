import {
  coreServices,
  createBackendModule,
} from "@backstage/backend-plugin-api";
import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";

import { kubernetesActions } from "./actions";
// import { ScmIntegrations } from "@backstage/integration";
import { KubernetesClientFactory } from "./lib/kubernetes-client-factory";

export const scaffolderK8sActions = createBackendModule({
  pluginId: "scaffolder",
  moduleId: "custom-extensions",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
        logger: coreServices.logger,
      },
      async init({ scaffolder, config, logger }) {
        // Create a shared Kubernetes client factory instance
        const kubeClientFactory = new KubernetesClientFactory({
          logger,
          config,
        });

        scaffolder.addActions(...kubernetesActions(kubeClientFactory));
      },
    });
  },
});