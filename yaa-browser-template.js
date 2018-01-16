(global =>{
  ___INSERT___

  Context.Module = Module;

  let pendingCounter = 0;

  Context.prototype.loadModule = function (mod) {
    const node = document.createElement('script');
    node.async = true;
    node.charset = 'utf-8';
    mod.node = node;
    node.setAttribute('src', mod.uri);
    node._yaajsModule = mod;
    node.addEventListener('load', onLoad);
    if (++pendingCounter === 1)
      window.addEventListener('error', onLoad, true);

    ++mod.ctx.loadingCount;
    document.head.appendChild(node);
  };

  Context.prototype.undef = function (mod) {
    mod.node &&
      mod.node.parentNode.removeChild(mod.node);
  };

  global.define = Module.define;

  const onLoad = event =>{
    const script = event.target !== window && event.target;
    if (script == null) {
      const fn = event.filename;
      if (fn != null) {
        const scripts = document.head.getElementsByTagName('script');
        for(let i = 0; i < scripts.length; ++i) {
          script = scripts[i];
          if (script._yaajsModule && script.src === fn) {
            break;
          }
        }
      }
      if (script == null) return;
    }
    const mod = script._yaajsModule;
    if (mod === undefined) return;
    script._yaajsModule = undefined;
    script.removeEventListener('load', onLoad);
    if (--pendingCounter === 0) {
      window.removeEventListener('error', onLoad, true);
    }
    loadComplete.call(mod, event);

    if (--mod.ctx.loadingCount === 0)
      Module.breakCycle(mod.ctx);
  };

  function loadComplete(event) {
    const {node} = this;

    if (this.state > Module.LOADING || this.state < 0)
      return;

    if (event.type === 'error') {
      const error = this.newError(event.message || 'failed to load', event.message || 'onload');
      error.event = event;
      this._error(error);
      return;
    }

    const gdr = Module._globalDefineResult;
    Module._globalDefineResult = undefined;
    if (gdr !== undefined)
      Module._prepare(this, gdr[1], gdr[2], gdr[3]);
    else
      return this._nodefine();
  }

  const yaaScript = document.querySelector('script[data-main]');
  let mainModuleId = yaaScript && yaaScript.getAttribute('data-main');
  let baseUrl;
  if (mainModuleId != null) {
    const slashPos = mainModuleId.lastIndexOf("/");
    baseUrl = slashPos === -1 ? '.' : mainModuleId.slice(0, slashPos);
    mainModuleId = mainModuleId.slice(slashPos+1).replace(/\.js$/, '');
  }
  const mainCtx = Module.currentCtx = new Context({baseUrl: baseUrl || './'});

  global.yaajs = mainCtx.require;
  global.yaajs.config = mainCtx.config.bind(mainCtx);

  if (mainModuleId != null) {
    mainCtx.paused = true;
    mainModuleId = mainCtx.normalizeId(mainModuleId);
    setTimeout(()=>{
      if (! mainCtx.modules[mainModuleId]) {
        mainCtx.loadModule(new Module(mainCtx, mainModuleId));
      }
      Module._unpause(mainCtx);
    }, 0);
  }
}).call(null, window);
