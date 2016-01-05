define(function(require, exports, module) {
  var dep2 = require('../dep2');

  module.onUnload(function () {dep1.testUnload = true});

  var count = 0;

  return dep1;

  function dep1() {
    var name = "data/dep2"; // same module; different id form
    return dep2 === require(name) && ++count === 1;
  };
});
