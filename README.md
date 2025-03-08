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

# Usage

You can now use the actions in your templates:

```yaml
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: Delete-action
  description: Delete a Kubernetes resources
  title: Delete a Kubernetes resources
spec:
  lifecycle: experimental
  owner: user
  parameters:
    - properties:
        name:
          title: Resource Name
          description: The name of the resource to delete
          type: string
          ui:autofocus: true
        namespace:
          title: Namespace
          description: The namespace of the resource
          type: string
          default: default
      title: Resource
      required:
        - name
        - namespace
  steps:
    - action: kube:delete
      id: k-delete
      name: Delete
      input:
        apiVersion: example.group.bar/v1
        kind: Foo
        namespace: ${{parameters.namespace}}
        name: ${{ parameters.name }}

---
apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  description: Create a Kubernetes resources
  name: create-resource
  title: Jenkins
spec:
  lifecycle: experimental
  owner: user
  type: example
  parameters:
    - properties:
        name:
          description: The name of the Resource
          title: Name
          type: string
          ui:autofocus: true
      required:
        - name
      title: Resource
  steps:
    - action: kube:apply
      id: k-apply
      name: Create a Resouce
      input:
        namespaced: true
        manifest: |
          apiVersion: example.group.bar/v1
          kind: Foo
          metadata:
            name: ${{ parameters.name }}
            namespace: default
    - action: kube:job:wait
      id: k-wait
      name: Wait for a Job to complete
      input:
        labels:
          job-name: foo-bar
          # more labels
```
