export function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (const [index, element] of a.entries()) {
    dotProduct += element * b[index]; // calculate dot product
    magnitudeA += Math.pow(element, 2); // calculate magnitude of a
    magnitudeB += Math.pow(b[index], 2); // calculate magnitude of b
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  return dotProduct / (magnitudeA * magnitudeB); // calculate cosine similarity
}
