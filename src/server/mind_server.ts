import { Server } from "socket.io";
import express from "express";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Module-level variables
let io;
let server;
const registeredAgents = new Set();
const inGameAgents = {};
const agentManagers = {}; // socket for main process that registers/controls agents
const connectedAgents = new Set();

// Initialize the server
export function createMindServer(port = 8080) {
  const app = express();
  server = http.createServer(app);
  io = new Server(server);

  // Serve static files
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, "public")));

  // Socket.io connection handling
  io.on("connection", (socket) => {
    let currentAgentName = null;
    console.log("Client connected");

    agentsUpdate(socket);

    socket.on("register-agents", (agentNames) => {
      console.log(`Registering agents: ${agentNames}`);
      for (const name of agentNames) {
        registeredAgents.add(name);
      }
      for (const name of agentNames) {
        agentManagers[name] = socket;
      }
      socket.emit("register-agents-success");
      agentsUpdate();
    });

    socket.on("login-agent", (agentName) => {
      if (currentAgentName && currentAgentName !== agentName) {
        console.warn(
          `Agent ${agentName} already logged in as ${currentAgentName}`,
        );
        return;
      }
      if (registeredAgents.has(agentName)) {
        currentAgentName = agentName;
        inGameAgents[agentName] = socket;
        agentsUpdate();
      } else {
        console.warn(`Agent ${agentName} not registered`);
      }
    });

    socket.on("logout-agent", (agentName) => {
      if (inGameAgents[agentName]) {
        delete inGameAgents[agentName];
        agentsUpdate();
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
      if (inGameAgents[currentAgentName]) {
        delete inGameAgents[currentAgentName];
        agentsUpdate();
      }
    });

    socket.on("chat-message", (agentName, json) => {
      if (!inGameAgents[agentName]) {
        console.warn(
          `Agent ${agentName} tried to send a message but is not logged in`,
        );
        return;
      }
      console.log(
        `${currentAgentName} sending message to ${agentName}: ${json.message}`,
      );
      inGameAgents[agentName].emit("chat-message", currentAgentName, json);
    });

    socket.on("restart-agent", (agentName) => {
      console.log(`Restarting agent: ${agentName}`);
      inGameAgents[agentName].emit("restart-agent");
    });

    socket.on("stop-agent", (agentName) => {
      const manager = agentManagers[agentName];
      if (manager) {
        manager.emit("stop-agent", agentName);
      } else {
        console.warn(`Stopping unregistered agent ${agentName}`);
      }
    });

    socket.on("start-agent", (agentName) => {
      const manager = agentManagers[agentName];
      if (manager) {
        manager.emit("start-agent", agentName);
      } else {
        console.warn(`Starting unregistered agent ${agentName}`);
      }
    });

    socket.on("stop-all-agents", () => {
      console.log("Killing all agents");
      stopAllAgents();
    });

    socket.on("shutdown", () => {
      console.log("Shutting down");
      for (const manager of Object.values(agentManagers)) {
        manager.emit("shutdown");
      }
      setTimeout(() => {
        process.exit(0);
      }, 2000);
    });

    socket.on("send-message", (agentName, message) => {
      if (!inGameAgents[agentName]) {
        console.warn(
          `Agent ${agentName} not logged in, cannot send message via MindServer.`,
        );
        return;
      }
      try {
        console.log(`Sending message to agent ${agentName}: ${message}`);
        inGameAgents[agentName].emit("send-message", agentName, message);
      } catch (error) {
        console.error("Error:", error);
      }
    });
  });

  server.listen(port, "localhost", () => {
    console.log(`MindServer running on port ${port}`);
  });

  return server;
}

function agentsUpdate(socket) {
  if (!socket) {
    socket = io;
  }
  const agents = [];
  for (const name of registeredAgents) {
    agents.push({ name, in_game: !!inGameAgents[name] });
  }
  socket.emit("agents-update", agents);
}

function stopAllAgents() {
  for (const agentName in inGameAgents) {
    const manager = agentManagers[agentName];
    if (manager) {
      manager.emit("stop-agent", agentName);
    }
  }
}

// Optional: export these if you need access to them from other files
export const getIO = () => io;
export const getServer = () => server;
export const getConnectedAgents = () => connectedAgents;
