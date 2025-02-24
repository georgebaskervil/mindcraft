import * as skills from "./skills.js";
import * as world from "./world.js";

export function docHelper(functions, module_name) {
  let documentArray = [];
  for (let skillFunction of functions) {
    let string_ = skillFunction.toString();
    if (string_.includes("/**")) {
      let documentEntry = `${module_name}.${skillFunction.name}\n`;
      documentEntry += string_
        .substring(string_.indexOf("/**") + 3, string_.indexOf("**/"))
        .trim();
      documentArray.push(documentEntry);
    }
  }
  return documentArray;
}

export function getSkillDocs() {
  let documentArray = [];
  documentArray = documentArray.concat(docHelper(Object.values(skills), "skills"));
  documentArray = documentArray.concat(docHelper(Object.values(world), "world"));
  return documentArray;
}
