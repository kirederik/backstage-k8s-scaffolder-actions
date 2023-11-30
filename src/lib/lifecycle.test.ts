import { kubeApply } from "./apply";
import { kubeDelete } from "./delete";

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
};

describe("creating and deleting resources", () => {
  beforeAll(async () => {
    const crd = require("./test/crd.yaml");
    await kubeApply(JSON.stringify(crd), logger);
  });

  afterAll(async () => {
    const crd = require("./test/crd.yaml");
    await kubeDelete(
      crd.apiVersion,
      crd.kind,
      crd.metadata.name,
      crd.metadata.namespace,
      logger
    );
  });

  it("should apply to create", async () => {
    const myresource = `{
            "apiVersion": "test.crd/v1alpha1",
            "kind": "mycr",
            "metadata": {
                "name": "test-mycr",
                "namespace": "default",
            },
            "spec": {
                "config": "important"
            }
        }`;
    const result = await kubeApply(myresource, logger);
    expect(result[0].metadata?.name).toEqual("test-mycr");
    expect(result[0].spec).toEqual({ config: "important" });
  });

  it("should apply a merge update on the resource", async () => {
    const updatedResource = `{
            "apiVersion": "test.crd/v1alpha1",
            "kind": "mycr",
            "metadata": {
                "name": "test-mycr",
                "namespace": "default",
                "labels": {
                    "new-label": "new-value"
                }
            },
            "spec": {
              "anotherConfig": "also-important"
            }
        }`;
    const updated = await kubeApply(updatedResource, logger);
    expect(updated[0].metadata?.labels?.["new-label"]).toEqual("new-value");
    expect(updated[0].spec).toEqual({
      config: "important",
      anotherConfig: "also-important",
    });
  });

  it("should delete the resource", async () => {
    const name = "test-mycr";
    const kind = "mycr";
    const apiVersion = "test.crd/v1alpha1";
    const namespace = "default";
    const deleted = await kubeDelete(apiVersion, kind, name, namespace, logger);
    expect(deleted.body.status).toEqual("Success");
  });
});
