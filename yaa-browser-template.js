(function (global) {
  ___CONTEXT___

  ___MODULE___

  Context.Module = Module;

  var pendingCounter = 0;

  Context.prototype.loadModule = function (mod) {
    var node = document.createElement('script');
    node.async = true;
    node.charset = 'utf-8';
    mod.node = node;
    node.setAttribute('src', mod.uri);
    node._yaajsModule = mod;
    node.addEventListener('load', onLoad);
    if (++pendingCounter === 1)
      window.addEventListener('error', onLoad, true);

    document.head.appendChild(node);
  };

  Context.prototype.undef = function (mod) {
    mod.node &&
      mod.node.parentNode.removeChild(mod.node);
  };

  global.define = Module.define;

  function onLoad(event) {
    var script = event.target !== window && event.target;
    if (! script) {
      var fn = event.filename;
      if (fn) {
        var scripts = document.head.getElementsByTagName('script');
        for(var i = 0; i < scripts.length; ++i) {
          script = scripts[i];
          if (script._yaajsModule && script.src === fn) {
            break;
          }
        }
      }
      if (! script) return;
    }
    var mod = script._yaajsModule;
    if (! mod) return;
    script._yaajsModule = null;
    script.removeEventListener('load', onLoad);
    if (--pendingCounter === 0) {
      window.removeEventListener('error', onLoad, true);
    }
    if (event.type === 'error') {
      var error = mod.error(event.message || 'load error', 'onload');
      error.event = event;
    }
    loadComplete.call(mod, event);
  }

  function loadComplete(event) {
    var mod = this;
    var node = mod.node;


    if (mod.state > Module.LOADING || mod.state < 0)
      return;

    if (event.type === 'error') {
      var error = mod.error(event.message || 'load error', 'onload');
      error.event = event;
      mod && mod.handleError(error);
      return;
    }

    var gdr = Module._globalDefineResult;
    Module._globalDefineResult = null;
    if (gdr)
      Module._prepareDefine(mod, gdr[1], gdr[2], gdr[3]);
    else
      return mod._nodefine();
  }

  var yaaScript = document.querySelector('script[data-main]');
  var mainModuleId = yaaScript && yaaScript.getAttribute('data-main');
  if (mainModuleId) {
    var slashPos = mainModuleId.lastIndexOf("/");
    var baseUrl = slashPos === -1 ? '.' : mainModuleId.slice(0, slashPos);
    mainModuleId = mainModuleId.slice(slashPos+1).replace(/\.js$/, '');
  }
  var mainCtx = Module.currentCtx = new Context({baseUrl: baseUrl || './'});

  global.yaajs = mainCtx.require;
  global.yaajs.config = mainCtx.config.bind(mainCtx);

  if (mainModuleId) {
    mainCtx.paused = true;
    mainModuleId = mainCtx.normalizeId(mainModuleId);
    setTimeout(function () {
      if (! mainCtx.modules[mainModuleId]) {
        mainCtx.loadModule(new Module(mainCtx, mainModuleId));
      }
      Module.loadPaused(mainCtx);
    }, 0);
  }
}).call(null, this);
