const requestForm = document.querySelector('#request-form');
const nameInput = document.querySelector('#name');
const currentFloorInput = document.querySelector('#current-floor');
const dropOffFloorInput = document.querySelector('#dropoff-floor');
const strategySelect = document.querySelector('#strategy');
const hourInput = document.querySelector('#hour');
const dispatchButton = document.querySelector('#dispatch');
const demoButton = document.querySelector('#demo');
const resetButton = document.querySelector('#reset');
const requestsList = document.querySelector('#requests-list');
const ridersList = document.querySelector('#riders-list');
const completedList = document.querySelector('#completed-list');
const eventsList = document.querySelector('#events-list');
const building = document.querySelector('#building');
const buildingCaption = document.querySelector('#building-caption');
const metricFloor = document.querySelector('#metric-floor');
const metricStops = document.querySelector('#metric-stops');
const metricTraversed = document.querySelector('#metric-traversed');
const metricCompleted = document.querySelector('#metric-completed');

let currentState = null;
let isPlaying = false;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function getJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function sendJson(url, method, payload = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return response.json();
}

function formatPerson(person) {
  return `${person.name} (${person.currentFloor} -> ${person.dropOffFloor})`;
}

function renderPillList(element, people) {
  element.innerHTML = '';

  if (!people.length) {
    const item = document.createElement('li');
    item.textContent = 'None';
    element.append(item);
    return;
  }

  for (const person of people) {
    const item = document.createElement('li');
    item.textContent = formatPerson(person);
    element.append(item);
  }
}

function renderMetrics(state) {
  metricFloor.textContent = String(state.currentFloor);
  metricStops.textContent = String(state.stops);
  metricTraversed.textContent = String(state.floorsTraversed);
  metricCompleted.textContent = String(state.completedRides.length);
}

function renderBuilding(state) {
  const allFloors = [
    state.currentFloor,
    ...state.requests.map((person) => person.currentFloor),
    ...state.requests.map((person) => person.dropOffFloor),
    ...state.riders.map((person) => person.dropOffFloor),
    ...state.completedRides.map((person) => person.dropOffFloor),
    6
  ];
  const topFloor = Math.max(...allFloors);

  building.innerHTML = '';

  for (let floor = topFloor; floor >= 0; floor -= 1) {
    const floorElement = document.createElement('div');
    floorElement.className = `floor${floor === state.currentFloor ? ' current' : ''}`;

    const number = document.createElement('div');
    number.className = 'floor-number';
    number.textContent = `Floor ${floor}`;

    const shaft = document.createElement('div');
    shaft.className = 'shaft';

    if (floor === state.currentFloor) {
      const car = document.createElement('div');
      car.className = 'car';
      car.textContent = `Elevator - ${state.riders.length} rider${state.riders.length === 1 ? '' : 's'}`;
      shaft.append(car);
    }

    const waiting = document.createElement('div');
    waiting.className = 'shaft-requests';

    for (const person of state.requests.filter((request) => request.currentFloor === floor)) {
      const label = document.createElement('span');
      label.textContent = `${person.name} -> ${person.dropOffFloor}`;
      waiting.append(label);
    }

    shaft.append(waiting);
    floorElement.append(number, shaft);
    building.append(floorElement);
  }
}

function renderEvents(items) {
  eventsList.innerHTML = '';

  if (!items.length) {
    const item = document.createElement('li');
    item.textContent = 'No elevator activity yet.';
    eventsList.append(item);
    return;
  }

  for (const entry of items) {
    const item = document.createElement('li');
    item.textContent = entry;
    eventsList.append(item);
  }
}

function renderState(state, events = []) {
  currentState = clone(state);
  renderMetrics(state);
  renderBuilding(state);
  renderPillList(requestsList, state.requests);
  renderPillList(ridersList, state.riders);
  renderPillList(completedList, state.completedRides);
  renderEvents(events);
  buildingCaption.textContent = state.requests.length || state.riders.length
    ? `${state.requests.length} pending request(s), ${state.riders.length} active rider(s).`
    : 'No active requests. The elevator is idle.';
}

