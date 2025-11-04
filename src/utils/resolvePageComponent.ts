export function resolvePageComponent(name: string) {
  const modules = import.meta.glob("../pages/**/*.tsx");

  const path = `../pages/${name}.tsx`;
  const loader = modules[path];

  if (!loader) {
    throw new Error(`❌ Component "${name}" not found at ${path}`);
  }

  // TypeScript aman karena lazy() butuh fungsi async
  return loader as () => Promise<{ default: React.ComponentType<any> }>;
}