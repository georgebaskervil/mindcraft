import { cosineSimilarity } from "../../utils/math.js";
import { getSkillDocs } from "./index.js";
import { wordOverlapScore } from "../../utils/text.js";

export class SkillLibrary {
  constructor(agent, embedding_model) {
    this.agent = agent;
    this.embedding_model = embedding_model;
    this.skill_docs_embeddings = {};
    this.skill_docs = null;
  }
  async initSkillLibrary() {
    const skillDocs = getSkillDocs();
    this.skill_docs = skillDocs;
    if (this.embedding_model) {
      try {
        const embeddingPromises = skillDocs.map((document) => {
          return (async () => {
            let function_name_desc = document.split("\n").slice(0, 2).join("");
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
      let latest_message_embedding = "";
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
          similarity_score: wordOverlapScore(message, this.skill_docs[document_key]),
        }))
        .sort((a, b) => b.similarity_score - a.similarity_score);
    }

    let length = skill_document_similarities.length;
    select_number = typeof select_number !== "number" || isNaN(select_number) || select_number < 0 ? length : Math.min(Math.floor(select_number), length);
    let selected_docs = skill_document_similarities.slice(0, select_number);
    let relevant_skill_docs =
      "#### RELEVANT DOCS INFO ###\nThe following functions are listed in descending order of relevance.\n";
    relevant_skill_docs += "SkillDocs:\n";
    relevant_skill_docs += selected_docs
      .map((document) => `${document.doc_key}`)
      .join("\n### ");
    return relevant_skill_docs;
  }
}
