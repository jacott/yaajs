define((require, exports, module)=> (expect)=>{
  require('context-test')(expect);
  require('dependancy-test')(expect);
  require('define-test')(expect);
  require('require-test')(expect);
  require('config-test')(expect);
  require('plugin-test')(expect);
  require('graph-test')(expect);
  require('pause-test')(expect);
});
