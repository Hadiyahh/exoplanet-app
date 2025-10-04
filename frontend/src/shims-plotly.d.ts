// Tell TS what these module IDs are.
declare module "plotly.js-dist-min" {
  const Plotly: any;            // good enough for app usage
  export default Plotly;
}

declare module "react-plotly.js/factory" {
  const createPlotlyComponent: (plotly: any) => any;
  export default createPlotlyComponent;
}
