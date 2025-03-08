# Backstage Scaffolder Actions for Kubernetes

This is a Kubernetes actions plugin for the scaffolder-backend in Backstage.

It contains a set of actions to create and manage Kubernetes resources.

# Getting Started

In the root directory of your Backstage project:

```bash
yarn add @devangelista/backstage-scaffolder-kubernetes
```

Make sure to add a Kubernetes section to your `app-config.yaml` (check the
Backstage docs)

On your `package/backend/src/index.ts` file, add the following:

```ts
backend.add(import("@devangelista/backstage-scaffolder-kubernetes"));
```

The scaffolder `kube` actions should now be available to use on your templates. Check the
`/create/actions` endpoint for documentation.

# Kubernetes Configuration

This plugin now integrates with Backstage's Kubernetes integration features, allowing you to:

1. Use multiple Kubernetes clusters configured in your Backstage `app-config.yaml`
2. Support various authentication methods (ServiceAccount, Google Cloud, AWS, Azure)
3. Specify which cluster to use for each action

## Configuration Example

Here's an example Kubernetes configuration in `app-config.yaml`:

```yaml
kubernetes:
  clusterLocatorMethods:
    - type: config
      clusters:
        - name: development
          url: https://my-dev-cluster.example.com
          authProvider: serviceAccount
          serviceAccountToken: ${K8S_DEV_SA_TOKEN}
          skipTLSVerify: false
          caData: ${K8S_DEV_CA_DATA}
```

# Usage

You can now use the actions in your templates:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  description: Create a Namespace in Kubernetes
  name: create-namespace
  title: Create a Namespace
spec:
  lifecycle: experimental
  owner: user
  type: example
  parameters:
    - properties:
        name:
          description: The namespace name
          title: Name
          type: string
          ui:autofocus: true
      required:
        - name
      title: Namespace Name
    - title: Cluster Name
      properties:
        cluster:
          type: string
          enum:
            - kind-kind
            - kind-platform
          ui:autocomplete:
            options:
              - kind-kind
              - kind-platform
  steps:
    - action: kube:apply
      id: k-apply
      name: Create a Resouce
      input:
        namespaced: false
        clusterName: ${{ parameters.cluster }}
        manifest: |
          apiVersion: v1
          kind: Namespace
          metadata:
            name: ${{ parameters.name }}
---
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: delete-namespace
  description: Delete a Namespace in Kubernetes
  title: Delete a Namespace
spec:
  lifecycle: experimental
  owner: user
  type: example
  parameters:
    - properties:
        name:
          title: Name
          description: The name of the namespace to delete
          type: string
          ui:autofocus: true
      title: Namespace Name
      required:
        - name
    - title: Cluster Name
      properties:
        cluster:
          type: string
          enum:
            - kind-kind
            - kind-platform
          ui:autocomplete:
            options:
              - kind-kind
              - kind-platform
  steps:
    - action: kube:delete
      id: k-delete
      name: Delete
      input:
        apiVersion: v1
        kind: Namespace
        clusterName: ${{ parameters.cluster }}
        name: ${{ parameters.name }}
```

## Authentication Methods

The plugin currently supports the following authentication methods:

1. **Service Account**: Uses a service account token

More methods coming soon!

If no specific cluster is specified, the plugin will use the first cluster defined in the configuration, or fall back to using local kubeconfig.


