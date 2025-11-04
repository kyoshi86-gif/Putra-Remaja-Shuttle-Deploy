export function resolvePageComponent(name: string) {
  const modules = import.meta.glob("../pages/**/*.{tsx,jsx}");

  const normalized = name.trim().replace(/^\/+/, "");
  const path = `../pages/${normalized}.tsx`;

  const loader = modules[path];

  if (!loader) {
    const available = Object.keys(modules).join("\n• ");
    throw new Error(
      `❌ Component "${name}" not found at ${path}\n\n📁 Available components:\n• ${available}`
    );
  }

  return loader as () => Promise<{ default: React.ComponentType<Record<string, unknown>> }>;
}