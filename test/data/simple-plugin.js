define(function(require, exports, module) {
  return {
    load: function (name, req, onLoad) {
      onLoad("simple " + name);
    },

    write: function (pluginName, name, write) {
      write('define('+ JSON.stringify(pluginName + "!" + name) + ',' + JSON.stringify("simple " + name) + ");\n");
    },
  };
});
