declare module 'yamljs' {
  const YAML: {
    load(path: string): Record<string, unknown>;
  };
  export default YAML;
}
