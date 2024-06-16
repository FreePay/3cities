export const alchemyApiKey: string = (() => {
  const s = process.env['REACT_APP_ALCHEMY_API_KEY'];
  if (s === undefined) {
    console.error("REACT_APP_ALCHEMY_API_KEY undefined");
    return 'REACT_APP_ALCHEMY_API_KEY_undefined';
  } else return s;
})();
