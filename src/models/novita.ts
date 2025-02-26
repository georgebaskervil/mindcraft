import OpenAIApi from "openai";
import { getKey } from "../utils/keys";
import { strictFormat } from "../utils/text";

// llama, mistral
export class Novita {
  constructor(model_name, url, parameters) {
    this.model_name = model_name.replace("novita/", "");
    this.url = url || "https://api.novita.ai/v3/openai";
    this.params = parameters;

    const config = {
      baseURL: this.url,
    };
    config.apiKey = getKey("NOVITA_API_KEY");

    this.openai = new OpenAIApi(config);
  }

  async sendRequest(turns, systemMessage, stop_seq = "***") {
    let messages = [{ role: "system", content: systemMessage }, ...turns];

    messages = strictFormat(messages);
    messages = [...messages, ...turns];

    const pack = {
      model: this.model_name || "meta-llama/llama-3.1-70b-instruct",
      messages,
      stop: [stop_seq],
      ...this.params,
    };

    let response = null;
    try {
      console.log("Awaiting novita api response...");
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
        // eslint-disable-next-line no-undef
        return await sendRequest(turns.slice(1), systemMessage, stop_seq);
      } else {
        console.log(error);
        response = "My brain disconnected, try again.";
      }
    }
    if (response.includes("<think>")) {
      const start = response.indexOf("<think>");
      const end = response.indexOf("</think>") + 8;
      if (start != -1) {
        response =
          end == -1
            ? response.slice(0, Math.max(0, start + 7))
            : response.slice(0, Math.max(0, start)) +
              response.slice(Math.max(0, end));
      }
      response = response.trim();
    }
    return response;
  }

  async embed(text) {
    throw new Error("Embeddings are not supported by Novita AI.");
  }
}
