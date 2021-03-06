/*global yaajs*/
define((require, exports, module)=>{
  const {ctx} = module;
  const Module = module.constructor;

  return expect =>{
    describe(module.id, ()=>{
      afterEach(()=>{
        ctx.constructor.remove("my ctx");
      });

      it("should handle circular dependancies", done =>{
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        myCtx.require('data/circular1', circular1 =>{
          try {
            expect(circular1).to.eql({c1: true, c2: true, c3: true});
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("should wait for nested dependencies", function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        Module.currentCtx = myCtx;
        define("foo", function () {return "FOO"});
        Module.currentCtx = ctx;
        var foo = myCtx.modules.foo;
        foo.state = Module.LOADED;
        --myCtx.resolvingCount;
        foo.exports = {};
        myCtx.require('data/dep-on-foo', function (arg) {
          try {
            expect(arg).to.eql("FOO");
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
        setTimeout(function () {
          Module._prepare(foo);
        }, 10);
      });

      it("should convert id to uri", function () {
        var exp = ctx.baseUrl+"abc/def.j.foo";
        expect(ctx.uri("abc/def.j", '.foo')).to.be(exp);
        expect(ctx.uri("/abc/def.j", '.foo')).to.be("/abc/def.j");
          expect(ctx.uri("http://abc.html", '.foo')).to.be("http://abc.html");
        expect(ctx.uri("abc/def.js", '.foo')).to.be("abc/def.js");
      });

      it("should normalize id wrt dir", function () {
        var ctx = module.ctx;
        expect(ctx.normalizeId("../foo", "bar/baz/")).to.be("bar/foo");
        expect(ctx.normalizeId("./foo", "bar/baz/")).to.be("bar/baz/foo");
        expect(ctx.normalizeId("foo/bar", "bar/baz/")).to.be("foo/bar");
      });

      it("should generate urls relative to module", function () {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: "foo"});
        var mod = new module.constructor(myCtx, "data/foo");
        expect(mod.toUrl("../def.js")).to.be("foo/def.js");
        expect(require.toUrl("./foo")).to.be(require.module.toUrl('./foo'));
        expect(mod.toUrl("abc/def.j")).to.be('foo/abc/def.j');
        expect(mod.toUrl("./abc/def.html")).to.be("foo/data/abc/def.html");
      });

      it("should normalize ids relative to module", function () {
        var mod = new module.constructor(module.ctx, "data/foo");
        expect(mod.normalizeId("abc/def.j")).to.be("abc/def.j");
        expect(mod.normalizeId("./abc/def.html")).to.be("data/abc/def.html");
        expect(mod.normalizeId("../abc/def.html")).to.be("abc/def.html");
        expect(mod.normalizeId("../def.js")).to.be("../def.js");
        expect(mod.normalizeId("http://def.html")).to.be("http://def.html");
      });

      it('should handle callback', function (done) {
        require('./data/simple', function (simple) {
          try {
            expect(simple).to.equal('simple');
            var inner;
            require('./data/simple', function (simple) {
              inner = simple;
            });
            expect(inner).to.equal('simple');
            done();
          } catch(ex) {
            done(ex);
          }
        }, function () {
          done(new Error("should not be loaded"));
        });
      });

      it("should allow requiring multiple modules in one call", function (done) {
        require("data/dep2 require ./data/subdir/dep1 module ./data/../data/simple exports".split(' '), function (d2, req, d1, mod, simple) {
          try {
            expect(req).to.be(require);
            expect(mod).to.be(module);
            expect(d2).to.be(true);
            expect(d1).to.be.a('function');
            expect(simple).to.be("simple");
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("should catch module init errors", function () {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        var mod = new Module(myCtx, "foo-err");
        var onError = mod.ctx.onError;
        var expErr;
        mod.ctx.onError = function (err) {expErr = err};
        try {
          Module._prepare(mod, [], function () {
            throw new Error("bang!");
          });
        } finally {
          mod.ctx.onError = onError;
        }
        expect(expErr.onload).to.be(undefined);
        expect(expErr.toString()).to.match(/bang!/);
      });

      // server only; can't catch on client ¯\_(ツ)_/¯
      typeof window === 'undefined' &&
        it("should handle syntax errors", function (done) {
          var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
          myCtx.require('data/syntax-error', function () {
            try {
              expect().fail("should not have loaded module");
            } catch(ex) {
              done(ex);
            }
          }, function (error, mod) {
            try {
              expect(error).to.be.a(SyntaxError);
              done();
            } catch (ex) {
              done(ex);
            }
          });
        });

      it("should not need a define by default", function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});

        myCtx.require('./data/no-define', function () {
          try {
            expect((yaajs.nodeRequire ? global : window).NO_DEFINE).to.be("success");
            done();
          } catch(ex) {
            done(ex);
          }
        }, done);
      });

      it("can recover from error", function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl, enforceDefine: true});
        myCtx.require('./data/not-found', function () {
          myCtx.require('data/dep-on-not-found', function (arg) {
            try {
              expect(arg).to.be("success");
              done();
            } catch(ex) {
              done(ex);
            }
          }, done);
        }, function (err, mod) {
          try {
            expect(err.toString()).to.match(typeof window === 'undefined' ? /no such file/ : /failed to load/);
            expect(err.module.id).to.be('data/not-found');
            expect(err.module).to.be(mod);
            expect(err.onload).to.be(true);
          } catch(ex) {
            done(ex);
            return;
          }
          Module._prepare(mod, null, "success");
        });
      });

      it('should handle missing define', function (done) {
        var myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl, enforceDefine: true});
        myCtx.require('./data/nested-no-define', function () {
          try {
            expect().fail("should not be loaded");
          } catch(ex) {
            done(ex);
          }
        }, function (type, mod) {
          var onError = mod.ctx.onError;
          mod.ctx.onError = function () {};
          setTimeout(function () {
            try {
              expect(ctx.modules['no-define']).to.not.be.ok();
              expect(ctx.modules['nested-no-define']).to.not.be.ok();
              var nreq = yaajs.nodeRequire;
              if (! nreq) {
                expect(document.querySelector('script[src="./no-define.js"]')).to.not.be.ok();
                expect(document.querySelector('script[src="./nested-no-define.js"]')).to.not.be.ok();
              }
              done();
            } catch(ex) {
              done(ex);
            } finally {
              mod.ctx.onError = onError;
            }
          });
        });
      });
    });
  };
});
