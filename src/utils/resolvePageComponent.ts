export function resolvePageComponent(name: string): () => Promise<{ default: React.ComponentType<any> }> {
  const modules = import.meta.glob('/src/pages/**/*.{tsx,jsx}');

  const normalized = name.trim().replace(/^\/+/, '');
  const path = `/src/pages/${normalized}.tsx`;

  const loader = modules[path];

  if (!loader) {
    console.warn(`❌ Component "${name}" not found at ${path}`);
    return (() =>
      import('../pages/NotFoundFallback.tsx')) as () => Promise<{
        default: React.ComponentType<any>;
      }>;
  }

  return loader as () => Promise<{ default: React.ComponentType<any> }>;
}