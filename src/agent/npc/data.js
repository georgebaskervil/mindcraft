export class NPCData {
  constructor() {
    this.goals = [];
    this.curr_goal = null;
    this.built = {};
    this.home = null;
    this.do_routine = false;
    this.do_set_goal = false;
  }

  toObject() {
    let object = {};
    if (this.goals.length > 0) {
      object.goals = this.goals;
    }
    if (this.curr_goal) {
      object.curr_goal = this.curr_goal;
    }
    if (Object.keys(this.built).length > 0) {
      object.built = this.built;
    }
    if (this.home) {
      object.home = this.home;
    }
    object.do_routine = this.do_routine;
    object.do_set_goal = this.do_set_goal;
    return object;
  }

  static fromObject(object) {
    let npc = new NPCData();
    if (!object) {
      return npc;
    }
    if (object.goals) {
      npc.goals = [];
      for (let goal of object.goals) {
        if (typeof goal === "string") {
          npc.goals.push({ name: goal, quantity: 1 });
        } else {
          npc.goals.push({ name: goal.name, quantity: goal.quantity });
        }
      }
    }
    if (object.curr_goal) {
      npc.curr_goal = object.curr_goal;
    }
    if (object.built) {
      npc.built = object.built;
    }
    if (object.home) {
      npc.home = object.home;
    }
    if (object.do_routine !== undefined) {
      npc.do_routine = object.do_routine;
    }
    if (object.do_set_goal !== undefined) {
      npc.do_set_goal = object.do_set_goal;
    }
    return npc;
  }
}
