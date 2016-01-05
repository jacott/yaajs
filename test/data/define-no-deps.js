/*global yaajs*/
define(function () {
  var mod = yaajs.module.ctx.modules['data/define-no-deps'];
  if (mod.hasOwnProperty('exports')) return "module should not have exports";
  return "success";
});
