define((require, exports, module)=>{
  const ctx = module.ctx;
  const Module = module.constructor;

  return expect =>{
    let myCtx;
    describe(module.id, ()=>{
      beforeEach(()=>{
        myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
      });
      afterEach(()=>{
        ctx.constructor.remove("my ctx");
      });

      it("uses normalizeId by default", (done)=>{
        require('data/simple-plugin!./flux', simple =>{
          try {
            expect(simple).to.be("simple flux");
            done();
          } catch(ex) {
            done(ex);
          }
        });
      });

      it("handles onload.error", (done)=>{
        myCtx.require('data/error-plugin!foo', ()=>{
          done(new Error("unexpected"));
        }, (error)=>{
          try {
            expect(error.message).to.be("Module: data/error-plugin!foo - foo");
            setTimeout(()=>{
              try {
                expect(myCtx.modules['data/error-plugin!foo']).to.be(undefined);
                done();
              } catch(ex) {
                done(ex);
              }
            }, 0);
          } catch(ex) {
            done(ex);
          }
        });
      });

      // server only; can't catch on client ¯\_(ツ)_/¯
      (typeof window === 'undefined'
      ) && it("recovers from load error", (done)=>{
        const onError = myCtx.onError;
        myCtx.onError = (v)=>{
          setTimeout(()=>{
            try {
              expect(v.module.id).to.be('data/syntax-error');
              expect(myCtx.depCount).to.be(0);
              expect(myCtx.resolvingCount).to.be(0);
              done();
            } catch(ex) {
              done(ex);
            }
          }, 0);
        };
        myCtx.require('data/plugin-load-error', ()=>{
          expect().fail("should not get here");
        });
      });

      it("can double require a plugin", (done)=>{
        let count = 2;
        const assertOk = (result)=>{
          try {
            expect(result).to.be("simple foo");
            --count || done();
          }
          catch (ex) {
            done(ex);
          }
        };

        myCtx.require('data/simple-plugin!foo', assertOk);

        myCtx.require('data/simple-plugin!foo', assertOk);

      });

      it("maps un-normalized correctly", ()=>{
        const pmod = new Module(myCtx, 'foo');
        const caller = new Module(myCtx, 'baz');
        let loadCount = 0;
        pmod.exports = {load(name, req, onLoad) {
          ++loadCount;
        }};
        const plugin = new Module.Plugin(pmod);
        const myMod = plugin.fetch("./unnorm", caller);
        const myMod2 = plugin.fetch("unnorm");
        expect(myCtx.resolvingCount).to.be(4);
        expect(myMod.id).to.equal('');
        expect(plugin.waiting['baz']['./unnorm'][0]).to.be(caller);
        expect(plugin.waiting['baz']['./unnorm'][1]).to.be(myMod);
        expect(plugin.waiting['']['unnorm'][0]).to.be(undefined);
        expect(plugin.waiting['']['unnorm'][1]).to.be(myMod2);

        plugin.ready();

        expect(loadCount).to.equal(1);

        expect(myCtx.resolvingCount).to.equal(4);
        expect(myCtx.depCount).to.equal(0);
      });

      it("calls callbacks", (done)=>{
        let waitCount = 2;
        myCtx.require('data/foo-plugin!junk/here/fuzz', (fuzz)=>{
          try {
            expect(fuzz).to.eql("hello fuzz");
            --waitCount || done();
          } catch(ex) {
            done(ex);
          }
        }, done);

        myCtx.require('data/foo-plugin', (plugin)=>{
          const oCtx = Module.currentCtx;
          try {
            Module.currentCtx = myCtx;
            define("foo5", ['data/foo-plugin!fuzz'], (fuzz1)=>{
              try {
                expect(fuzz1).to.eql("hello fuzz");
                expect(Module.currentCtx).to.be(myCtx);
                --waitCount || done();
              } catch(ex) {
                done(ex);
              }
            });
            const fuzz = myCtx.modules['data/foo-plugin!fuzz'];
            fuzz.delayLoad();
          } finally {
            Module.currentCtx = oCtx;
          }
        });
      });
    });
  };
});
