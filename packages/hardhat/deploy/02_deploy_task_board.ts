import { artifacts, deployScript } from "../rocketh/deploy.js";

export default deployScript(
  async env => {
    await env.deploy("TaskBoard", {
      account: env.namedAccounts.deployer,
      artifact: artifacts.TaskBoard,
      args: [],
    });
  },
  { tags: ["TaskBoard"] },
);
