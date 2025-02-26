import OpenAIApi from "openai";
import { getKey, hasKey } from "../utils/keys.js";
import { strictFormat } from "../utils/text.js";

export class DeepSeek {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.params = parameters;

    const config = {};

    config.baseURL = url || "https://api.deepseek.com";
    config.apiKey = getKey("DEEPSEEK_API_KEY");

    this.openai = new OpenAIApi(config);
  }

  async sendRequest(turns, systemMessage, stop_seq = "***") {
    let messages = [{ role: "system", content: systemMessage }, ...turns];

    messages = strictFormat(messages);

    const pack = {
      model: this.model_name || "deepseek-chat",
      messages,
      stop: stop_seq,
      ...this.params,
    };

    let response = null;
    try {
      console.log("Awaiting deepseek api response...");
      // console.log('Messages:', messages);
      const completion = await this.openai.chat.completions.create(pack);
      if (completion.choices[0].finish_reason == "length") {
        throw new Error("Context length exceeded");
      }
      console.log("Received.");
      response = completion.choices[0].message.content;
    } catch (error) {
      if (
        (error.message == "Context length exceeded" ||
          error.code == "context_length_exceeded") &&
        turns.length > 1
      ) {
        console.log(
          "Context length exceeded, trying again with shorter context.",
        );
        return await this.sendRequest(turns.slice(1), systemMessage, stop_seq);
      } else {
        console.log(error);
        response = "My brain disconnected, try again.";
      }
    }
    return response;
  }

  async embed(text) {
    throw new Error("Embeddings are not supported by Deepseek.");
  }
}
