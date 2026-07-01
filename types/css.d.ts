// typescript 6 no longer resolves side-effect css imports (`import "./x.css"`)
// on its own; next handles the actual bundling, this just satisfies tsc.
declare module "*.css"
