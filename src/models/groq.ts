import Groq from "groq-sdk";
import { getKey } from "../utils/keys";

// Umbrella class for Mixtral, LLama, Gemma...
export class GroqCloudAPI {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.url = url;
    this.params = parameters || {};
    // ReplicateAPI theft :3
    if (this.url) {
      console.warn(
        "Groq Cloud has no implementation for custom URLs. Ignoring provided URL.",
      );
    }
    this.groq = new Groq({ apiKey: getKey("GROQCLOUD_API_KEY") });
  }

  async sendRequest(turns, systemMessage, stop_seq = null) {
    const messages = [{ role: "system", content: systemMessage }, ...turns];
    let result = null;
    try {
      console.log("Awaiting Groq response...");
      if (!this.params.max_tokens) {
        this.params.max_tokens = 16_384;
      }
      const completion = await this.groq.chat.completions.create({
        messages: messages,
        model: this.model_name || "mixtral-8x7b-32768",
        stream: true,
        stop: stop_seq,
        ...this.params,
      });

      let temporaryResult = "";
      for await (const chunk of completion) {
        temporaryResult += chunk.choices[0]?.delta?.content || "";
      }

      result = temporaryResult;
    } catch (error) {
      console.log(error);
      result = "My brain just kinda stopped working. Try again.";
    }
    return result;
  }

  async embed(text) {
    throw new Error("Embeddings are not supported by Groq.");
  }
}
