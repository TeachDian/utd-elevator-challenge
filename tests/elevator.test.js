import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Elevator from '../elevator.js';
import Person from '../person.js';
import { buildFifoPlan } from '../src/domain/dispatchStrategies.js';

function createPeople(pairs) {
  return pairs.map(([name, currentFloor, dropOffFloor]) => new Person(name, currentFloor, dropOffFloor));
}

function createScenarioRunner(strategy, people, options = {}) {
  const elevator = new Elevator({ strategy });
  elevator.loadRequests(people);
  const result = elevator.dispatch({ strategy, hour: options.hour ?? 13 });

  return {
    elevator,
    result
  };
}

const benchmarkScenarios = [
  {
    name: 'person A up, person B up',
    people: createPeople([
      ['Person A', 3, 6],
      ['Person B', 1, 5]
    ]),
    fifoFloors: 15,
    optimizedFloors: 6
  },
  {
    name: 'person A up, person B down',
    people: createPeople([
      ['Person A', 3, 6],
      ['Person B', 5, 1]
    ]),
    fifoFloors: 11,
    optimizedFloors: 11
  },
  {
    name: 'person A down, person B up',
    people: createPeople([
      ['Person A', 7, 1],
      ['Person B', 2, 8]
    ]),
    fifoFloors: 20,
    optimizedFloors: 15
  },
  {
    name: 'person A down, person B down',
    people: createPeople([
      ['Person A', 8, 2],
      ['Person B', 5, 0]
    ]),
    fifoFloors: 22,
    optimizedFloors: 16
  }
];

describe('Person', () => {
  it('stores the level 1 person data', () => {
    const person = new Person('Avery', 2, 7);

    assert.equal(person.name, 'Avery');
    assert.equal(person.currentFloor, 2);
    assert.equal(person.dropOffFloor, 7);
  });
});

