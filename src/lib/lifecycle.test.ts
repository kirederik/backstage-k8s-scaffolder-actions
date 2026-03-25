
import { kubeApply } from "./apply";
import { kubeDelete } from "./delete";

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
};

const mockRead = jest.fn().mockImplementation(async (spec: any) => ({ body: spec }));
const mockCreate = jest.fn().mockImplementation(async (spec: any) => ({ body: spec }));
const mockPatch = jest.fn().mockImplementation(async (spec: any) => ({ body: spec }));
const mockDelete = jest.fn().mockImplementation(async () => ({ body: { status: "Success" } }));

jest.mock("@kubernetes/client-node", () => {
  const actual = jest.requireActual("@kubernetes/client-node");
  const mClient = {
    read: (...args: any[]) => (mockRead as jest.Mock)(...args),
    create: (...args: any[]) => (mockCreate as jest.Mock)(...args),
    patch: (...args: any[]) => (mockPatch as jest.Mock)(...args),
    delete: (...args: any[]) => (mockDelete as jest.Mock)(...args),
  };
  return {
    ...actual,
    KubeConfig: jest.fn().mockImplementation(() => ({
      loadFromDefault: jest.fn(),
      makeApiClient: jest.fn().mockReturnValue(mClient),
    })),
    KubernetesObjectApi: {
      makeApiClient: jest.fn().mockReturnValue(mClient),
    },
  };
});

describe("creating and deleting resources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    const crd = require("./test/crd.yaml");
    // CRD create flow: read fails -> create
    mockRead.mockRejectedValueOnce(new Error("Not Found"));
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
                "namespace": "default"
            },
            "spec": {
                "config": "important"
            }
        }`;
    // Read fails -> create
    mockRead.mockRejectedValueOnce(new Error("Not Found"));
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
    // Read succeeds -> patch
    mockPatch.mockResolvedValueOnce({
      body: {
        metadata: { name: "test-mycr", labels: { "new-label": "new-value" } },
        spec: { config: "important", anotherConfig: "also-important" },
      },
    });
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
