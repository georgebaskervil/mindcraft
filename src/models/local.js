import { strictFormat } from "../utils/text.js";

export class Local {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.params = parameters;
    this.url = url || "http://127.0.0.1:11434";
    this.chat_endpoint = "/api/chat";
    this.embedding_endpoint = "/api/embeddings";
  }

  async sendRequest(turns, systemMessage) {
    let model = this.model_name || "llama3";
    let messages = strictFormat(turns);
    messages.unshift({ role: "system", content: systemMessage });
    let response = null;
    try {
      console.log(`Awaiting local response... (model: ${model})`);
      response = await this.send(this.chat_endpoint, {
        model: model,
        messages: messages,
        stream: false,
        ...this.params,
      });
      if (response) {
        response = response["message"]["content"];
      }
    } catch (error) {
      if (
        error.message.toLowerCase().includes("context length") &&
        turns.length > 1
      ) {
        console.log(
          "Context length exceeded, trying again with shorter context.",
        );
        return await this.sendRequest(turns.slice(1), systemMessage);
      } else {
        console.log(error);
        response = "My brain disconnected, try again.";
      }
    }
    return response;
  }

  async embed(text) {
    let model = this.model_name || "nomic-embed-text";
    let body = { model: model, prompt: text };
    let response = await this.send(this.embedding_endpoint, body);
    return response["embedding"];
  }

  async send(endpoint, body) {
    const url = new URL(endpoint, this.url);
    let method = "POST";
    let headers = new Headers();
    const request = new Request(url, {
      method,
      headers,
      body: JSON.stringify(body),
    });
    let data = null;
    try {
      const response = await fetch(request);
      if (response.ok) {
        data = await response.json();
      } else {
        throw new Error(`Ollama Status: ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to send Ollama request.");
      console.error(error);
    }
    return data;
  }
}
