import OpenAIApi from "openai";
import { getKey, hasKey } from "../utils/keys";
import { strictFormat } from "../utils/text";

export class GPT {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.params = parameters;

    const config = {};
    if (url) {
      config.baseURL = url;
    }

    if (hasKey("OPENAI_ORG_ID")) {
      config.organization = getKey("OPENAI_ORG_ID");
    }

    config.apiKey = getKey("OPENAI_API_KEY");

    this.openai = new OpenAIApi(config);
  }

  async sendRequest(turns, systemMessage, stop_seq = "***") {
    const messages = [{ role: "system", content: systemMessage }, ...turns];

    const pack = {
      model: this.model_name || "gpt-3.5-turbo",
      messages,
      stop: stop_seq,
      ...this.params,
    };
    if (this.model_name.includes("o1")) {
      pack.messages = strictFormat(messages);
      delete pack.stop;
    }

    let response = null;

    try {
      console.log("Awaiting openai api response from model", this.model_name);
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
    if (text.length > 8191) {
      text = text.slice(0, 8191);
    }
    const embedding = await this.openai.embeddings.create({
      model: this.model_name || "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    });
    return embedding.data[0].embedding;
  }
}
