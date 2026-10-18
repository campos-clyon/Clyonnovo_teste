// A app usa algumas regras do site directamente (src/lib/negociacao.ts e
// outras sem dependências — ver src/lib/trabalhos.ts). O Metro só lê ficheiros
// dentro do projecto e das pastas que se lhe indicam aqui.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src/lib")];

module.exports = config;
