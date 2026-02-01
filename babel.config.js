module.exports = {
  presets: [
    ['@babel/preset-env', {
      modules: false,
      targets: { browsers: ['>0.5%', 'not dead'] },
      useBuiltIns: false,
    }],
  ],
  plugins: [
    ['@babel/plugin-transform-react-jsx', {
      pragma: 'h',
      pragmaFrag: 'Fragment',
    }],
  ],
};
