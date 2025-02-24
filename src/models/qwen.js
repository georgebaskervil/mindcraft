import OpenAIApi from "openai";
import { getKey, hasKey } from "../utils/keys.js";
import { strictFormat } from "../utils/text.js";

export class Qwen {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.params = parameters;
    let config = {};

    config.baseURL = url || "https://dashscope.aliyuncs.com/compatible-mode/v1";
    config.apiKey = getKey("QWEN_API_KEY");

    this.openai = new OpenAIApi(config);
  }

  async sendRequest(turns, systemMessage, stop_seq = "***") {
    let baseMessages = [{ role: "system", content: systemMessage }];
    let contextMessages = turns;

    let messages = [...baseMessages, ...contextMessages];

    messages = strictFormat(messages);

    const pack = {
      model: this.model_name || "qwen-plus",
      messages,
      stop: stop_seq,
      ...this.params,
    };

    let response = null;
    try {
      console.log("Awaiting Qwen api response...");
      // console.log('Messages:', messages);
      let completion = await this.openai.chat.completions.create(pack);
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

  // Why random backoff?
  // With a 30 requests/second limit on Alibaba Qwen's embedding service,
  // random backoff helps maximize bandwidth utilization.
  async embed(text) {
    const maxRetries = 5; // Maximum number of retries
    for (let retries = 0; retries < maxRetries; retries++) {
      try {
        const { data } = await this.openai.embeddings.create({
          model: this.model_name || "text-embedding-v3",
          input: text,
          encoding_format: "float",
        });
        return data[0].embedding;
      } catch (error) {
        if (error.status === 429) {
          // If a rate limit error occurs, calculate the exponential backoff with a random delay (1-5 seconds)
          const delay =
            Math.pow(2, retries) * 1000 + Math.floor(Math.random() * 2000);
          // console.log(`Rate limit hit, retrying in ${delay} ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay)); // Wait for the delay before retrying
        } else {
          throw error;
        }
      }
    }
    // If maximum retries are reached and the request still fails, throw an error
    throw new Error("Max retries reached, request failed.");
  }
}
