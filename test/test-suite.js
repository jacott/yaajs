define(function(require, exports, module) {
  return function (expect) {
    require('context-test')(expect);
    require('define-test')(expect);
    require('require-test')(expect);
    require('config-test')(expect);
    require('plugin-test')(expect);
  };
});