function updateControls(disabled) {
  isPlaying = disabled;
  requestForm.querySelector('button').disabled = disabled;
  dispatchButton.disabled = disabled;
  demoButton.disabled = disabled;
  resetButton.disabled = disabled;
  strategySelect.disabled = disabled;
  hourInput.disabled = disabled;
  nameInput.disabled = disabled;
  currentFloorInput.disabled = disabled;
  dropOffFloorInput.disabled = disabled;
}

function applyEvent(state, event) {
  if (event.type === 'move') {
    state.currentFloor = event.floor;
    state.floorsTraversed += 1;
  }

  if (event.type === 'stop') {
    state.currentFloor = event.floor;
    state.stops += 1;

    for (const person of event.pickups) {
      state.requests = state.requests.filter((request) => request.id !== person.id);
      state.riders.push(person);
    }

    for (const person of event.dropoffs) {
      state.riders = state.riders.filter((rider) => rider.id !== person.id);
      state.completedRides.push(person);
    }
  }
}

function describeEvent(event) {
  if (event.type === 'move') {
    return `Elevator moved ${event.direction} to floor ${event.floor}.`;
  }

  if (event.type === 'idle-return') {
    return `Elevator returned to the lobby because it was idle before noon.`;
  }

  const parts = [];

  if (event.pickups.length) {
    parts.push(`picked up ${event.pickups.map((person) => person.name).join(', ')}`);
  }

  if (event.dropoffs.length) {
    parts.push(`dropped off ${event.dropoffs.map((person) => person.name).join(', ')}`);
  }

  return `At floor ${event.floor}, the elevator ${parts.join(' and ')}.`;
}

function wait(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function playDispatch(result) {
  updateControls(true);

  const state = clone(result.before);
  const eventLines = [];

  renderState(state, eventLines);

  for (const event of result.events) {
    applyEvent(state, event);
    eventLines.push(describeEvent(event));
    renderState(state, eventLines);
    await wait(event.type === 'move' ? 180 : 360);
  }

  renderState(result.after, eventLines);
  updateControls(false);
}

async function refresh() {
  const [state, strategies] = await Promise.all([
    getJson('/api/state'),
    getJson('/api/strategies')
  ]);

  if (!strategySelect.options.length) {
    for (const strategy of strategies) {
      const option = document.createElement('option');
      option.value = strategy;
      option.textContent = strategy;
      strategySelect.append(option);
    }
  }

  strategySelect.value = state.strategy;
  hourInput.value = String(state.hour);
  renderState(state);
}

async function addDemoRequests() {
  await sendJson('/api/reset', 'POST');

  const sample = [
    { name: 'Alex', currentFloor: 3, dropOffFloor: 8 },
    { name: 'Sam', currentFloor: 1, dropOffFloor: 5 },
    { name: 'Nina', currentFloor: 6, dropOffFloor: 2 }
  ];

  for (const request of sample) {
    await sendJson('/api/requests', 'POST', request);
  }

  await refresh();
}

requestForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isPlaying) {
    return;
  }

  await sendJson('/api/requests', 'POST', {
    name: nameInput.value,
    currentFloor: Number(currentFloorInput.value),
    dropOffFloor: Number(dropOffFloorInput.value)
  });

  requestForm.reset();
  currentFloorInput.value = '0';
  dropOffFloorInput.value = '1';
  await refresh();
});

dispatchButton.addEventListener('click', async () => {
  if (isPlaying) {
    return;
  }

  const result = await sendJson('/api/dispatch', 'POST', {
    strategy: strategySelect.value,
    hour: Number(hourInput.value)
  });

  await playDispatch(result);
});

demoButton.addEventListener('click', async () => {
  if (isPlaying) {
    return;
  }

  await addDemoRequests();
});

resetButton.addEventListener('click', async () => {
  if (isPlaying) {
    return;
  }

  await sendJson('/api/reset', 'POST');
  await refresh();
});

refresh();
