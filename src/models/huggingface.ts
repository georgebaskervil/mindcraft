import { toSinglePrompt } from "../utils/text";
import { getKey } from "../utils/keys";
import { HfInference } from "@huggingface/inference";

export class HuggingFace {
  constructor(model_name, url, parameters) {
    this.model_name = model_name.replace("huggingface/", "");
    this.url = url;
    this.params = parameters;

    if (this.url) {
      console.warn("Hugging Face doesn't support custom urls!");
    }

    this.huggingface = new HfInference(getKey("HUGGINGFACE_API_KEY"));
  }

  async sendRequest(turns, systemMessage) {
    const stop_seq = "***";
    const prompt = toSinglePrompt(turns, null, stop_seq);
    const model_name = this.model_name || "meta-llama/Meta-Llama-3-8B";

    const input = systemMessage + "\n" + prompt;
    let response = "";
    try {
      console.log("Awaiting Hugging Face API response...");
      for await (const chunk of this.huggingface.chatCompletionStream({
        model: model_name,
        messages: [{ role: "user", content: input }],
        ...this.params,
      })) {
        response += chunk.choices[0]?.delta?.content || "";
      }
    } catch (error) {
      console.log(error);
      response = "My brain disconnected, try again.";
    }
    console.log("Received.");
    console.log(response);
    return response;
  }

  async embed(text) {
    throw new Error("Embeddings are not supported by HuggingFace.");
  }
}
