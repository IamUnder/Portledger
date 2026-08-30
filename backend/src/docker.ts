import Docker from "dockerode";

export const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function findContainer(name: string) {
  const containers = await docker.listContainers({ all: true });
  const match = containers.find((c) => c.Names.some((n) => n === `/${name}`));
  return match ? docker.getContainer(match.Id) : null;
}

export async function containerStatus(name: string): Promise<string> {
  const container = await findContainer(name);
  if (!container) return "missing";
  const info = await container.inspect();
  return info.State.Status; // running | exited | restarting | ...
}
