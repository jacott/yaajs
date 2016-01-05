define(['data/dep2', 'require', 'data/subdir/dep1', 'exports', 'module'], function(dep2, require, dep1, exports, module) {
  if (typeof require !== 'function') return "expected to be passed require";
  if (typeof exports !== 'object') return "expected to be passed exports";
  if (this !== module) return "expected to be passed module";
  if (dep2 !== true) return "expected dep2 to be loaded";
  if (typeof dep1 !== 'function') return "expected dep1 to be loaded";

  exports.success = true;
});
