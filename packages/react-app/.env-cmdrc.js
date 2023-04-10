const common = {
  "REACT_APP_LOADING_PLACEHOLDER_INNER_HTML": `<div style='position: absolute; top: 38.2%; left: 50%; transform: translate(-50%, -50%); text-align: center;'><div style='width: 61.8vw; max-width: 400px; position: relative; padding-top: calc((472 / 1240) * 100%); margin-bottom: 10px;'><img src='/wordmark-low-size.jpg' alt='Wordmark' style='position: absolute; top: 0; left: 0; width: 100%; height: 100%;'></div><span style='font-size: 26px; line-height: 39px; font-family: "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans", "sans-serif", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"'>3cities is loading</span></div>`, // REACT_APP_LOADING_PLACEHOLDER_INNER_HTML is used to help ensure that the static loading placeholder in public.html is visually identical to the loading placeholder in the app. The loading placeholder in public.html is shown while bundle.js is still downloading. The loading placeholder in the app is shown while react-router is initializing. WARNING if the static loading placeholder in public.html is not visually identical to the loading placeholder in the app, a probable cause is that the inline text styles on the <span> don't exactly match the properties applied by tailwindcss after the bundle finishes loading (as tailwind css is compiled into bundle.js)
};

module.exports = {
  "dev": {
    ...common,
    "GENERATE_SOURCEMAP": true,
    "REACT_APP_IS_PRODUCTION": false,
  },
  "prod-test": {
    ...common,
    "GENERATE_SOURCEMAP": false,
    "REACT_APP_IS_PRODUCTION": false,
  },
  "prod": {
    ...common,
    "GENERATE_SOURCEMAP": false,
    "REACT_APP_IS_PRODUCTION": true,
  }
};
