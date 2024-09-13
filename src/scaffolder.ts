import { scaffolderActionsExtensionPoint } from "@backstage/plugin-scaffolder-node/alpha";
import {
  createBackendModule,
  coreServices,
} from "@backstage/backend-plugin-api";

import { kubernetesActions } from "./actions";
// import { ScmIntegrations } from "@backstage/integration";

export const scaffolderK8sActions = createBackendModule({
  pluginId: "scaffolder",
  moduleId: "custom-extensions",
  register(env) {
    env.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        config: coreServices.rootConfig,
      },
      async init({ scaffolder }) {
        // const integrations = ScmIntegrations.fromConfig(config);

        scaffolder.addActions(...kubernetesActions());
      },
    });
  },
});
