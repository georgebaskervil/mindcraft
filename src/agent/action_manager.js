export class ActionManager {
  constructor(agent) {
    this.agent = agent;
    this.executing = false;
    this.currentActionLabel = "";
    this.currentActionFn = null;
    this.timedout = false;
    this.resume_func = null;
    this.resume_name = "";
  }

  async resumeAction(actionFunction, timeout) {
    return this._executeResume(actionFunction, timeout);
  }

  async runAction(actionLabel, actionFunction, { timeout, resume = false } = {}) {
    return resume ? this._executeResume(actionLabel, actionFunction, timeout) : this._executeAction(actionLabel, actionFunction, timeout);
  }

  async stop() {
    if (!this.executing) {
      return;
    }
    const timeout = setTimeout(() => {
      this.agent.cleanKill(
        "Code execution refused stop after 10 seconds. Killing process.",
      );
    }, 10_000);
    while (this.executing) {
      this.agent.requestInterrupt();
      console.log("waiting for code to finish executing...");
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    clearTimeout(timeout);
  }

  cancelResume() {
    this.resume_func = null;
    this.resume_name = null;
  }

  async _executeResume(actionLabel = null, actionFunction = null, timeout = 10) {
    const new_resume = actionFunction != undefined;
    if (new_resume) {
      // start new resume
      this.resume_func = actionFunction;
      assert(actionLabel != undefined, "actionLabel is required for new resume");
      this.resume_name = actionLabel;
    }
    if (
      this.resume_func != undefined &&
      (this.agent.isIdle() || new_resume) &&
      (!this.agent.self_prompter.isActive() || new_resume)
    ) {
      this.currentActionLabel = this.resume_name;
      let res = await this._executeAction(
        this.resume_name,
        this.resume_func,
        timeout,
      );
      this.currentActionLabel = "";
      return res;
    } else {
      return {
        success: false,
        message: null,
        interrupted: false,
        timedout: false,
      };
    }
  }

  async _executeAction(actionLabel, actionFunction, timeout = 10) {
    let TIMEOUT;
    try {
      console.log("executing code...\n");

      // await current action to finish (executing=false), with 10 seconds timeout
      // also tell agent.bot to stop various actions
      if (this.executing) {
        console.log(
          `action "${actionLabel}" trying to interrupt current action "${this.currentActionLabel}"`,
        );
      }
      await this.stop();

      // clear bot logs and reset interrupt code
      this.agent.clearBotLogs();

      this.executing = true;
      this.currentActionLabel = actionLabel;
      this.currentActionFn = actionFunction;

      // timeout in minutes
      if (timeout > 0) {
        TIMEOUT = this._startTimeout(timeout);
      }

      // start the action
      await actionFunction();

      // mark action as finished + cleanup
      this.executing = false;
      this.currentActionLabel = "";
      this.currentActionFn = null;
      clearTimeout(TIMEOUT);

      // get bot activity summary
      let output = this._getBotOutputSummary();
      let interrupted = this.agent.bot.interrupt_code;
      let timedout = this.timedout;
      this.agent.clearBotLogs();

      // if not interrupted and not generating, emit idle event
      if (!interrupted && !this.agent.coder.generating) {
        this.agent.bot.emit("idle");
      }

      // return action status report
      return { success: true, message: output, interrupted, timedout };
    } catch (error) {
      this.executing = false;
      this.currentActionLabel = "";
      this.currentActionFn = null;
      clearTimeout(TIMEOUT);
      this.cancelResume();
      console.error("Code execution triggered catch:", error);
      // Log the full stack trace
      console.error(error.stack);
      await this.stop();
      error = error.toString();

      let message =
        this._getBotOutputSummary() +
        "!!Code threw exception!!\n" +
        "Error: " +
        error +
        "\n" +
        "Stack trace:\n" +
        error.stack +
        "\n";

      let interrupted = this.agent.bot.interrupt_code;
      this.agent.clearBotLogs();
      if (!interrupted && !this.agent.coder.generating) {
        this.agent.bot.emit("idle");
      }
      return { success: false, message, interrupted, timedout: false };
    }
  }

  _getBotOutputSummary() {
    const { bot } = this.agent;
    if (bot.interrupt_code && !this.timedout) {
      return "";
    }
    let output = bot.output;
    const MAX_OUT = 500;
    output = output.length > MAX_OUT ? `Code output is very long (${output.length} chars) and has been shortened.\n
          First outputs:\n${output.slice(0, Math.max(0, MAX_OUT / 2))}\n...skipping many lines.\nFinal outputs:\n ${output.slice(Math.max(0, output.length - MAX_OUT / 2))}` : "Code output:\n" + output.toString();
    return output;
  }

  _startTimeout(TIMEOUT_MINS = 10) {
    return setTimeout(
      async () => {
        console.warn(
          `Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`,
        );
        this.timedout = true;
        this.agent.history.add(
          "system",
          `Code execution timed out after ${TIMEOUT_MINS} minutes. Attempting force stop.`,
        );
        await this.stop(); // last attempt to stop
      },
      TIMEOUT_MINS * 60 * 1000,
    );
  }
}
