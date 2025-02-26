import { strictFormat } from "../utils/text";

export class Local {
  constructor(model_name, url, parameters) {
    this.model_name = model_name;
    this.params = parameters;
    this.url = url || "http://127.0.0.1:11434";
    this.chat_endpoint = "/api/chat";
    this.embedding_endpoint = "/api/embeddings";
  }

  async sendRequest(turns, systemMessage) {
    const model = this.model_name || "llama3";
    const messages = strictFormat(turns);
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
    const model = this.model_name || "nomic-embed-text";
    const body = { model: model, prompt: text };
    const response = await this.send(this.embedding_endpoint, body);
    return response["embedding"];
  }

  async send(endpoint, body) {
    const url = new URL(endpoint, this.url);
    const method = "POST";
    const headers = new Headers();
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
