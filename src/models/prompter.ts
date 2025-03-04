import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { Examples } from "../utils/examples";
import { getCommandDocumentation } from "../agent/commands/index";
import { getSkillDocumentation } from "../agent/library/index";
import { SkillLibrary } from "../agent/library/skill_library";
import { stringifyTurns } from "../utils/text";
import { getCommand } from "../agent/commands/index";
import settings from "../../settings";

import { Gemini } from "./gemini";
import { GPT } from "./gpt";
import { Claude } from "./claude";
import { Mistral } from "./mistral";
import { ReplicateAPI } from "./replicate";
import { Local } from "./local";
import { Novita } from "./novita";
import { GroqCloudAPI } from "./groq";
import { HuggingFace } from "./huggingface";
import { Qwen } from "./qwen";
import { Grok } from "./grok";
import { DeepSeek } from "./deepseek";
import { OpenRouter } from "./openrouter";

export class Prompter {
  constructor(agent, fp) {
    this.agent = agent;
    this.profile = JSON.parse(readFileSync(fp, "utf8"));
    const default_profile = JSON.parse(
      readFileSync("./profiles/defaults/_default.json", "utf8"),
    );
    const base_fp = settings.base_profile;
    const base_profile = JSON.parse(readFileSync(base_fp, "utf8"));

    // first use defaults to fill in missing values in the base profile
    for (const key in default_profile) {
      if (base_profile[key] === undefined) {
        base_profile[key] = default_profile[key];
      }
    }
    // then use base profile to fill in missing values in the individual profile
    for (const key in base_profile) {
      if (this.profile[key] === undefined) {
        this.profile[key] = base_profile[key];
      }
    }
    // base overrides default, individual overrides base

    this.convo_examples = null;
    this.coding_examples = null;

    const name = this.profile.name;
    this.cooldown = this.profile.cooldown || 0;
    this.last_prompt_time = 0;
    this.awaiting_coding = false;

    // try to get "max_tokens" parameter, else null
    let max_tokens = null;
    if (this.profile.max_tokens) {
      max_tokens = this.profile.max_tokens;
    }

    const chat_model_profile = this._selectAPI(this.profile.model);
    this.chat_model = this._createModel(chat_model_profile);

    if (this.profile.code_model) {
      const code_model_profile = this._selectAPI(this.profile.code_model);
      this.code_model = this._createModel(code_model_profile);
    } else {
      this.code_model = this.chat_model;
    }

    let embedding = this.profile.embedding;
    if (embedding === undefined) {
      embedding =
        chat_model_profile.api === "ollama"
          ? { api: "none" }
          : { api: chat_model_profile.api };
    } else if (typeof embedding === "string" || embedding instanceof String) {
      embedding = { api: embedding };
    }

    console.log("Using embedding settings:", embedding);

    try {
      switch (embedding.api) {
        case "google": {
          this.embedding_model = new Gemini(embedding.model, embedding.url);

          break;
        }
        case "openai": {
          this.embedding_model = new GPT(embedding.model, embedding.url);

          break;
        }
        case "replicate": {
          this.embedding_model = new ReplicateAPI(
            embedding.model,
            embedding.url,
          );

          break;
        }
        case "ollama": {
          this.embedding_model = new Local(embedding.model, embedding.url);

          break;
        }
        case "qwen": {
          this.embedding_model = new Qwen(embedding.model, embedding.url);

          break;
        }
        case "mistral": {
          this.embedding_model = new Mistral(embedding.model, embedding.url);

          break;
        }
        case "huggingface": {
          this.embedding_model = new HuggingFace(
            embedding.model,
            embedding.url,
          );

          break;
        }
        case "novita": {
          this.embedding_model = new Novita(embedding.model, embedding.url);

          break;
        }
        default: {
          this.embedding_model = null;
          const embedding_name = embedding ? embedding.api : "[NOT SPECIFIED]";
          console.warn(
            "Unsupported embedding: " +
              embedding_name +
              ". Using word-overlap instead, expect reduced performance. Recommend using a supported embedding model. See Readme.",
          );
        }
      }
    } catch (error) {
      console.warn(
        "Warning: Failed to initialize embedding model:",
        error.message,
      );
      console.log("Continuing anyway, using word-overlap instead.");
      this.embedding_model = null;
    }
    this.skill_library = new SkillLibrary(agent, this.embedding_model);
    mkdirSync(`./bots/${name}`, { recursive: true });
    writeFileSync(
      `./bots/${name}/last_profile.json`,
      JSON.stringify(this.profile, null, 4),
      (error) => {
        if (error) {
          throw new Error("Failed to save profile:", error);
        }
        console.log("Copy profile saved.");
      },
    );
  }

