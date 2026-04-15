import Person from './Person.js';
import { dispatchStrategies } from './dispatchStrategies.js';

function normalizeHour(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (value instanceof Date) {
    return value.getHours();
  }

  return new Date().getHours();
}

function mergeFloorState(planStop, queue, riders) {
  return {
    floor: planStop.floor,
    pickups: queue.filter((person) => planStop.pickupIds.includes(person.id)),
    dropoffs: riders.filter((person) => planStop.dropoffIds.includes(person.id))
  };
}

export default class Elevator {
  constructor(options = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.strategy = options.strategy ?? 'fifo';
    this.reset();
  }

  addRequest(personInput) {
    const person = Person.from(personInput);
    this.requests.push(person);
    return person;
  }

  addRider(personInput) {
    const person = Person.from(personInput);
    this.riders.push(person);
    return person;
  }

  removeRequest(id) {
    const request = this.requests.find((person) => person.id === id);
    this.requests = this.requests.filter((person) => person.id !== id);
    return request ?? null;
  }

  removeRider(id) {
    const rider = this.riders.find((person) => person.id === id);
    this.riders = this.riders.filter((person) => person.id !== id);
    return rider ?? null;
  }

  loadRequests(people = []) {
    this.requests = people.map((person) => Person.from(person));
    return this.requests;
  }

  moveUp() {
    this.currentFloor += 1;
    this.floorsTraversed += 1;
    this.recordEvent('move', { direction: 'up', floor: this.currentFloor });
    return this.currentFloor;
  }

  moveDown() {
    if (this.currentFloor === 0) {
      return this.currentFloor;
    }

    this.currentFloor -= 1;
    this.floorsTraversed += 1;
    this.recordEvent('move', { direction: 'down', floor: this.currentFloor });
    return this.currentFloor;
  }

  travelToFloor(targetFloor) {
    while (this.currentFloor < targetFloor) {
      this.moveUp();
    }

    while (this.currentFloor > targetFloor) {
      this.moveDown();
    }
  }

  hasPickup(floor = this.currentFloor) {
    return this.requests.some((person) => person.currentFloor === floor);
  }

  hasDropoff(floor = this.currentFloor) {
    return this.riders.some((person) => person.dropOffFloor === floor);
  }

  hasStop(floor = this.currentFloor) {
    return this.hasPickup(floor) || this.hasDropoff(floor);
  }

  serviceCurrentFloor(stop = null) {
    const floor = stop?.floor ?? this.currentFloor;
    const pickups = stop?.pickups ?? this.requests.filter((person) => person.currentFloor === floor);
    const dropoffs = stop?.dropoffs ?? this.riders.filter((person) => person.dropOffFloor === floor);

    if (!pickups.length && !dropoffs.length) {
      return { pickups: [], dropoffs: [] };
    }

    const pickupIds = pickups.map((person) => person.id);
    const dropoffIds = dropoffs.map((person) => person.id);

    this.requests = this.requests.filter((person) => !pickupIds.includes(person.id));
    this.riders = this.riders.filter((person) => !dropoffIds.includes(person.id));
    this.riders.push(...pickups.map((person) => person.clone()));
    this.completedRides.push(...dropoffs.map((person) => person.clone()));
    this.stops += 1;

    this.recordEvent('stop', {
      floor,
      pickups: pickups.map((person) => person.toJSON()),
      dropoffs: dropoffs.map((person) => person.toJSON())
    });

    return { pickups, dropoffs };
  }

  executePlan(plan, options = {}) {
    const before = this.snapshot();
    this.history = [];

    for (const planStop of plan) {
      this.travelToFloor(planStop.floor);
      const stop = mergeFloorState(planStop, this.requests, this.riders);
      this.serviceCurrentFloor(stop);
    }

    if (this.checkReturnToLoby(options.hour ?? this.clock())) {
      this.recordEvent('idle-return', { floor: this.currentFloor });
      this.returnToLoby();
    }

    return {
      before,
      after: this.snapshot(),
      events: [...this.history]
    };
  }

  goToFloor(personInput, options = {}) {
    const person = Person.from(personInput);
    this.requests = this.requests.filter((request) => request.id !== person.id);
    this.requests.unshift(person);
    return this.executePlan(dispatchStrategies.fifo(this.currentFloor, [person]), options);
  }

  dispatch(options = {}) {
    const strategyName = options.strategy ?? this.strategy;
    const buildPlan = dispatchStrategies[strategyName];

    if (!buildPlan) {
      throw new Error(`Unknown dispatch strategy: ${strategyName}`);
    }

    this.strategy = strategyName;
    return this.executePlan(buildPlan(this.currentFloor, this.requests), options);
  }

  dispatchOptimized(options = {}) {
    return this.dispatch({ ...options, strategy: 'optimized' });
  }

  checkReturnToLoby(time = this.clock()) {
    return this.requests.length === 0
      && this.riders.length === 0
      && this.currentFloor !== 0
      && normalizeHour(time) < 12;
  }

  checkReturnToLobby(time = this.clock()) {
    return this.checkReturnToLoby(time);
  }

  returnToLoby() {
    this.travelToFloor(0);
    return this.currentFloor;
  }

  returnToLobby() {
    return this.returnToLoby();
  }

  recordEvent(type, detail) {
    this.history.push({
      type,
      ...detail
    });
  }

  snapshot() {
    return {
      currentFloor: this.currentFloor,
      stops: this.stops,
      floorsTraversed: this.floorsTraversed,
      requests: this.requests.map((person) => person.toJSON()),
      riders: this.riders.map((person) => person.toJSON()),
      completedRides: this.completedRides.map((person) => person.toJSON()),
      strategy: this.strategy
    };
  }

  reset() {
    this.currentFloor = 0;
    this.stops = 0;
    this.floorsTraversed = 0;
    this.requests = [];
    this.riders = [];
    this.completedRides = [];
    this.history = [];
  }
}
