define(function(require, exports, module) {
  exports.findPath = function (start, goal) {
    const {modules} = start.ctx;

    const goalId = goal.id;

    if (! start._requires)
      return;

    if (start._requires[goalId] !== undefined)
      return [start, goal];

    const visited = new Map;
    visited.set(start, null);

    function buildRow(prev, row=new Set) {
      const reqs = prev._requires;
      if (! reqs) return row;
      for (let i in reqs)  {
        const mod = modules[i];
        if (! visited.has(mod)) {
          visited.set(mod, prev);
          row.add(mod);
        }
      }
      return row;
    }

    let currentRow = buildRow(start);
    while(currentRow.size) {
      const nextRow = new Set;
      for (let mod of currentRow) {
        if (! mod._requires)
          continue;
        if (mod._requires[goalId] !== undefined) {
          const result = [goal];
          while (mod) {
            result.push(mod);
            mod = visited.get(mod);
          }
          return result.reverse();
        }
      }
      for (let mod of currentRow) {
        buildRow(mod, nextRow);
      }
      currentRow = nextRow;
    }
  };
});
