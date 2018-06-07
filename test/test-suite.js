define(function(require, exports, module) {
  return function (expect) {
    require('context-test')(expect);
    require('dependancy-test')(expect);
    require('define-test')(expect);
    require('require-test')(expect);
    require('config-test')(expect);
    require('plugin-test')(expect);
    require('graph-test')(expect);
    require('pause-test')(expect);
  };
});
