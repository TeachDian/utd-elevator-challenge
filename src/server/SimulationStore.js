import Elevator from '../domain/Elevator.js';
import Person from '../domain/Person.js';

export default class SimulationStore {
  constructor() {
    this.reset();
  }

  snapshot() {
    return {
      ...this.elevator.snapshot(),
      hour: this.hour,
      strategy: this.elevator.strategy
    };
  }

  addRequest(payload) {
    const person = this.elevator.addRequest(Person.from(payload));
    return person.toJSON();
  }

  removeRequest(id) {
    const person = this.elevator.removeRequest(id);
    return person ? person.toJSON() : null;
  }

  addRider(payload) {
    const person = this.elevator.addRider(Person.from(payload));
    return person.toJSON();
  }

  removeRider(id) {
    const person = this.elevator.removeRider(id);
    return person ? person.toJSON() : null;
  }

  dispatch(options = {}) {
    const hour = Number.isInteger(Number(options.hour)) ? Number(options.hour) : this.hour;
    const strategy = options.strategy ?? this.elevator.strategy;

    this.hour = hour;

    return this.elevator.dispatch({
      strategy,
      hour
    });
  }

  reset() {
    this.hour = 9;
    this.elevator = new Elevator();
    return this.snapshot();
  }
}
