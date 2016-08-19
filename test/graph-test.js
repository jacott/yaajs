define(function(require, exports, module) {
  /**
   * Helper utility for traversing module graphs
   **/
  var graph = require('graph');
  var modBuilder = require('./mod-builder');

  var ctx = module.ctx;

  var modules = module.ctx.modules;
  var depGraph;
  var myCtx, mods, v;

  return function (expect) {
    describe(module.id, function () {
      beforeEach(function () {
        v = {};
        myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        mods = myCtx.modules;
        depGraph = modBuilder(myCtx, v).depGraph;
      });
      afterEach(function () {
        ctx.constructor.remove("my ctx");
        v = null;
      });

      describe('findPath', function () {
        /**
         * Finds shortest dependency path from one module to another
         * module that it (indirectly) requires.
         *
         * @param start the module to start from
         * @param goal the module to look for
         * @returns {Array} from `start` to `goal`
         **/
        it("can find direct path", function () {
          const ans = graph.findPath(module, modules['graph']).map(m => m.id);
          expect(ans).to.eql(['graph-test', 'graph']);
        });

        it("can find simple direct path", function () {
          depGraph("1d2 2d3");
          const ans = graph.findPath(mods.m1, mods.m3).map(m => m.id);
          expect(ans).to.eql(['m1', 'm2', 'm3']);
        });

        it("can find shortest path", function () {
          depGraph("1d2,3,4 3d4 4d8 5d6,7 8d7");
          const ans = graph.findPath(mods.m1, mods.m7).map(m => m.id);
          expect(ans).to.eql(['m1', 'm4', 'm8', 'm7']);
        });

        it("can't find path", function () {
          depGraph("1d2,3 2d3");

          expect(graph.findPath(mods.m2, mods.m1)).to.be(undefined);
          expect(graph.findPath(mods.m3, mods.m2)).to.be(undefined);
        });
      });

      describe('isRequiredBy', function () {
        /**
         * Test if `supplier` is required by `user`.
         *
         * @param supplier the module to look for
         * @param user the module to start from
         * @returns {boolean} true if path found from user to supplier
         **/

        it("can find direct path", function () {
          expect(graph.isRequiredBy(modules['graph'], module)).to.be(true);
          expect(graph.isRequiredBy(module, modules['graph'])).to.be(false);
        });

        it("can find shortest path", function () {
          depGraph("1d2,3,4 3d4 4d8 5d6,7 8d7");
          expect(graph.isRequiredBy(mods.m7, mods.m1)).to.be(true);
        });

        it("can't find path", function () {
          depGraph("1d2,3 2d3");

          expect(graph.isRequiredBy(mods.m1, mods.m2)).to.be(false);
          expect(graph.isRequiredBy(mods.m2, mods.m3)).to.be(false);
        });
      });
    });
  };

});
