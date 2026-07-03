// Monkey-patch para desabilitar a geração de páginas estáticas
const originalRequire = require;
require = function(...args) {
  const result = originalRequire.apply(this, args);
  if (args[0] && args[0].includes('next/dist/build')) {
    // Desabilitar geração de páginas estáticas
  }
  return result;
};
