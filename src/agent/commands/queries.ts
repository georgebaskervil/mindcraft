import * as world from "../library/world";
import * as mc from "../../utils/mcdata";
import { getCommandDocumentation } from "./index";
import convoManager from "../conversation";

const pad = (string_) => {
  return "\n" + string_ + "\n";
};

// queries are commands that just return strings and don't affect anything in the world
export const queryList = [
  {
    name: "!stats",
    description: "Get your bot's location, health, hunger, and time of day.",
    perform: function (agent) {
      const bot = agent.bot;
      let result = "STATS";
      const pos = bot.entity.position;
      // display position to 2 decimal places
      result += `\n- Position: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`;
      // Gameplay
      result += `\n- Gamemode: ${bot.game.gameMode}`;
      result += `\n- Health: ${Math.round(bot.health)} / 20`;
      result += `\n- Hunger: ${Math.round(bot.food)} / 20`;
      result += `\n- Biome: ${world.getBiomeName(bot)}`;
      let weather = "Clear";
      if (bot.rainState > 0) {
        weather = "Rain";
      }
      if (bot.thunderState > 0) {
        weather = "Thunderstorm";
      }
      result += `\n- Weather: ${weather}`;
      // let block = bot.blockAt(pos);
      // result += `\n- Artificial light: ${block.skyLight}`;
      // result += `\n- Sky light: ${block.light}`;
      // light properties are bugged, they are not accurate
      result += "\n- " + world.getSurroundingBlocks(bot).join("\n- ");
      result += `\n- First Solid Block Above Head: ${world.getFirstBlockAboveHead(bot, null, 32)}`;

      if (bot.time.timeOfDay < 6000) {
        result += "\n- Time: Morning";
      } else if (bot.time.timeOfDay < 12_000) {
        result += "\n- Time: Afternoon";
      } else {
        result += "\n- Time: Night";
      }

      // get the bot's current action
      let action = agent.actions.currentActionLabel;
      if (agent.isIdle()) {
        action = "Idle";
      }
      result += `\n- Current Action: ${action}`;

      let players = world.getNearbyPlayerNames(bot);
      const bots = convoManager
        .getInGameAgents()
        .filter((b) => b !== agent.name);
      players = players.filter((p) => !bots.includes(p));

      result +=
        "\n- Nearby Human Players: " +
        (players.length > 0 ? players.join(", ") : "None.");
      result +=
        "\n- Nearby Bot Players: " +
        (bots.length > 0 ? bots.join(", ") : "None.");

      result += "\n" + agent.bot.modes.getMiniDocs() + "\n";
      return pad(result);
    },
  },
  {
    name: "!inventory",
    description: "Get your bot's inventory.",
    perform: function (agent) {
      const bot = agent.bot;
      const inventory = world.getInventoryCounts(bot);
      let result = "INVENTORY";
      for (const item in inventory) {
        if (inventory[item] && inventory[item] > 0) {
          result += `\n- ${item}: ${inventory[item]}`;
        }
      }
      if (result === "INVENTORY") {
        result += ": Nothing";
      } else if (agent.bot.game.gameMode === "creative") {
        result +=
          "\n(You have infinite items in creative mode. You do not need to gather resources!!)";
      }

      const helmet = bot.inventory.slots[5];
      const chestplate = bot.inventory.slots[6];
      const leggings = bot.inventory.slots[7];
      const boots = bot.inventory.slots[8];
      result += "\nWEARING: ";
      if (helmet) {
        result += `\nHead: ${helmet.name}`;
      }
      if (chestplate) {
        result += `\nTorso: ${chestplate.name}`;
      }
      if (leggings) {
        result += `\nLegs: ${leggings.name}`;
      }
      if (boots) {
        result += `\nFeet: ${boots.name}`;
      }
      if (!helmet && !chestplate && !leggings && !boots) {
        result += "Nothing";
      }

      return pad(result);
    },
  },
  {
    name: "!nearbyBlocks",
    description: "Get the blocks near the bot.",
    perform: function (agent) {
      const bot = agent.bot;
      let result = "NEARBY_BLOCKS";
      const blocks = world.getNearbyBlockTypes(bot);
      for (const block of blocks) {
        result += `\n- ${block}`;
      }
      if (blocks.length === 0) {
        result += ": none";
      } else {
        // Environmental Awareness
        result += "\n- " + world.getSurroundingBlocks(bot).join("\n- ");
        result += `\n- First Solid Block Above Head: ${world.getFirstBlockAboveHead(bot, null, 32)}`;
      }
      return pad(result);
    },
  },
  {
    name: "!craftable",
    description: "Get the craftable items with the bot's inventory.",
    perform: function (agent) {
      const craftable = world.getCraftableItems(agent.bot);
      let result = "CRAFTABLE_ITEMS";
      for (const item of craftable) {
        result += `\n- ${item}`;
      }
      if (result == "CRAFTABLE_ITEMS") {
        result += ": none";
      }
      return pad(result);
    },
  },
  {
    name: "!entities",
    description: "Get the nearby players and entities.",
    perform: function (agent) {
      const bot = agent.bot;
      let result = "NEARBY_ENTITIES";
      let players = world.getNearbyPlayerNames(bot);
      const bots = convoManager
        .getInGameAgents()
        .filter((b) => b !== agent.name);
      players = players.filter((p) => !bots.includes(p));

      for (const player of players) {
        result += `\n- Human player: ${player}`;
      }
      for (const bot of bots) {
        result += `\n- Bot player: ${bot}`;
      }

      for (const entity of world.getNearbyEntityTypes(bot)) {
        if (entity === "player" || entity === "item") {
          continue;
        }
        result += `\n- entities: ${entity}`;
      }
      if (result == "NEARBY_ENTITIES") {
        result += ": none";
      }
      return pad(result);
    },
  },
  {
    name: "!modes",
    description:
      "Get all available modes and their docs and see which are on/off.",
    perform: function (agent) {
      return agent.bot.modes.getDocs();
    },
  },
  {
    name: "!savedPlaces",
    description: "List all saved locations.",
    perform: async function (agent) {
      return "Saved place names: " + agent.memory_bank.getKeys();
    },
  },
  {
    name: "!getCraftingPlan",
    description:
      "Provides a comprehensive crafting plan for a specified item. This includes a breakdown of required ingredients, the exact quantities needed, and an analysis of missing ingredients or extra items needed based on the bot's current inventory.",
    params: {
      targetItem: {
        type: "string",
        description: "The item that we are trying to craft",
      },
      quantity: {
        type: "int",
        description: "The quantity of the item that we are trying to craft",
        optional: true,
        domain: [1, Infinity, "[)"], // Quantity must be at least 1,
        default: 1,
      },
    },
    perform: function (agent, targetItem, quantity = 1) {
      const bot = agent.bot;

      // Fetch the bot's inventory
      const current_inventory = world.getInventoryCounts(bot);
      const target_item = targetItem;
      const existingCount = current_inventory[target_item] || 0;
      let prefixMessage = "";
      if (existingCount > 0) {
        current_inventory[target_item] -= existingCount;
        prefixMessage = `You already have ${existingCount} ${target_item} in your inventory. If you need to craft more,\n`;
      }

      // Generate crafting plan
      let craftingPlan = mc.getDetailedCraftingPlan(
        target_item,
        quantity,
        current_inventory,
      );
      craftingPlan = prefixMessage + craftingPlan;
      console.log(craftingPlan);
      return pad(craftingPlan);
    },
  },
  {
    name: "!help",
    description: "Lists all available commands and their descriptions.",
    perform: async function (agent) {
      return getCommandDocumentation();
    },
  },
];
