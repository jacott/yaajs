/*global yaajs*/
define(function(require, exports, module) {
  var modBuilder = require('./mod-builder');

  var ctx = module.ctx;
  var Module = module.constructor;

  return function (expect) {
    describe(module.id, function () {
      var myCtx, mods, v;
      var prepare, depGraph;

      beforeEach(function () {
        v = {};
        myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        mods = myCtx.modules;
        var mb = modBuilder(myCtx, v);
        depGraph = mb.depGraph;
        prepare = mb.prepare;
      });
      afterEach(function () {
        ctx.constructor.remove("my ctx");
      });

      it("should depend on a ready module", function () {
        depGraph("3d2");

        mods.m2._ready();

        depGraph("1d2");

        expect(mods.m1.state).to.be(Module.READY);
        expect(mods.m3.state).to.be(Module.READY);

        expect(mods.m2._requiredBy).to.eql({ m3: 1, m1: 1 });
      });

      it("should unload correctly", function () {
        depGraph("1d2,6,7,10 2d4,3 3d4,5 4d3");

        depGraph("8d9,10");

        prepare(mods.m6);

        myCtx.onError = function (err) {};
        mods.m5._error("foo");

        expect(myCtx.resolvingCount).to.be(3);
        expect(myCtx.depCount).to.be(2);
        expect(mods.m6._requiredBy).to.eql({});
        expect(Object.keys(myCtx.waitReady)).to.eql(['m8']);
      });

      it("will throw exception if enforceAcyclic", function () {
        myCtx.config({enforceAcyclic: true});

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
        expect(mods.flux._requiredBy.m1).to.be(1);
        expect(mod._requires.flux).to.be(1);
        expect(mod._requires['data/dep2']).to.not.be.ok();
        mod.dependOn('./data/dep2');
        expect(mod._requires['data/dep2']).to.be(1);
        expect(mods['data/dep2']._requiredBy.m1).to.be(1);
      });

      it("will call onError if enforceAcyclic", function () {
        myCtx.config({enforceAcyclic: true});
        myCtx.onError = function (arg1, arg2, arg3, arg4) {v.args = [arg1, arg2, arg3]};

        depGraph("1d2 2d3 3d1");

        expect(v.args[0].message).to.be('Module: m3 - Cycle detected to m1');
        expect(v.args[1].id).to.be('m3');
        expect(v.args[2]).to.be(mods.m1);
      });

      it("should wait for _requiredBy", function () {
        var _requires = depGraph("1d2");
        expect(myCtx.resolvingCount).to.be(1);

        depGraph("3d2,4");
        expect(myCtx.resolvingCount).to.be(2);
        expect(mods.m3.depCount).to.be(2);
        expect(myCtx.depCount).to.be(3);

        prepare(mods.m2);
        expect(myCtx.resolvingCount).to.be(1);
        expect(mods.m2._requiredBy).to.eql({ m1: 1, m3: 1 });
        expect(mods.m3.depCount).to.be(1);
        expect(mods.m4._requiredBy).to.eql({ m3: 1 });
        expect(v.callback).to.be('result_m1');
        expect(myCtx.depCount).to.be(1);

        prepare(mods.m4);
        expect(mods.m3.depCount).to.be(0);
        expect(myCtx.depCount).to.be(0);
        expect(myCtx.resolvingCount).to.be(0);
        expect(v.callback).to.be('result_m3');
      });

      it("should handle error with cycle", function () {
        var _requires = depGraph("2d3 3d4,5 4d2,5");
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
        var _requires = depGraph("1d2 2d4,3 3d4,5 4d3");
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
        expect(mods.m4._requiredBy).to.eql({ m2: 1, m3: 0 });
      });
    });
  };
});
