/*global yaajs*/
define(function(require, exports, module) {
  var defineObject = require('data/define-object');
  var ctx = module.ctx;

  return function (expect) {

    describe(module.id, function () {
      afterEach(function () {
        ctx.constructor.remove("my ctx");
      });

      it("can retrieve context from require", function () {
        var myCtx = ctx.config();
        expect(myCtx).to.be(ctx);
      });

      it("can record module exports", function (done) {
        var myCtx = new ctx.constructor({
          context: 'my ctx', baseUrl: ctx.baseUrl+"data",
          recordExports: true,
        });

        myCtx.require("define-object", function (result) {
          try {
            expect(myCtx.exportsModule(result)[0]).to.eql(myCtx.modules["define-object"]);
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("can set baseUrl", function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: "foo"});
        expect(myCtx.baseUrl).to.be("foo/");
        myCtx.config({context: 'my ctx', baseUrl: "bar"});
        expect(myCtx.baseUrl).to.be("bar/");
        var newUrl = ctx.baseUrl+"data/subdir/";
        var myCtx2 = ctx.config({context: 'my ctx', baseUrl: newUrl});
        expect(myCtx2).to.be(myCtx);
        expect(myCtx.baseUrl).to.be(newUrl);

        myCtx.require("define-object", function (result) {
          try {
            expect(result).to.eql({subdir: 'object'});
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("can set paths", function (done) {
        var myCtx = ctx.config({
          context: 'my ctx',
          baseUrl: ctx.baseUrl,
          paths: {
            defo: "data/subdir",
          }
        });

        myCtx.require("defo/define-object", function (result) {
          try {
            expect(result).to.eql({subdir: 'object'});
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      describe("shim", function () {
        it("can set shim", function (done) {
          var myCtx = ctx.config({
            context: 'my ctx',
            baseUrl: ctx.baseUrl,
            shim: {
              './data/no-define': {
                deps: ['data/dep2', 'exports', 'module'],
                exports: function (dep2, exports, module) {
                  return [dep2, exports, module];
                }
              },
            }
          });

          myCtx.require("data/no-define", function (result) {
            try {
              expect(result).to.be.an('array');
              expect(result[0]).to.be(true);
              expect(result[1]).to.eql({});
              expect(result[2].id).to.be('data/no-define');
              done();
            } catch(ex) {
              done(ex);
            }
          }, done);
        }),

        it("does not use require for shim", function (done) {
          var myCtx = ctx.config({
            context: 'my ctx',
            baseUrl: ctx.baseUrl,
            shim: {
              'data/no-module': {},
            }
          });

          myCtx.require("data/no-module", function (result) {
            try {
              expect(result).to.eql({module: false});
              done();
            } catch(ex) {
              done(ex);
            }
          }, done);
        });
      });


      it("should honor expectDefine", function (done) {
        var myCtx = ctx.config({
          context: 'my ctx',
          baseUrl: ctx.baseUrl,
          shim: {
            'data/no-define': {expectDefine: true},
          },
          enforceDefine: true,
        });

        myCtx.require("data/no-define", function (result) {
          try {
            expect().fail("should not allow define to be missing");
          } catch(ex) {
            done(ex);
          }
        }, function (error, mod) {
          var onError = mod.ctx.onError;
          mod.ctx.onError = function () {};
          setTimeout(function () {
            try {
              expect(error.module.id).to.be('data/no-define');
              expect(error.nodefine).to.be(true);
              done();
            } catch(ex) {
              done(ex);
            } finally {
              mod.ctx.onError = onError;
            }
          });
        });
      });

      it("can set config", function (done) {
        var simpleConfig = {name: "value"};

        var myCtx = ctx.config({
          context: 'my ctx',
          baseUrl: ctx.baseUrl,
          config: {'./data/simple': simpleConfig},
        });

        myCtx.require("./data/simple", function (result) {
          try {
            var mod = myCtx.modules['data/simple'];
            expect(mod.config()).to.be(simpleConfig);
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("can set packages", function (done) {
        var myCtx = ctx.config({
          context: 'my ctx',
          baseUrl: ctx.baseUrl,
          paths: {subdir: "data/subdir"},
          packages: [
            'subdir',
            {name: 'foo/bar', location: 'data', main: 'dep2'},
          ]
        });

        myCtx.require(["subdir", 'foo/bar'], function (subdir, foobar) {
          try {
            expect(subdir).to.eql({value: "main module"});
            expect(foobar).to.be(true);
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });
    });
  };
});
