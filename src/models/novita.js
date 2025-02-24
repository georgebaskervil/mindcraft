import OpenAIApi from "openai";
import { getKey } from "../utils/keys.js";
import { strictFormat } from "../utils/text.js";

// llama, mistral
export class Novita {
  constructor(model_name, url, parameters) {
    this.model_name = model_name.replace("novita/", "");
    this.url = url || "https://api.novita.ai/v3/openai";
    this.params = parameters;

    let config = {
      baseURL: this.url,
    };
    config.apiKey = getKey("NOVITA_API_KEY");

    this.openai = new OpenAIApi(config);
  }

  async sendRequest(turns, systemMessage, stop_seq = "***") {
    let messages = [{ role: "system", content: systemMessage }].concat(turns);

    messages = strictFormat(messages);

    const pack = {
      model: this.model_name || "meta-llama/llama-3.1-70b-instruct",
      messages,
      stop: [stop_seq],
      ...this.params,
    };

    let res = null;
    try {
      console.log("Awaiting novita api response...");
      let completion = await this.openai.chat.completions.create(pack);
      if (completion.choices[0].finish_reason == "length") {
        throw new Error("Context length exceeded");
      }
      console.log("Received.");
      res = completion.choices[0].message.content;
    } catch (error) {
      if (
        (error.message == "Context length exceeded" ||
          error.code == "context_length_exceeded") &&
        turns.length > 1
      ) {
        console.log(
          "Context length exceeded, trying again with shorter context.",
        );
        return await sendRequest(turns.slice(1), systemMessage, stop_seq);
      } else {
        console.log(error);
        res = "My brain disconnected, try again.";
      }
    }
    if (res.includes("<think>")) {
      let start = res.indexOf("<think>");
      let end = res.indexOf("</think>") + 8;
      if (start != -1) {
        res = end == -1 ? res.slice(0, Math.max(0, start + 7)) : res.slice(0, Math.max(0, start)) + res.slice(Math.max(0, end));
      }
      res = res.trim();
    }
    return res;
  }

  async embed(text) {
    throw new Error("Embeddings are not supported by Novita AI.");
  }
}
