import Replicate from "replicate";
import { toSinglePrompt } from "../utils/text";
import { getKey } from "../utils/keys";

// llama, mistral
export class ReplicateAPI {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.url = url;
    this.params = parameters;

    if (this.url) {
      console.warn(
        "Replicate API does not support custom URLs. Ignoring provided URL.",
      );
    }

    this.replicate = new Replicate({
      auth: getKey("REPLICATE_API_KEY"),
    });
  }

  async sendRequest(turns, systemMessage) {
    const stop_seq = "***";
    const prompt = toSinglePrompt(turns, null, stop_seq);
    const model_name = this.model_name || "meta/meta-llama-3-70b-instruct";

    const input = {
      prompt,
      system_prompt: systemMessage,
      ...this.params,
    };
    let response = null;
    try {
      console.log("Awaiting Replicate API response...");
      let result = "";
      for await (const event of this.replicate.stream(model_name, { input })) {
        result += event;
        if (result === "") {
          break;
        }
        if (result.includes(stop_seq)) {
          result = result.slice(0, result.indexOf(stop_seq));
          break;
        }
      }
      response = result;
    } catch (error) {
      console.log(error);
      response = "My brain disconnected, try again.";
    }
    console.log("Received.");
    return response;
  }

  async embed(text) {
    const output = await this.replicate.run(
      this.model_name ||
        "mark3labs/embeddings-gte-base:d619cff29338b9a37c3d06605042e1ff0594a8c3eff0175fd6967f5643fc4d47",
      { input: { text } },
    );
    return output.vectors;
  }
}
