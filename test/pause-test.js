/*global yaajs*/
define((require, exports, module)=>{
  const {ctx} = module;
  const Module = module.constructor;

  return expect =>{
    describe(module.id, ()=>{
      let myCtx;
      beforeEach(()=>{
        myCtx = new ctx.constructor({context: 'my ctx', baseUrl: ctx.baseUrl});
        Module.currentCtx = myCtx;
      });
      afterEach(()=>{
        Module.currentCtx = ctx;
        ctx.constructor.remove("my ctx");
      });

      it("should handle dependencies", ()=>{
        myCtx.paused = true;
        const order = [];
        Module.define("m1", ['module', 'm2'], (module)=>{
          order.push(module.id);
        });

        Module.define("m2", ['module'], (module)=>{
          order.push(module.id);
        });

        Module.define("m3", ['module'], (module)=>{
          order.push(module.id);
        });

        expect(order).to.eql([]);

        Module._unpause(myCtx);

        expect(order).to.eql(['m2', 'm1', 'm3']);
      });

      it("should break cycles", ()=>{
        myCtx.paused = true;
        const order = [];
        Module.define("m1", ['module', 'm2'], (module)=>{
          order.push(module.id);
        });

        Module.define("m2", ['module', 'm3'], (module)=>{
          order.push(module.id);
        });

        Module.define("m3", ['module', 'm1'], (module)=>{
          order.push(module.id);
        });

        expect(order).to.eql([]);

        Module._unpause(myCtx);

        expect(order).to.eql(['m3', 'm2', 'm1']);
      });

      it.only("should work with plugins", ()=>{
        myCtx.paused = true;
        const order = [];
        Module.define("p1", {
          load(name, req, onload, config) {
            order.push('p1', name);
            onload("realFoo");
          }
        });

        Module.define("m1", [
          'require', 'exports', 'module', 'p1!foo'
        ], (
          require, exports, module, p1foo
        )=>{
          order.push(module.id, p1foo);
        });

        Module.define("m3", ['module', 'm1'], (module, m1, m2)=>{
          order.push(module.id);
        });

        expect(order).to.eql([]);

        Module._unpause(myCtx);

        expect(order).to.eql(['p1', 'foo', 'm1', 'realFoo', 'm3']);
      });
    });
  };
});
