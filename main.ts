import { AgentProcess } from "./src/process/agent_process.js";
import settings from "./settings.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createMindServer } from "./src/server/mind_server.js";
import { mainProxy } from "./src/process/main_proxy.js";
import { readFileSync } from "node:fs";

function parseArguments() {
  return yargs(hideBin(process.argv))
    .option("profiles", {
      type: "array",
      describe: "List of agent profile paths",
    })
    .option("task_path", {
      type: "string",
      describe: "Path to task file to execute",
    })
    .option("task_id", {
      type: "string",
      describe: "Task ID to execute",
    })
    .help()
    .alias("help", "h")
    .parse();
}

function getProfiles(arguments_) {
  return arguments_.profiles || settings.profiles;
}

try {
  if (settings.host_mindserver) {
    const mindServer = createMindServer(settings.mindserver_port);
  }
  mainProxy.connect();

  const arguments_ = parseArguments();
  const profiles = getProfiles(arguments_);
  console.log(profiles);
  const { load_memory, init_message } = settings;

  for (const [index, profile_] of profiles.entries()) {
    const agent_process = new AgentProcess();
    const profile = readFileSync(profile_, "utf8");
    const agent_json = JSON.parse(profile);
    mainProxy.registerAgent(agent_json.name, agent_process);
    agent_process.start(
      profile_,
      load_memory,
      init_message,
      index,
      arguments_.task_path,
      arguments_.task_id,
    );
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
} catch (error) {
  console.error("An error occurred:", error);
  process.exit(1);
}