describe('Elevator methods', () => {
  it('constructor starts in the lobby with empty state', () => {
    const elevator = new Elevator();

    assert.equal(elevator.currentFloor, 0);
    assert.equal(elevator.stops, 0);
    assert.equal(elevator.floorsTraversed, 0);
    assert.deepEqual(elevator.requests, []);
    assert.deepEqual(elevator.riders, []);
    assert.deepEqual(elevator.completedRides, []);
    assert.deepEqual(elevator.history, []);
  });

  it('addRequest adds a request to the queue', () => {
    const elevator = new Elevator();
    const request = elevator.addRequest(new Person('Sam', 2, 5));

    assert.equal(elevator.requests.length, 1);
    assert.equal(elevator.requests[0].id, request.id);
  });

  it('addRider adds a rider to the elevator', () => {
    const elevator = new Elevator();
    const rider = elevator.addRider(new Person('Alex', 3, 6));

    assert.equal(elevator.riders.length, 1);
    assert.equal(elevator.riders[0].id, rider.id);
  });

  it('removeRequest removes a queued request by id', () => {
    const elevator = new Elevator();
    const request = elevator.addRequest(new Person('Nina', 4, 1));

    const removed = elevator.removeRequest(request.id);

    assert.equal(removed.id, request.id);
    assert.equal(elevator.requests.length, 0);
    assert.equal(elevator.removeRequest('missing'), null);
  });

  it('removeRider removes a rider by id', () => {
    const elevator = new Elevator();
    const rider = elevator.addRider(new Person('Ivy', 5, 2));

    const removed = elevator.removeRider(rider.id);

    assert.equal(removed.id, rider.id);
    assert.equal(elevator.riders.length, 0);
    assert.equal(elevator.removeRider('missing'), null);
  });

  it('loadRequests replaces the queue with cloned person instances', () => {
    const elevator = new Elevator();
    const source = [{ name: 'Kai', currentFloor: 1, dropOffFloor: 4 }];

    const requests = elevator.loadRequests(source);

    assert.equal(requests.length, 1);
    assert.notEqual(requests[0], source[0]);
    assert.equal(requests[0].name, 'Kai');
  });

  it('moveUp increments floor and traversal count', () => {
    const elevator = new Elevator();

    assert.equal(elevator.moveUp(), 1);
    assert.equal(elevator.currentFloor, 1);
    assert.equal(elevator.floorsTraversed, 1);
    assert.equal(elevator.history.at(-1).direction, 'up');
  });

  it('moveDown decrements floor above zero and never goes below zero', () => {
    const elevator = new Elevator();
    elevator.currentFloor = 2;

    assert.equal(elevator.moveDown(), 1);
    assert.equal(elevator.currentFloor, 1);
    assert.equal(elevator.floorsTraversed, 1);
    assert.equal(elevator.history.at(-1).direction, 'down');

    elevator.currentFloor = 0;
    assert.equal(elevator.moveDown(), 0);
    assert.equal(elevator.currentFloor, 0);
  });

  it('travelToFloor moves to a target floor', () => {
    const elevator = new Elevator();

    elevator.travelToFloor(4);
    assert.equal(elevator.currentFloor, 4);
    assert.equal(elevator.floorsTraversed, 4);

    elevator.travelToFloor(1);
    assert.equal(elevator.currentFloor, 1);
    assert.equal(elevator.floorsTraversed, 7);
  });

  it('hasPickup checks whether a request is waiting on a floor', () => {
    const elevator = new Elevator();
    elevator.addRequest(new Person('Anne', 3, 1));

    assert.equal(elevator.hasPickup(3), true);
    assert.equal(elevator.hasPickup(2), false);
  });

  it('hasDropoff checks whether a rider should exit on a floor', () => {
    const elevator = new Elevator();
    elevator.addRider(new Person('Jules', 2, 3));

    assert.equal(elevator.hasDropoff(3), true);
    assert.equal(elevator.hasDropoff(2), false);
  });

  it('hasStop checks for either pickup or dropoff activity on a floor', () => {
    const elevator = new Elevator();
    elevator.addRequest(new Person('Anne', 3, 1));
    elevator.addRider(new Person('Jules', 2, 3));

    assert.equal(elevator.hasStop(3), true);
    assert.equal(elevator.hasStop(9), false);
  });

  it('serviceCurrentFloor processes pickups and dropoffs', () => {
    const elevator = new Elevator();
    const request = elevator.addRequest(new Person('Anne', 3, 1));
    const rider = elevator.addRider(new Person('Jules', 2, 3));
    elevator.currentFloor = 3;

    const serviced = elevator.serviceCurrentFloor();

    assert.equal(serviced.pickups[0].id, request.id);
    assert.equal(serviced.dropoffs[0].id, rider.id);
    assert.equal(elevator.requests.length, 0);
    assert.equal(elevator.riders.length, 1);
    assert.equal(elevator.completedRides.length, 1);
    assert.equal(elevator.stops, 1);
    assert.equal(elevator.history.at(-1).type, 'stop');
  });

  it('executePlan applies a stop plan and returns a before and after snapshot', () => {
    const elevator = new Elevator();
    const request = elevator.addRequest(new Person('Brittany', 2, 5));
    const plan = buildFifoPlan(elevator.currentFloor, [request]);

    const result = elevator.executePlan(plan, { hour: 13 });

    assert.equal(result.before.currentFloor, 0);
    assert.equal(result.after.currentFloor, 5);
    assert.equal(result.after.completedRides.length, 1);
    assert.ok(result.events.length > 0);
  });

  it('goToFloor handles a single rider request directly', () => {
    const elevator = new Elevator();
    const rider = new Person('Brittany', 8, 3);

    elevator.addRequest(rider);
    const result = elevator.goToFloor(rider, { hour: 13 });

    assert.equal(result.after.currentFloor, 3);
    assert.equal(elevator.completedRides.length, 1);
  });

  it('dispatch runs the baseline strategy', () => {
    const { elevator, result } = createScenarioRunner('fifo', createPeople([
      ['Oliver', 3, 6],
      ['Angela', 1, 5]
    ]));

    assert.equal(result.after.floorsTraversed, 15);
    assert.equal(elevator.strategy, 'fifo');
  });

  it('dispatchOptimized runs the optimized strategy', () => {
    const elevator = new Elevator();
    elevator.loadRequests(createPeople([
      ['Oliver', 3, 6],
      ['Angela', 1, 5]
    ]));

    const result = elevator.dispatchOptimized({ hour: 13 });

    assert.equal(elevator.strategy, 'optimized');
    assert.equal(result.after.floorsTraversed, 6);
  });

  it('checkReturnToLoby only returns true before noon when idle and away from the lobby', () => {
    const elevator = new Elevator();
    elevator.currentFloor = 5;

    assert.equal(elevator.checkReturnToLoby(9), true);
    assert.equal(elevator.checkReturnToLoby(13), false);

    elevator.addRider(new Person('Morgan', 5, 7));
    assert.equal(elevator.checkReturnToLoby(9), false);
  });

  it('checkReturnToLobby mirrors checkReturnToLoby', () => {
    const elevator = new Elevator();
    elevator.currentFloor = 5;

    assert.equal(elevator.checkReturnToLobby(9), true);
    assert.equal(elevator.checkReturnToLobby(13), false);
  });

  it('returnToLoby moves the elevator back to the lobby', () => {
    const elevator = new Elevator();
    elevator.currentFloor = 4;

    assert.equal(elevator.returnToLoby(), 0);
    assert.equal(elevator.currentFloor, 0);
  });

  it('returnToLobby mirrors returnToLoby', () => {
    const elevator = new Elevator();
    elevator.currentFloor = 3;

    assert.equal(elevator.returnToLobby(), 0);
    assert.equal(elevator.currentFloor, 0);
  });

  it('recordEvent appends a custom event to history', () => {
    const elevator = new Elevator();

    elevator.recordEvent('custom', { detail: 'tracked' });

    assert.deepEqual(elevator.history[0], {
      type: 'custom',
      detail: 'tracked'
    });
  });

  it('snapshot returns a serializable view of the current state', () => {
    const elevator = new Elevator();
    elevator.addRequest(new Person('Kai', 1, 4));
    elevator.addRider(new Person('Mina', 3, 6));

    const snapshot = elevator.snapshot();

    assert.equal(snapshot.currentFloor, 0);
    assert.equal(snapshot.requests.length, 1);
    assert.equal(snapshot.riders.length, 1);
    assert.equal(snapshot.strategy, 'fifo');
  });

  it('reset clears the elevator state', () => {
    const elevator = new Elevator();
    elevator.addRequest(new Person('Kai', 1, 4));
    elevator.addRider(new Person('Mina', 3, 6));
    elevator.currentFloor = 7;
    elevator.stops = 3;
    elevator.floorsTraversed = 8;
    elevator.completedRides.push(new Person('Done', 0, 0));
    elevator.recordEvent('custom', { detail: 'tracked' });

    elevator.reset();

    assert.equal(elevator.currentFloor, 0);
    assert.equal(elevator.stops, 0);
    assert.equal(elevator.floorsTraversed, 0);
    assert.deepEqual(elevator.requests, []);
    assert.deepEqual(elevator.riders, []);
    assert.deepEqual(elevator.completedRides, []);
    assert.deepEqual(elevator.history, []);
  });
});

