function appendStop(plan, floor, additions = {}) {
  const lastStop = plan.at(-1);
  const stop = lastStop && lastStop.floor === floor
    ? lastStop
    : { floor, pickupIds: [], dropoffIds: [] };

  if (stop !== lastStop) {
    plan.push(stop);
  }

  for (const id of additions.pickupIds ?? []) {
    if (!stop.pickupIds.includes(id)) {
      stop.pickupIds.push(id);
    }
  }

  for (const id of additions.dropoffIds ?? []) {
    if (!stop.dropoffIds.includes(id)) {
      stop.dropoffIds.push(id);
    }
  }

  return stop;
}

function clonePeople(people) {
  return people.map((person) => ({ ...person }));
}

function maskFor(requests) {
  return (1 << requests.length) - 1;
}

function applyFloorActions(floor, pickedMask, droppedMask, requests) {
  let nextPickedMask = pickedMask;
  let nextDroppedMask = droppedMask;
  const pickupIds = [];
  const dropoffIds = [];

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const bit = 1 << index;

    if ((nextPickedMask & bit) === 0 && request.currentFloor === floor) {
      nextPickedMask |= bit;
      pickupIds.push(request.id);
    }
  }

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const bit = 1 << index;

    if ((nextPickedMask & bit) !== 0 && (nextDroppedMask & bit) === 0 && request.dropOffFloor === floor) {
      nextDroppedMask |= bit;
      dropoffIds.push(request.id);
    }
  }

  return {
    pickedMask: nextPickedMask,
    droppedMask: nextDroppedMask,
    stop: pickupIds.length || dropoffIds.length
      ? { floor, pickupIds, dropoffIds }
      : null
  };
}

function remainingCandidateFloors(floor, pickedMask, droppedMask, requests) {
  const floors = new Set();

  for (let index = 0; index < requests.length; index += 1) {
    const request = requests[index];
    const bit = 1 << index;

    if ((pickedMask & bit) === 0) {
      floors.add(request.currentFloor);
      continue;
    }

    if ((droppedMask & bit) === 0) {
      floors.add(request.dropOffFloor);
    }
  }

  floors.delete(floor);
  return [...floors];
}

function chooseBetterPlan(currentBest, candidate) {
  if (!currentBest) {
    return candidate;
  }

  if (candidate.cost !== currentBest.cost) {
    return candidate.cost < currentBest.cost ? candidate : currentBest;
  }

  if (candidate.plan.length !== currentBest.plan.length) {
    return candidate.plan.length < currentBest.plan.length ? candidate : currentBest;
  }

  for (let index = 0; index < Math.min(candidate.plan.length, currentBest.plan.length); index += 1) {
    if (candidate.plan[index].floor !== currentBest.plan[index].floor) {
      return candidate.plan[index].floor < currentBest.plan[index].floor ? candidate : currentBest;
    }
  }

  return currentBest;
}

export function buildFifoPlan(currentFloor, requests) {
  const plan = [];

  for (const request of requests) {
    appendStop(plan, request.currentFloor, { pickupIds: [request.id] });
    appendStop(plan, request.dropOffFloor, { dropoffIds: [request.id] });
  }

  return plan;
}

export function buildOptimizedPlan(currentFloor, requests) {
  const clonedRequests = clonePeople(requests);
  const memo = new Map();
  const completeMask = maskFor(clonedRequests);

  function solve(floor, pickedMask, droppedMask) {
    const applied = applyFloorActions(floor, pickedMask, droppedMask, clonedRequests);
    const key = `${floor}:${applied.pickedMask}:${applied.droppedMask}`;

    if (memo.has(key)) {
      return memo.get(key);
    }

    if (applied.droppedMask === completeMask) {
      const resolved = {
        cost: 0,
        plan: applied.stop ? [applied.stop] : []
      };

      memo.set(key, resolved);
      return resolved;
    }

    const candidates = remainingCandidateFloors(floor, applied.pickedMask, applied.droppedMask, clonedRequests);
    let best = null;

    for (const nextFloor of candidates) {
      const next = solve(nextFloor, applied.pickedMask, applied.droppedMask);
      const candidate = {
        cost: Math.abs(nextFloor - floor) + next.cost,
        plan: [...(applied.stop ? [applied.stop] : []), ...next.plan]
      };

      best = chooseBetterPlan(best, candidate);
    }

    memo.set(key, best);
    return best;
  }

  return solve(currentFloor, 0, 0).plan;
}

export const dispatchStrategies = {
  fifo: buildFifoPlan,
  optimized: buildOptimizedPlan
};
