/*global yaajs*/
define(function(require, exports, module) {
  var simple = require('data/simple-plugin!./subdir/../flux');

  var ctx = module.ctx;
  var Module = module.constructor;

  return function (expect) {

    describe(module.id, function () {
      afterEach(function () {
        ctx.constructor.remove("my ctx");
      });

      it("uses normalizeId by default", function () {
        expect(simple).to.be("simple flux");
      });

      it("handles errors", function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        myCtx.require('data/error-plugin!foo', function () {
          done(new Error("unexpected"));
        }, function (error) {
          try {
            expect(error.message).to.be("Module: data/error-plugin!foo - foo");
            done();
          } catch(ex) {
            done(ex);
          }
        });
      });

      it("maps un-normalized correctly", function () {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        var pmod = new Module(myCtx, 'foo');
        var caller = new Module(myCtx, 'baz');
        var loadCount = 0;
        pmod.exports = {load: function (name, req, onLoad) {
          ++loadCount;
        }};
        var plugin = new Module.Plugin(pmod);
        var myMod = plugin.fetch("./unnorm", caller);
        var myMod2 = plugin.fetch("unnorm");
        expect(myCtx.resolvingCount).to.be(2);
        expect(myMod.id).to.equal('');
        expect(plugin.waiting['baz']['./unnorm'][0]).to.be(caller);
        expect(plugin.waiting['baz']['./unnorm'][1]).to.be(myMod);
        expect(plugin.waiting['']['unnorm'][0]).to.be(undefined);
        expect(plugin.waiting['']['unnorm'][1]).to.be(myMod2);

        var otherMod1 = new Module(myCtx, 'otherMod1');
        var otherMod2 = new Module(myCtx, 'otherMod2');
        myMod.addDependancy(otherMod1);
        myMod2.addDependancy(otherMod2);

        plugin.ready();

        expect(loadCount).to.equal(1);

        expect(myMod.dependants).to.eql({ otherMod1: 1, otherMod2: 1});
        expect(myCtx.resolvingCount).to.equal(5);
        expect(myCtx.depCount).to.equal(0);
      });

      it("calls callbacks", function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        var waitCount = 2;
        myCtx.require('data/foo-plugin!junk/here/fuzz', function (fuzz) {
          try {
            expect(fuzz).to.eql("hello fuzz");
            --waitCount || done();
          } catch(ex) {
            done(ex);
          }
        }, done);

        myCtx.require('data/foo-plugin', function (plugin) {
          var oCtx = Module.currentCtx;
          try {
            Module.currentCtx = myCtx;
            define("foo5", ['data/foo-plugin!fuzz'], function (fuzz1) {
              try {
                expect(fuzz1).to.eql("hello fuzz");
                expect(Module.currentCtx).to.be(myCtx);
                --waitCount || done();
              } catch(ex) {
                done(ex);
              }
            });
            var fuzz = myCtx.modules['data/foo-plugin!fuzz'];
            fuzz.delayLoad();
          } finally {
            Module.currentCtx = oCtx;
          }
        });
      });
    });
  };
});
