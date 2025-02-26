import Anthropic from "@anthropic-ai/sdk";
import { strictFormat } from "../utils/text.js";
import { getKey } from "../utils/keys.js";

export class Claude {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.params = parameters || {};

    const config = {};
    if (url) {
      config.baseURL = url;
    }

    config.apiKey = getKey("ANTHROPIC_API_KEY");

    this.anthropic = new Anthropic(config);
  }

  async sendRequest(turns, systemMessage) {
    const messages = strictFormat(turns);
    let result = null;
    try {
      console.log("Awaiting anthropic api response...");
      if (!this.params.max_tokens) {
        this.params.max_tokens = 4096;
      }
      const resp = await this.anthropic.messages.create({
        model: this.model_name || "claude-3-sonnet-20240229",
        system: systemMessage,
        messages: messages,
        ...this.params,
      });

      console.log("Received.");
      result = resp.content[0].text;
    } catch (error) {
      console.log(error);
      result = "My brain disconnected, try again.";
    }
    return result;
  }

  async embed(text) {
    throw new Error("Embeddings are not supported by Claude.");
  }
}