  _selectAPI(profile) {
    if (typeof profile === "string" || profile instanceof String) {
      profile = { model: profile };
    }
    if (!profile.api) {
      if (profile.model.includes("gemini")) {
        profile.api = "google";
      } else if (profile.model.includes("openrouter/")) {
        profile.api = "openrouter";
      } // must do before others bc shares model names
      else if (
        profile.model.includes("gpt") ||
        profile.model.includes("o1") ||
        profile.model.includes("o3")
      ) {
        profile.api = "openai";
      } else if (profile.model.includes("claude")) {
        profile.api = "anthropic";
      } else if (profile.model.includes("huggingface/")) {
        profile.api = "huggingface";
      } else if (profile.model.includes("replicate/")) {
        profile.api = "replicate";
      } else if (
        profile.model.includes("mistralai/") ||
        profile.model.includes("mistral/")
      ) {
        profile.api = "mistral";
      } else if (
        profile.model.includes("groq/") ||
        profile.model.includes("groqcloud/")
      ) {
        profile.api = "groq";
      } else if (profile.model.includes("novita/")) {
        profile.api = "novita";
      } else if (profile.model.includes("qwen")) {
        profile.api = "qwen";
      } else if (profile.model.includes("grok")) {
        profile.api = "xai";
      } else if (profile.model.includes("deepseek")) {
        profile.api = "deepseek";
      } else if (profile.model.includes("llama3")) {
        profile.api = "ollama";
      } else {
        throw new Error("Unknown model:", profile.model);
      }
    }
    return profile;
  }

  _createModel(profile) {
    let model = null;
    switch (profile.api) {
      case "google": {
        model = new Gemini(profile.model, profile.url, profile.params);

        break;
      }
      case "openai": {
        model = new GPT(profile.model, profile.url, profile.params);

        break;
      }
      case "anthropic": {
        model = new Claude(profile.model, profile.url, profile.params);

        break;
      }
      case "replicate": {
        model = new ReplicateAPI(
          profile.model.replace("replicate/", ""),
          profile.url,
          profile.params,
        );

        break;
      }
      case "ollama": {
        model = new Local(profile.model, profile.url, profile.params);

        break;
      }
      case "mistral": {
        model = new Mistral(profile.model, profile.url, profile.params);

        break;
      }
      case "groq": {
        model = new GroqCloudAPI(
          profile.model.replace("groq/", "").replace("groqcloud/", ""),
          profile.url,
          profile.params,
        );

        break;
      }
      case "huggingface": {
        model = new HuggingFace(profile.model, profile.url, profile.params);

        break;
      }
      case "novita": {
        model = new Novita(
          profile.model.replace("novita/", ""),
          profile.url,
          profile.params,
        );

        break;
      }
      case "qwen": {
        model = new Qwen(profile.model, profile.url, profile.params);

        break;
      }
      case "xai": {
        model = new Grok(profile.model, profile.url, profile.params);

        break;
      }
      case "deepseek": {
        model = new DeepSeek(profile.model, profile.url, profile.params);

        break;
      }
      case "openrouter": {
        model = new OpenRouter(
          profile.model.replace("openrouter/", ""),
          profile.url,
          profile.params,
        );

        break;
      }
      default: {
        throw new Error("Unknown API:", profile.api);
      }
    }
    return model;
  }

  getName() {
    return this.profile.name;
  }

  getInitModes() {
    return this.profile.modes;
  }

