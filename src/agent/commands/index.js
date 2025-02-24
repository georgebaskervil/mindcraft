import { getBlockId, getItemId } from "../../utils/mcdata.js";
import { actionsList } from "./actions.js";
import { queryList } from "./queries.js";

let suppressNoDomainWarning = false;

const commandList = queryList.concat(actionsList);
const commandMap = {};
for (let command of commandList) {
  commandMap[command.name] = command;
}

export function getCommand(name) {
  return commandMap[name];
}

export function blacklistCommands(commands) {
  const unblockable = new Set(["!stop", "!stats", "!inventory", "!goal"]);
  for (let command_name of commands) {
    if (unblockable.has(command_name)) {
      console.warn(`Command ${command_name} is unblockable`);
      continue;
    }
    delete commandMap[command_name];
    delete commandList.find((command) => command.name === command_name);
  }
}

const commandRegex =
  /!(\w+)(?:\(((?:-?\d+(?:\.\d+)?|true|false|"[^"]*")(?:\s*,\s*(?:-?\d+(?:\.\d+)?|true|false|"[^"]*"))*)\))?/;
const argumentRegex = /-?\d+(?:\.\d+)?|true|false|"[^"]*"/g;

export function containsCommand(message) {
  const commandMatch = message.match(commandRegex);
  if (commandMatch) {
    return "!" + commandMatch[1];
  }
  return null;
}

export function commandExists(commandName) {
  if (!commandName.startsWith("!")) {
    commandName = "!" + commandName;
  }
  return commandMap[commandName] !== undefined;
}

/**
 * Converts a string into a boolean.
 * @param {string} input
 * @returns {boolean | null} the boolean or `null` if it could not be parsed.
 * */
function parseBoolean(input) {
  switch (input.toLowerCase()) {
    case "false": //These are interpreted as false;
    case "f":
    case "0":
    case "off": {
      return false;
    }
    case "true": //These are interpreted as true;
    case "t":
    case "1":
    case "on": {
      return true;
    }
    default: {
      return null;
    }
  }
}

/**
 * @param {number} value - the value to check
 * @param {number} lowerBound
 * @param {number} upperBound
 * @param {string} endpointType - The type of the endpoints represented as a two character string. `'[)'` `'()'`
 */
function checkInInterval(number, lowerBound, upperBound, endpointType) {
  switch (endpointType) {
    case "[)": {
      return lowerBound <= number && number < upperBound;
    }
    case "()": {
      return lowerBound < number && number < upperBound;
    }
    case "(]": {
      return lowerBound < number && number <= upperBound;
    }
    case "[]": {
      return lowerBound <= number && number <= upperBound;
    }
    default: {
      throw new Error("Unknown endpoint type:", endpointType);
    }
  }
}

// todo: handle arrays?
/**
 * Returns an object containing the command, the command name, and the command parameters.
 * If parsing unsuccessful, returns an error message as a string.
 * @param {string} message - A message from a player or language model containing a command.
 * @returns {string | Object}
 */
