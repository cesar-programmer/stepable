import { spawnSync } from "node:child_process";

const networkName = "stepable-local";
const inspect = spawnSync("docker", ["network", "inspect", networkName], {
  stdio: "ignore",
});

if (inspect.status === 0) {
  process.exit(0);
}

const create = spawnSync(
  "docker",
  [
    "network",
    "create",
    "-o",
    "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
    networkName,
  ],
  { stdio: "inherit" },
);

if (create.status !== 0) {
  process.exit(create.status ?? 1);
}
