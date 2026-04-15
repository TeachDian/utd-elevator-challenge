let nextPersonId = 1;

function normalizeFloor(value, fieldName) {
  const floor = Number(value);

  if (!Number.isInteger(floor) || floor < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return floor;
}

export default class Person {
  constructor(name, currentFloor, dropOffFloor, options = {}) {
    this.id = options.id ?? `person-${nextPersonId++}`;
    this.name = String(name ?? '').trim() || 'Anonymous';
    this.currentFloor = normalizeFloor(currentFloor, 'currentFloor');
    this.dropOffFloor = normalizeFloor(dropOffFloor, 'dropOffFloor');
  }

  get direction() {
    if (this.dropOffFloor === this.currentFloor) {
      return 0;
    }

    return this.dropOffFloor > this.currentFloor ? 1 : -1;
  }

  clone() {
    return new Person(this.name, this.currentFloor, this.dropOffFloor, { id: this.id });
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      currentFloor: this.currentFloor,
      dropOffFloor: this.dropOffFloor
    };
  }

  static from(value) {
    if (value instanceof Person) {
      return value.clone();
    }

    if (!value || typeof value !== 'object') {
      throw new Error('Person input must be an object.');
    }

    return new Person(value.name, value.currentFloor, value.dropOffFloor, { id: value.id });
  }
}