  async initExamples() {
    try {
      this.convo_examples = new Examples(
        this.embedding_model,
        settings.num_examples,
      );
      this.coding_examples = new Examples(
        this.embedding_model,
        settings.num_examples,
      );

      // Wait for both examples to load before proceeding
      await Promise.all([
        this.convo_examples.load(this.profile.conversation_examples),
        this.coding_examples.load(this.profile.coding_examples),
        this.skill_library.initSkillLibrary(),
      ]).catch((error) => {
        // Preserve error details
        console.error("Failed to initialize examples. Error details:", error);
        console.error("Stack trace:", error.stack);
        throw error;
      });

      console.log("Examples initialized.");
    } catch (error) {
      console.error("Failed to initialize examples:", error);
      console.error("Stack trace:", error.stack);
      throw error; // Re-throw with preserved details
    }
  }

  async replaceStrings(
    prompt,
    messages,
    examples = null,
    to_summarize = [],
    last_goals = null,
  ) {
    prompt = prompt.replaceAll("$NAME", this.agent.name);

    if (prompt.includes("$STATS")) {
      const stats = await getCommand("!stats").perform(this.agent);
      prompt = prompt.replaceAll("$STATS", stats);
    }
    if (prompt.includes("$INVENTORY")) {
      const inventory = await getCommand("!inventory").perform(this.agent);
      prompt = prompt.replaceAll("$INVENTORY", inventory);
    }
    if (prompt.includes("$ACTION")) {
      prompt = prompt.replaceAll(
        "$ACTION",
        this.agent.actions.currentActionLabel,
      );
    }
    if (prompt.includes("$COMMAND_DOCS")) {
      prompt = prompt.replaceAll("$COMMAND_DOCS", getCommandDocumentation());
    }
    if (prompt.includes("$CODE_DOCS")) {
      const code_task_content =
        [...messages]
          .reverse()
          .find(
            (message) =>
              message.role !== "system" &&
              message.content.includes("!newAction("),
          )
          ?.content?.match(/!newAction\((.*?)\)/)?.[1] || "";

      prompt = prompt.replaceAll(
        "$CODE_DOCS",
        await this.skill_library.getRelevantSkillDocs(
          code_task_content,
          settings.relevant_docs_count,
        ),
      );
    }
    prompt = prompt.replaceAll("$COMMAND_DOCS", getCommandDocumentation());
    if (prompt.includes("$CODE_DOCS")) {
      prompt = prompt.replaceAll("$CODE_DOCS", getSkillDocumentation());
    }
    if (prompt.includes("$EXAMPLES") && examples !== null) {
      prompt = prompt.replaceAll(
        "$EXAMPLES",
        await examples.createExampleMessage(messages),
      );
    }
    if (prompt.includes("$MEMORY")) {
      prompt = prompt.replaceAll("$MEMORY", this.agent.history.memory);
    }
    if (prompt.includes("$TO_SUMMARIZE")) {
      prompt = prompt.replaceAll("$TO_SUMMARIZE", stringifyTurns(to_summarize));
    }
    if (prompt.includes("$CONVO")) {
      prompt = prompt.replaceAll(
        "$CONVO",
        "Recent conversation:\n" + stringifyTurns(messages),
      );
    }
    if (prompt.includes("$SELF_PROMPT")) {
      // if active or paused, show the current goal
      const self_prompt = this.agent.self_prompter.isStopped()
        ? ""
        : `YOUR CURRENT ASSIGNED GOAL: "${this.agent.self_prompter.prompt}"\n`;
      prompt = prompt.replaceAll("$SELF_PROMPT", self_prompt);
    }
    if (prompt.includes("$LAST_GOALS")) {
      let goal_text = "";
      for (const goal in last_goals) {
        goal_text += last_goals[goal]
          ? `You recently successfully completed the goal ${goal}.\n`
          : `You recently failed to complete the goal ${goal}.\n`;
      }
      prompt = prompt.replaceAll("$LAST_GOALS", goal_text.trim());
    }
    if (prompt.includes("$BLUEPRINTS") && this.agent.npc.constructions) {
      let blueprints = "";
      for (const blueprint in this.agent.npc.constructions) {
        blueprints += blueprint + ", ";
      }
      prompt = prompt.replaceAll("$BLUEPRINTS", blueprints.slice(0, -2));
    }

    // check if there are any remaining placeholders with syntax $<word>
    const remaining = prompt.match(/\$[A-Z_]+/g);
    if (remaining !== null) {
      console.warn("Unknown prompt placeholders:", remaining.join(", "));
    }
    return prompt;
  }

