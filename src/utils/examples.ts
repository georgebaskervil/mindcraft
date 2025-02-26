import { cosineSimilarity } from "./math";
import { stringifyTurns, wordOverlapScore } from "./text";

export class Examples {
  constructor(model, select_number = 2) {
    this.examples = [];
    this.model = model;
    this.select_num = select_number;
    this.embeddings = {};
  }

  turnsToText(turns) {
    let messages = "";
    for (const turn of turns) {
      if (turn.role !== "assistant") {
        messages +=
          turn.content
            .slice(Math.max(0, turn.content.indexOf(":") + 1))
            .trim() + "\n";
      }
    }
    return messages.trim();
  }

  async load(examples) {
    this.examples = examples;
    if (!this.model) {
      return;
    } // Early return if no embedding model

    if (this.select_num === 0) {
      return;
    }

    try {
      // Create array of promises first
      const embeddingPromises = examples.map((example) => {
        const turn_text = this.turnsToText(example);
        return this.model.embed(turn_text).then((embedding) => {
          this.embeddings[turn_text] = embedding;
        });
      });

      // Wait for all embeddings to complete
      await Promise.all(embeddingPromises);
    } catch {
      console.warn("Error with embedding model, using word-overlap instead.");
      this.model = null;
    }
  }

  async getRelevant(turns) {
    if (this.select_num === 0) {
      return [];
    }

    const turn_text = this.turnsToText(turns);
    if (this.model === null) {
      this.examples.sort(
        (a, b) =>
          wordOverlapScore(turn_text, this.turnsToText(b)) -
          wordOverlapScore(turn_text, this.turnsToText(a)),
      );
    } else {
      const embedding = await this.model.embed(turn_text);
      this.examples.sort(
        (a, b) =>
          cosineSimilarity(embedding, this.embeddings[this.turnsToText(b)]) -
          cosineSimilarity(embedding, this.embeddings[this.turnsToText(a)]),
      );
    }
    const selected = this.examples.slice(0, this.select_num);
    const clone = structuredClone(selected);
    return clone; // deep copy
  }

  async createExampleMessage(turns) {
    const selected_examples = await this.getRelevant(turns);

    console.log("selected examples:");
    for (const example of selected_examples) {
      console.log("Example:", example[0].content);
    }

    let message = "Examples of how to respond:\n";
    for (const [index, example] of selected_examples.entries()) {
      message += `Example ${index + 1}:\n${stringifyTurns(example)}\n\n`;
    }
    return message;
  }
}
