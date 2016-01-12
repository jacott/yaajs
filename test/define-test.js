/*global yaajs*/
define(function(require, exports, module) {
  var dep1 = require('./data/subdir/dep1');
  var defineObject = require('./data/define-object');
  var defineNoDeps = require('data/define-no-deps');
  var defineDepsFirst = require('./data/define-deps-first');
  var Module = module.constructor;

  return function (expect) {

    describe(module.id, function () {
      it("can look for an existing module", function () {
        var mod = module.get('./data/define-no-deps');
        expect(mod.id).to.be("data/define-no-deps");
        mod = module.get("fuz");
        expect(mod).to.not.be.ok();
      });

      it("should allow named define calls", function () {
        define("foo", ['data/define-object', 'module'], function (defObj, module) {
          module.exports = function () {
            return defObj;
          };
        });
        define("bar", function () {
          return "bar def";
        });
        var foo = module.ctx.modules.foo;
        expect(foo).to.be.ok();
        expect(foo.exports).to.be.a('function');
        expect(foo.exports).to.be(require("fo" + "o"));
        expect(foo.exports()).to.be(defineObject);
        expect(require("ba" + "r")).to.be("bar def");
        expect(yaajs("ba" + "r")).to.be("bar def");
      });

      it("can load named defines", function (done) {
        require("data/named-define", function (res) {
          try {
            expect(res).to.be("named success");
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("should set amd attribute", function () {
        expect(define.amd).to.eql({});
      });

      it("should not inspect body if no arguments", function () {
        var fn = new Function("req" + "uire('fuz');");
        define(fn);
        var gdr = Module._globalDefineResult;
        gdr = Module._globalDefineResult;
        expect(gdr).to.eql([null, undefined, fn, undefined]);
      });

      it("should detect ids not normalizing within baseUrl", function () {
        expect(function () {
          module.normalizeId("../test/dep2");
        }).to.throwException(/does not resolve/);
      });

      it("should allow define object", function () {
        expect(defineObject).to.eql({simple: 'object'});
      });

      it("should allow allow function without dependencies", function () {
        expect(defineNoDeps).to.be('success');
      });

      it('should (un)load nested dependencies', function (done) {
        expect(dep1).to.be.a('function');
        expect(dep1()).to.be(true);
        var dep2Mod = module.ctx.modules[module.normalizeId('./data/dep2')];
        expect(dep1.testUnload).to.not.be.ok();
        dep2Mod.unload();
        expect(dep1.testUnload).to.be(true);
        require('data/subdir/dep1', function (obj) {
          try {
            expect(obj()).to.be(true);
            expect(obj()).to.be(false);
            done();
          } catch(ex) {
            done(ex);
          }
        });
      });

      it('should allow dependencies as first argument', function () {
        expect(defineDepsFirst).to.eql({success: true});
      });
    });
  };
});