describe('Challenge levels', () => {
  it('covers the level 2 ride scenarios and core counters', () => {
    const upElevator = new Elevator();
    upElevator.addRequest(new Person('Person A', 2, 5));
    upElevator.goToFloor(upElevator.requests[0], { hour: 9 });

    assert.equal(upElevator.currentFloor, 0);
    assert.equal(upElevator.floorsTraversed, 10);
    assert.equal(upElevator.stops, 2);

    const downElevator = new Elevator();
    downElevator.addRequest(new Person('Person A', 8, 3));
    downElevator.goToFloor(downElevator.requests[0], { hour: 13 });

    assert.equal(downElevator.currentFloor, 3);
    assert.equal(downElevator.floorsTraversed, 13);
    assert.equal(downElevator.stops, 2);
  });

  it('covers the named level 4 example with Bob and Sue in request order', () => {
    const elevator = new Elevator();
    elevator.loadRequests(createPeople([
      ['Bob', 3, 9],
      ['Sue', 6, 2]
    ]));

    elevator.dispatch({ strategy: 'fifo', hour: 13 });

    assert.equal(elevator.completedRides[0].name, 'Bob');
    assert.equal(elevator.completedRides[1].name, 'Sue');
    assert.equal(elevator.currentFloor, 2);
  });

  it('processes requests in first-come, first-served order for levels 4 and 5', () => {
    for (const scenario of benchmarkScenarios) {
      const { elevator } = createScenarioRunner('fifo', scenario.people);

      assert.equal(elevator.floorsTraversed, scenario.fifoFloors);
      assert.equal(elevator.stops, 4);
      assert.equal(elevator.requests.length, 0);
      assert.equal(elevator.riders.length, 0);
      assert.equal(elevator.completedRides.length, 2);
    }
  });

  it('handles the level 6 return-to-lobby rule before noon and the stay-put rule after noon', () => {
    const morning = new Elevator();
    morning.addRequest(new Person('Brittany', 2, 5));
    morning.goToFloor(morning.requests[0], { hour: 9 });

    assert.equal(morning.currentFloor, 0);

    const afternoon = new Elevator();
    afternoon.addRequest(new Person('Brittany', 2, 5));
    afternoon.goToFloor(afternoon.requests[0], { hour: 13 });

    assert.equal(afternoon.currentFloor, 5);
  });

  it('compares the optimized strategy against each level 7 benchmark scenario individually', () => {
    for (const scenario of benchmarkScenarios) {
      const fifo = createScenarioRunner('fifo', scenario.people).elevator;
      const optimized = createScenarioRunner('optimized', scenario.people).elevator;

      assert.equal(fifo.floorsTraversed, scenario.fifoFloors);
      assert.equal(optimized.floorsTraversed, scenario.optimizedFloors);
      assert.ok(optimized.floorsTraversed <= fifo.floorsTraversed);
    }
  });
});
