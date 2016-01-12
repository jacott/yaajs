/*global yaajs*/
define(function(require, exports, module) {
  var ctx = module.ctx;
  var Module = module.constructor;

  return function (expect) {
    describe(module.id, function () {
      var myCtx, mods, v;
      function callback(foo) {v.callback = foo};
      function body(mod, a1, a2, a3, a4) {
        var args = new Array(arguments.length - 1);
        for(var i = 1; i < arguments.length; ++i) args[i-1] = arguments[i];
        var modId = mod.id;
        v.results[modId] = args;
        return 'result_'+modId;
      };

      beforeEach(function () {
        v = {};
        v.loadModule = [];
        v.results = [];
        myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        myCtx.loadModule = function (mod) {
          v.loadModule.push(mod);
        };
        mods = myCtx.modules;
      });
      afterEach(function () {
        ctx.constructor.remove("my ctx");
      });

      it("should unload correctly", function () {
        depGraph("1d2,6,7,10 2d4,3 3d4,5 4d3");

        depGraph("8d9,10");

        prepare(mods.m6);

        myCtx.onError = function (err) {};
        mods.m5._error("foo");

        expect(myCtx.resolvingCount).to.be(3);
        expect(myCtx.depCount).to.be(2);
        expect(mods.m6.dependants).to.eql({});
        expect(Object.keys(myCtx.waitReady)).to.eql(['m8']);
      });

      it("will throw exception if ensureAcyclic", function () {
        myCtx.config({ensureAcyclic: true});

        try {
          depGraph("1d2 2d1");
        } catch(ex) {
          expect(ex.message).to.be('Module: m2 - Cycle detected to m1');
          return;
        }
        expect().to.fail("should have thrown exception");
      });

      it("can add a dependency to a module", function () {
        depGraph("1");
        var mod = mods.m1;
        mod.dependOn("flux");
        expect(mods.flux.dependants.m1).to.be(1);
        expect(mod.depMap.flux).to.be(1);
        expect(mod.depMap['data/dep2']).to.not.be.ok();
        mod.dependOn('./data/dep2');
        expect(mod.depMap['data/dep2']).to.be(1);
        expect(mods['data/dep2'].dependants.m1).to.be(1);
      });

      it("will call onError if ensureAcyclic", function () {
        myCtx.config({ensureAcyclic: true});
        myCtx.onError = function (arg1, arg2, arg3, arg4) {v.args = [arg1, arg2, arg3]};

        depGraph("1d2 2d3 3d1");

        expect(v.args[0].message).to.be('Module: m3 - Cycle detected to m1');
        expect(v.args[1].id).to.be('m3');
        expect(v.args[2]).to.be(mods.m1);
      });

      it("should wait for dependants", function () {
        var depMap = depGraph("1d2");
        expect(myCtx.resolvingCount).to.be(1);

        depGraph("3d2,4");
        expect(myCtx.resolvingCount).to.be(2);
        expect(mods.m3.depCount).to.be(2);
        expect(myCtx.depCount).to.be(3);

        prepare(mods.m2);
        expect(myCtx.resolvingCount).to.be(1);
        expect(mods.m2.dependants).to.eql({ m1: 1, m3: 1 });
        expect(mods.m3.depCount).to.be(1);
        expect(mods.m4.dependants).to.eql({ m3: 1 });
        expect(v.callback).to.be('result_m1');
        expect(myCtx.depCount).to.be(1);

        prepare(mods.m4);
        expect(mods.m3.depCount).to.be(0);
        expect(myCtx.depCount).to.be(0);
        expect(myCtx.resolvingCount).to.be(0);
        expect(v.callback).to.be('result_m3');
      });

      it("should handle error with cycle", function () {
        var depMap = depGraph("2d3 3d4,5 4d2,5");
        mods.m4.onError = [function (err, m5) {v.err4 = err}];
        mods.m2.onError = [function (err, m) {v.err2 = m.id; mods.m5.state = Module.LOADING}];

        mods.m5._error("foo");
        expect(v.err2).to.be("m2");
        expect(v.err4).to.be("foo");
      });

      it("breaks cycle iff no module loading", function () {
        ++myCtx.loadingCount;
        depGraph("1d2 2d1");
        Module.breakCycle(myCtx);
        expect(myCtx.depCount).to.be(2);
        --myCtx.loadingCount;
        Module.breakCycle(myCtx);
        expect(myCtx.depCount).to.be(0);
      });

      it("should break cycle", function () {
        var depMap = depGraph("1d2 2d4,3 3d4,5 4d3");
        expect(myCtx.resolvingCount).to.be(1);
        expect(myCtx.depCount).to.be(6);
        expect(v.callback).to.be(undefined);
        prepare(mods.m5);
        expect(v.callback).to.eql('result_m1');
        expect(v.results).to.eql({
          m5: [],
          m3: [ undefined, 'result_m5' ],
          m4: [ 'result_m3' ],
          m2: [ 'result_m4', 'result_m3' ],
          m1: [ 'result_m2' ] });
        expect(mods.m4.dependants).to.eql({ m2: 1, m3: 0 });
      });

      function prepare(mod, deps) {
        v.loadModule = [];
        Module._prepare(mod, ['module'].concat(deps||[]), body);
        return v.loadModule;
      }

      function depGraph(pattern) {
        var loads = pattern.split(' ');

        var depMap = {};
        var loadOrder = loads.map(function (node) {
          node = node.split('d');
          var id = 'm'+node[0];
          depMap[id] = (node[1] || '').split(',').map(function (d) {return 'm'+d});
          return id;
        });

        myCtx.require(loadOrder[0], callback);
        var modules = myCtx.modules;
        loadOrder.forEach(function (id) {
          var mod = modules[id];
          prepare(mod, depMap[id]);
        });

        return depMap;
      }
    });
  };
});