export function parseCommandMessage(message) {
  const commandMatch = message.match(commandRegex);
  if (!commandMatch) {
    return `Command is incorrectly formatted`;
  }

  const commandName = "!" + commandMatch[1];

  let arguments_;
  arguments_ = commandMatch[2] ? commandMatch[2].match(argumentRegex) : [];

  const command = getCommand(commandName);
  if (!command) {
    return `${commandName} is not a command.`;
  }

  const parameters = commandParameters(command);
  const parameterNames = commandParameterNames(command);

  if (arguments_.length !== parameters.length) {
    return `Command ${command.name} was given ${arguments_.length} args, but requires ${parameters.length} args.`;
  }

  for (let index = 0; index < arguments_.length; index++) {
    const parameter = parameters[index];
    //Remove any extra characters
    let argument = arguments_[index].trim();
    if (
      (argument.startsWith('"') && argument.endsWith('"')) ||
      (argument.startsWith("'") && argument.endsWith("'"))
    ) {
      argument = argument.substring(1, argument.length - 1);
    }

    //Convert to the correct type
    switch (parameter.type) {
      case "int": {
        argument = Number.parseInt(argument);
        break;
      }
      case "float": {
        argument = Number.parseFloat(argument);
        break;
      }
      case "boolean": {
        argument = parseBoolean(argument);
        break;
      }
      case "BlockName":
      case "ItemName": {
        if (argument.endsWith("plank")) {
          argument += "s";
        }
      } // catches common mistakes like "oak_plank" instead of "oak_planks"
      case "string": {
        break;
      }
      default: {
        throw new Error(
          `Command '${commandName}' parameter '${parameterNames[index]}' has an unknown type: ${parameter.type}`,
        );
      }
    }
    if (argument === null || Number.isNaN(argument)) {
      return `Error: Param '${parameterNames[index]}' must be of type ${parameter.type}.`;
    }

    if (typeof argument === "number") {
      //Check the domain of numbers
      const domain = parameter.domain;
      if (domain) {
        /**
         * Javascript has a built in object for sets but not intervals.
         * Currently the interval (lowerbound,upperbound] is represented as an Array: `[lowerbound, upperbound, '(]']`
         */
        if (!domain[2]) {
          domain[2] = "[)";
        } //By default, lower bound is included. Upper is not.

        if (!checkInInterval(argument, ...domain)) {
          return `Error: Param '${parameterNames[index]}' must be an element of ${domain[2][0]}${domain[0]}, ${domain[1]}${domain[2][1]}.`;
          //Alternatively arg could be set to the nearest value in the domain.
        }
      } else if (!suppressNoDomainWarning) {
        console.warn(
          `Command '${commandName}' parameter '${parameterNames[index]}' has no domain set. Expect any value [-Infinity, Infinity].`,
        );
        suppressNoDomainWarning = true; //Don't spam console. Only give the warning once.
      }
    } else if (parameter.type === "BlockName") {
      //Check that there is a block with this name
      if (getBlockId(argument) == undefined && argument !== "air") {
        return `Invalid block type: ${argument}.`;
      }
    } else if (
      parameter.type === "ItemName" && //Check that there is an item with this name
      getItemId(argument) == undefined
    ) {
      return `Invalid item type: ${argument}.`;
    }
    arguments_[index] = argument;
  }

  return { commandName, args: arguments_ };
}

export function truncCommandMessage(message) {
  const commandMatch = message.match(commandRegex);
  if (commandMatch) {
    return message.slice(
      0,
      Math.max(0, commandMatch.index + commandMatch[0].length),
    );
  }
  return message;
}

export function isAction(name) {
  return actionsList.find((action) => action.name === name) !== undefined;
}

/**
 * @param {Object} command
 * @returns {Object[]} The command's parameters.
 */
function commandParameters(command) {
  if (!command.params) {
    return [];
  }
  return Object.values(command.params);
}

/**
 * @param {Object} command
 * @returns {string[]} The names of the command's parameters.
 */
function commandParameterNames(command) {
  if (!command.params) {
    return [];
  }
  return Object.keys(command.params);
}

function numberParameters(command) {
  return commandParameters(command).length;
}

export async function executeCommand(agent, message) {
  let parsed = parseCommandMessage(message);
  if (typeof parsed === "string") {
    return parsed;
  } //The command was incorrectly formatted or an invalid input was given.
  else {
    console.log("parsed command:", parsed);
    const command = getCommand(parsed.commandName);
    let numberArguments = 0;
    if (parsed.args) {
      numberArguments = parsed.args.length;
    }
    if (numberArguments === numberParameters(command)) {
      const result = await command.perform(agent, ...parsed.args);
      return result;
    } else {
      return `Command ${command.name} was given ${numberArguments} args, but requires ${numberParameters(command)} args.`;
    }
  }
}

export function getCommandDocs() {
  const typeTranslations = {
    //This was added to keep the prompt the same as before type checks were implemented.
    //If the language model is giving invalid inputs changing this might help.
    float: "number",
    int: "number",
    BlockName: "string",
    ItemName: "string",
    boolean: "bool",
  };
  let docs = `\n*COMMAND DOCS\n You can use the following commands to perform actions and get information about the world. 
    Use the commands with the syntax: !commandName or !commandName("arg1", 1.2, ...) if the command takes arguments.\n
    Do not use codeblocks. Use double quotes for strings. Only use one command in each response, trailing commands and comments will be ignored.\n`;
  for (let command of commandList) {
    docs += command.name + ": " + command.description + "\n";
    if (command.params) {
      docs += "Params:\n";
      for (let parameter in command.params) {
        docs += `${parameter}: (${typeTranslations[command.params[parameter].type] ?? command.params[parameter].type}) ${command.params[parameter].description}\n`;
      }
    }
  }
  return docs + "*\n";
}
