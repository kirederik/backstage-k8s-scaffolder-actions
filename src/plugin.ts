import {
  coreServices,
  createBackendPlugin,
} from "@backstage/backend-plugin-api";

export const k8sActions = createBackendPlugin({
  pluginId: "k8s-scaffolder-actions",
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
      },
      async init({ logger }) {
        logger.info("Hello from k8s plugin plugin");
      },
    });
  },
});