  async checkCooldown() {
    const elapsed = Date.now() - this.last_prompt_time;
    if (elapsed < this.cooldown && this.cooldown > 0) {
      await new Promise((r) => setTimeout(r, this.cooldown - elapsed));
    }
    this.last_prompt_time = Date.now();
  }

  async promptConvo(messages) {
    this.most_recent_msg_time = Date.now();
    const current_message_time = this.most_recent_msg_time;
    for (let index = 0; index < 3; index++) {
      // try 3 times to avoid hallucinations
      await this.checkCooldown();
      if (current_message_time !== this.most_recent_msg_time) {
        return "";
      }
      let prompt = this.profile.conversing;
      prompt = await this.replaceStrings(prompt, messages, this.convo_examples);
      const generation = await this.chat_model.sendRequest(messages, prompt);
      // in conversations >2 players LLMs tend to hallucinate and role-play as other bots
      // the FROM OTHER BOT tag should never be generated by the LLM
      if (generation.includes("(FROM OTHER BOT)")) {
        console.warn(
          "LLM hallucinated message as another bot. Trying again...",
        );
        continue;
      }
      if (current_message_time !== this.most_recent_msg_time) {
        console.warn(
          this.agent.name +
            " received new message while generating, discarding old response.",
        );
        return "";
      }
      return generation;
    }
    return "";
  }

  async promptCoding(messages) {
    if (this.awaiting_coding) {
      console.warn("Already awaiting coding response, returning no response.");
      return "```//no response```";
    }
    this.awaiting_coding = true;
    await this.checkCooldown();
    let prompt = this.profile.coding;
    prompt = await this.replaceStrings(prompt, messages, this.coding_examples);
    const resp = await this.code_model.sendRequest(messages, prompt);
    this.awaiting_coding = false;
    return resp;
  }

  async promptMemSaving(to_summarize) {
    await this.checkCooldown();
    let prompt = this.profile.saving_memory;
    prompt = await this.replaceStrings(prompt, null, null, to_summarize);
    return await this.chat_model.sendRequest([], prompt);
  }

  async promptShouldRespondToBot(new_message) {
    await this.checkCooldown();
    let prompt = this.profile.bot_responder;
    const messages = this.agent.history.getHistory();
    messages.push({ role: "user", content: new_message });
    prompt = await this.replaceStrings(prompt, null, null, messages);
    const response = await this.chat_model.sendRequest([], prompt);
    return response.trim().toLowerCase() === "respond";
  }

  async promptGoalSetting(messages, last_goals) {
    let system_message = this.profile.goal_setting;
    system_message = await this.replaceStrings(system_message, messages);

    let user_message =
      "Use the below info to determine what goal to target next\n\n";
    user_message += "$LAST_GOALS\n$STATS\n$INVENTORY\n$CONVO";
    user_message = await this.replaceStrings(
      user_message,
      messages,
      null,
      null,
      last_goals,
    );
    const user_messages = [{ role: "user", content: user_message }];

    const response = await this.chat_model.sendRequest(
      user_messages,
      system_message,
    );

    let goal = null;
    try {
      const data = response.split("```")[1].replace("json", "").trim();
      goal = JSON.parse(data);
    } catch (error) {
      console.log("Failed to parse goal:", response, error);
    }
    if (
      !goal ||
      !goal.name ||
      !goal.quantity ||
      Number.isNaN(Number.parseInt(goal.quantity))
    ) {
      console.log("Failed to set goal:", response);
      return null;
    }
    goal.quantity = Number.parseInt(goal.quantity);
    return goal;
  }
}
