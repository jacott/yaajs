if (global.globalThis === void 0) global.globalThis = global;
const path = require('path');
const vm = require('vm');
const fs = require('fs');

const Context = require('./context');
const Module = require('./module');

Context.Module = Module;
Context.prototype.undef = ()=>{};

Context.prototype.readFileSync = fs.readFileSync;

Context.prototype.loadModule = function (mod) {
  const oldCtx = Module.currentCtx;
  Module.currentCtx = this;
  try {
    vm.runInThisContext(wrap(mod, this.readFileSync(mod.uri)), {
      filename: mod.uri, displayErrors: true, timeout: 5000});

    if (mod.state > Module.LOADING)
      return;
  } catch(ex) {
    if (ex.code === 'ENOENT') {
      try {
        mod.exports = yaajs.nodeRequire(mod.id);
        mod.state = Module.LOADED;
        this.waitReady[mod.id] = mod;
        mod._ready();
        return;
      } catch(ex2) {
        if (ex2.code !== 'MODULE_NOT_FOUND')
          ex = ex2;
      }
      ex.onload = true;
    }
    ex.module = mod;
    mod._error(ex);
    return;
  } finally {
    Module.currentCtx = oldCtx;
  }

  const gdr = Module._globalDefineResult;
  Module._globalDefineResult = null;
  if (gdr == null) {
    return mod._nodefine();
  }

  Module._prepare(mod, gdr[1], gdr[2], gdr[3]);
};

let globalName = 'yaajs';

const wrap = (mod, code)=> '{const {define, nodeRequire: require, yaajs: '+
      globalName+'} = __yaajsVars__; '+ code +
      '}';

Context.setGlobalName = value =>{globalName = value};

Context._onConfig = ctx =>{
  global.__yaajsVars__ = {
    define: Module.define,
    nodeRequire: ctx.nodeRequire || require,
    yaajs: module.exports,
  };
};

const mainCtx = Module.currentCtx = new Context({baseUrl: __dirname});
const yaajs = module.exports = mainCtx.require;
yaajs.config = mainCtx.config.bind(mainCtx);
