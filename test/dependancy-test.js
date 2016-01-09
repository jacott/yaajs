/*global yaajs*/
define(function(require, exports, module) {
  var ctx = module.ctx;
  var Module = module.constructor;

  return function (expect) {
    describe(module.id, function () {
      var myCtx, mods, v = {};
      v.loadModule = [];
      v.results = [];
      function callback(foo) {v.callback = foo};
      function body(a1, a2, a3, a4) {
        var args = new Array(arguments.length);
        for(var i = 0; i < args.length; ++i) args[i] = arguments[i];
        var modId = this.id;
        v.results[modId] = args;
        return 'result_'+modId;
      };

      beforeEach(function () {
        myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        myCtx.loadModule = function (mod) {
          v.loadModule.push(mod);
        };
        mods = myCtx.modules;
      });
      afterEach(function () {
        ctx.constructor.remove("my ctx");
      });

      it("should wait for dependants", function () {
        var depMap = depGraph("1d2");
        expect(myCtx.waitLoaded).to.be(1);

        depGraph("3d2,4");
        expect(myCtx.waitLoaded).to.be(2);
        expect(mods.m3.depCount).to.be(2);
        expect(myCtx.depCount).to.be(3);

        prepare(mods.m2);
        expect(myCtx.waitLoaded).to.be(1);
        expect(mods.m2.dependants).to.eql({ m1: 1, m3: 1 });
        expect(mods.m3.depCount).to.be(1);
        expect(mods.m4.dependants).to.eql({ m3: 1 });
        expect(v.callback).to.be('result_m1');
        expect(myCtx.depCount).to.be(1);

        prepare(mods.m4);
        expect(mods.m3.depCount).to.be(0);
        expect(myCtx.depCount).to.be(0);
        expect(myCtx.waitLoaded).to.be(0);
        expect(v.callback).to.be('result_m3');
      });

      it("should handle error with cycle", function () {
        var depMap = depGraph("2d3 3d4,5 4d2,5");
        mods.m4.onError = [function (err, m5) {v.err4 = err}];
        mods.m2.onError = [function (err, m) {v.err2 = m.id; mods.m5.state = Module.LOADING}];

        mods.m5.handleError("foo");
        expect(v.err2).to.be("m2");
        expect(v.err4).to.be("foo");
      });

      it("should break cycle", function () {
        var depMap = depGraph("1d2 2d4,3 3d4,5 4d3");
        expect(myCtx.waitLoaded).to.be(1);
        expect(myCtx.depCount).to.be(6);
        expect(v.callback).to.be('result_m3');
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
        Module._prepareDefine(mod, deps, body);
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
