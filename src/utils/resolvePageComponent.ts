export function resolvePageComponent(name: string): () => Promise<{ default: React.ComponentType<unknown> }> {
  const modules = import.meta.glob('/src/pages/**/*.{tsx,jsx}');

  const normalized = name.trim().replace(/^\/+/, '');

  // 🔧 Tambahkan fallback ke PascalCase
  const pascal = normalized
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');

  const candidates = [
    `/src/pages/${normalized}.tsx`,
    `/src/pages/${pascal}.tsx`,
    `/src/pages/${normalized}/index.tsx`,
    `/src/pages/${pascal}/index.tsx`,
  ];

  for (const path of candidates) {
    const loader = modules[path];
    if (loader) {
      return loader as () => Promise<{ default: React.ComponentType<unknown> }>;
    }
  }

  console.warn(`❌ Component "${name}" not found in:`, candidates);
  return () => import('../pages/NotFoundFallback.tsx');
}