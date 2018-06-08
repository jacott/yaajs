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
        Module.pause(myCtx);
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

        Module.unpause(myCtx);

        expect(order).to.eql(['m2', 'm1', 'm3']);
      });

      it("should break cycles", ()=>{
        Module.pause(myCtx);
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

        Module.unpause(myCtx);

        expect(order).to.eql(['m3', 'm2', 'm1']);
      });

      it("should work with plugins", ()=>{
        Module.pause(myCtx);
        const order = [];

        Module.define("b1", "b1exp");

        Module.define("p1", {
          load(name, req, onload, config) {
            order.push('p1', name);
            onload("realFoo");
          }
        });

        Module.define("p2", {
          load(name, req, onload, config) {
            order.push('p2', name);
            onload("p2Foo");
          }
        });

        Module.define("m1", [
          'require', 'exports', 'module', 'p1!foo',
          'p2', // cause p2 to resolve early
        ], (
          require, exports, module, p1foo
        )=>{
          order.push(module.id, p1foo);
        });

        Module.define("m3", ['module', 'm1', 'p2!foo2'], (module, m1, p2)=>{
          order.push(module.id);
        });

        expect(order).to.eql([]);

        Module.unpause(myCtx);

        Module.breakCycle(myCtx);

        expect(order).to.eql(['p1', 'foo', 'p2', 'foo2', 'm1', 'realFoo', 'm3']);
      });
    });
  };
});
