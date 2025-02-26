import * as skills from "./skills.js";
import * as world from "./world.js";

export function documentHelper(functions, module_name) {
  const documentArray = [];
  for (const skillFunction of functions) {
    const string_ = skillFunction.toString();
    if (string_.includes("/**")) {
      let documentEntry = `${module_name}.${skillFunction.name}\n`;
      documentEntry += string_
        .slice(string_.indexOf("/**") + 3, string_.indexOf("**/"))
        .trim();
      documentArray.push(documentEntry);
    }
  }
  return documentArray;
}

export function getSkillDocumentation() {
  let documentArray = [];
  documentArray = [
    ...documentArray,
    ...documentHelper(Object.values(skills), "skills"),
  ];
  documentArray = [
    ...documentArray,
    ...documentHelper(Object.values(world), "world"),
  ];
  return documentArray;
}
