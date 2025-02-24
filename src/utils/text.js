export function stringifyTurns(turns) {
  let result = "";
  for (let turn of turns) {
    if (turn.role === "assistant") {
      result += `\nYour output:\n${turn.content}`;
    } else if (turn.role === "system") {
      result += `\nSystem output: ${turn.content}`;
    } else {
      result += `\nUser input: ${turn.content}`;
    }
  }
  return result.trim();
}

export function toSinglePrompt(
  turns,
  system = null,
  stop_seq = "***",
  model_nickname = "assistant",
) {
  let prompt = system ? `${system}${stop_seq}` : "";
  let role = "";
  for (const message of turns) {
    role = message.role;
    if (role === "assistant") {
      role = model_nickname;
    }
    prompt += `${role}: ${message.content}${stop_seq}`;
  }
  if (role !== model_nickname) {
    // if the last message was from the user/system, add a prompt for the model. otherwise, pretend we are extending the model's own message
    prompt += model_nickname + ": ";
  }
  return prompt;
}

function _getWords(text) {
  return text
    .replaceAll(/[^a-zA-Z ]/g, "")
    .toLowerCase()
    .split(" ");
}

export function wordOverlapScore(text1, text2) {
  const words1 = _getWords(text1);
  const words2 = _getWords(text2);
  const intersection = words1.filter((word) => words2.includes(word));
  return (
    intersection.length / (words1.length + words2.length - intersection.length)
  );
}

// ensures stricter turn order and roles:
// - system messages are treated as user messages and prefixed with SYSTEM:
// - combines repeated messages from users
// - separates repeat assistant messages with filler user messages
export function strictFormat(turns) {
  let previous_role = null;
  let result = [];
  let filler = { role: "user", content: "_" };
  for (let message of turns) {
    message.content = message.content.trim();
    if (message.role === "system") {
      message.role = "user";
      message.content = "SYSTEM: " + message.content;
    }
    if (message.role === previous_role && message.role === "assistant") {
      // insert empty user message to separate assistant messages
      result.push(filler, message);
    } else if (message.role === previous_role) {
      // combine new message with previous message instead of adding a new one
      result.at(-1).content += "\n" + message.content;
    } else {
      result.push(message);
    }
    previous_role = message.role;
  }
  if (result.length > 0 && result[0].role !== "user") {
    result.unshift(filler); // anthropic requires user message to start
  }
  if (result.length === 0) {
    result.push(filler);
  }
  return result;
}
