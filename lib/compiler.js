"use strict";
const Context = require('./context');
const Module = require('./module');
Context.Module = Module;
const path = require('path');
const fs = require('fs');
const yaajs = require('./index');
const terser = require('terser');

Context.setGlobalName('requirejs');

const runtimePluginFetch = Module.Plugin.prototype.fetch;

const filename = mod => `/${mod.id}.js`;

module.exports.terser = terser;

const compile = module.exports.compile = ({
  name, toplevel, onBuildRead, hierarchy, contextConfig, callback
})=>{
  const runtimeCtx = yaajs.config(contextConfig);
  const origMainCtx = Module.mainCtx;
  const compileCtx = Module.mainCtx = new Context(contextConfig);
  compileCtx.loadModule = function (mod) {
    const oldCtx = Module.currentCtx;
    const ctx = Module.currentCtx = this;
    try {
      const contents = fs.readFileSync(mod.uri);

      parseContents(mod, (
        onBuildRead !== void 0 ?
          onBuildRead(mod, contents) : contents).toString());

    } catch(ex) {
      throw ex;
    } finally {
      Module.currentCtx = oldCtx;
    }
  };

  const parse = (codeIn, codeFilename)=> {
    try {
      return terser.parse(codeIn, {filename: codeFilename});
    } catch (ex) {
      if (ex.filename && ex.line) {
        const m = /^(.*)+\s\((\d+:\d+)\)/.exec(ex.message);
        throw new SyntaxError(`${m[1]}\n    at ${codeFilename}:${m[2]}`);
      } else
        throw ex;
    }
  };

  const addCode = (ast, mod) =>{
    if (toplevel === void 0)
      toplevel = ast;
    else {
      const b = ast.body;
      const {body} = toplevel;
      for(let i = 0; i < b.length; ++i) {
        body.push(b[i]);
      }
    }
  };

  const globalDefine = global.define;
  global.define = Module.define;

  const _comp = () =>{
    global.define = globalDefine; // restore define in global environment

    callback({ast: toplevel, name});

    toplevel = void 0;

    global.define = Module.define;
  };

  const origPluginfetch = Module.Plugin.prototype.fetch;
  Module.Plugin.prototype.fetch = function (name, parent) {
    const pluginMod = this.mod;
    if (pluginMod.ctx !== compileCtx) return runtimePluginFetch.call(this, name, parent);

    let loader, loaderMod;

    const loaderCallback = (arg, mod)=>{loader = arg, loaderMod = mod};
    runtimeCtx.require(pluginMod.id, loaderCallback);
    if (loader.pluginBuilder) {
      runtimeCtx.require(loaderMod.normalizeId(loader.pluginBuilder), loaderCallback);
    }
    name = loader.normalize ? loader.normalize(name, parent) : parent.normalizeId(name);
    const id = pluginMod.id+'!'+name;
    const modules = pluginMod.ctx.modules;
    const resMod = modules[id];

    if (resMod) return resMod;

    const mod = new Module(pluginMod.ctx, id, Module.WAIT_PLUGIN);

    const onLoad = value =>{
      if (value !== void 0)
        mod.exports = value;
      mod.state = Module.READY;
      Module._informDependants(mod);
    };

    onLoad.error = ()=>{};
    onLoad.fromText = code =>{parseContents(mod, code)};

    loader.load(name, mod.require, onLoad);

    const onWrite = code =>{
      addCode(parse(code, filename(mod)), mod);
    };
    loader.write && loader.write(pluginMod.id, name, onWrite);
    return mod;
  };

  const parseContents = (mod, code)=>{
    const ast = parse(code, filename(mod));

    const depsMap = {};
    let deps;

    const addDep = name =>{
      const match = /^([^!]+)!(.*)$/.exec(name);
      if (match) {
        mod.require(name, (_, mod)=>{name = mod.id});
      }
      name = mod.normalizeId(name);
      if (name && ! depsMap[name]) {
        depsMap[name] = true;
        deps.push(name);
      }
    };

    const lookForReq = node =>{
      node.walk(new terser.TreeWalker(node => {
        if (node.TYPE === 'Call' && node.expression.name === 'require' &&
            node.args.length === 1) {
          const arg = node.args[0];
          if (arg.TYPE === 'String')
            addDep(arg.value);
        }
      }));
    };

    let stopWalkingParent = null;

    const walker = new terser.TreeWalker(node => {
      if (stopWalkingParent === walker.parent()) return true;
      if (node.TYPE === 'Call' &&
          node.expression.TYPE === 'SymbolRef' && node.expression.name === 'define') {
        let [name, deps1, body] = node.args;
        if (deps1 === void 0) {
          body = name; name = void 0;
        } else {
          if (body === void 0) {
            body = deps1;
            if (name.TYPE === 'String') {
              deps1 = void 0;
            } else {
              deps1 = name; name = void 0;
            }
          }
        }
        if (name === void 0) name = new terser.AST_String({start: node.start, end: node.end, value: mod.id});

        if (deps1 !== void 0) {
          deps = [];
          deps1.elements.forEach(node => addDep(node.value));
        } else if ((body.TYPE === 'Arrow' || body.TYPE === 'Function')
                   && body.argnames.length != 0) {
          deps = [];
          node.args = [name, null, body];
          body.argnames.forEach(node => {
            if (node.TYPE = 'SymbolFunarg')
              /^(?:require|exports|module)$/.test(node.name) &&
              addDep(node.name);
          });
          if (Array.isArray(body.body))
            body.body.forEach(lookForReq);
          else
            lookForReq(body.body);
        }
        if (deps !== void 0) {
          node.args = [
            name,
            new terser.AST_Array({
              start: node.start, end: node.end,
              elements: deps.map(name => new terser.AST_String({start: node.start, end: node.end, value: name})),
            }),
            body];
        } else {
          node.args = [name, body];
        }
        return true;
      } else {
        switch(node.TYPE) {
        case 'SymbolDefun': case 'VarDef':
          if (node.start.value === 'define') {
            stopWalkingParent = walker.parent(1);
            return true;
          }
        }
      }
    });

    ast.walk(walker);


    Module._prepare(mod, deps, ()=>{addCode(ast, mod)});
  };

  try {

    if (hierarchy === void 0) {
      compileCtx.require(name, _comp);

    } else for (const n of hierarchy) {
      name = n;
      compileCtx.require(n, _comp);
    }
  } finally {
    // restore intercepts
    Module.mainCtx = origMainCtx;
    global.define = globalDefine;
    Module.Plugin.prototype.fetch = origPluginfetch;
  }
};
