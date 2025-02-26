import { cosineSimilarity } from "../../utils/math.js";
import { getSkillDocumentation } from "./index.js";
import { wordOverlapScore } from "../../utils/text.js";

export class SkillLibrary {
  constructor(agent, embedding_model) {
    this.agent = agent;
    this.embedding_model = embedding_model;
    this.skill_docs_embeddings = {};
    this.skill_docs = null;
  }
  async initSkillLibrary() {
    const skillDocumentation = getSkillDocumentation();
    this.skill_docs = skillDocumentation;
    if (this.embedding_model) {
      try {
        const embeddingPromises = skillDocumentation.map((document) => {
          return (async () => {
            const function_name_desc = document
              .split("\n")
              .slice(0, 2)
              .join("");
            this.skill_docs_embeddings[document] =
              await this.embedding_model.embed(function_name_desc);
          })();
        });
        await Promise.all(embeddingPromises);
      } catch {
        console.warn("Error with embedding model, using word-overlap instead.");
        this.embedding_model = null;
      }
    }
  }

  async getAllSkillDocs() {
    return this.skill_docs;
  }

  async getRelevantSkillDocs(message, select_number) {
    if (!message) {
      // use filler message if none is provided
      message = "(no message)";
    }
    let skill_document_similarities = [];
    if (this.embedding_model) {
      const latest_message_embedding = "";
      skill_document_similarities = Object.keys(this.skill_docs_embeddings)
        .map((document_key) => ({
          doc_key: document_key,
          similarity_score: cosineSimilarity(
            latest_message_embedding,
            this.skill_docs_embeddings[document_key],
          ),
        }))
        .sort((a, b) => b.similarity_score - a.similarity_score);
    } else {
      skill_document_similarities = Object.keys(this.skill_docs)
        .map((document_key) => ({
          doc_key: document_key,
          similarity_score: wordOverlapScore(
            message,
            this.skill_docs[document_key],
          ),
        }))
        .sort((a, b) => b.similarity_score - a.similarity_score);
    }

    const length = skill_document_similarities.length;
    select_number =
      typeof select_number !== "number" ||
      Number.isNaN(select_number) ||
      select_number < 0
        ? length
        : Math.min(Math.floor(select_number), length);
    const selectedDocuments = skill_document_similarities.slice(
      0,
      select_number,
    );
    let relevantSkillDocumentation =
      "#### RELEVANT DOCS INFO ###\nThe following functions are listed in descending order of relevance.\n";
    relevantSkillDocumentation += "SkillDocs:\n";
    relevantSkillDocumentation += selectedDocuments
      .map((document) => `${document.doc_key}`)
      .join("\n### ");
    return relevantSkillDocumentation;
  }
}
