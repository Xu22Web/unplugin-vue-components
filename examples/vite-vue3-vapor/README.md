# Vapor Mode fixture

The Vapor Mode counterpart of [`examples/vite-vue3`](../vite-vue3).
It covers the same cases (basic components, kebab-case files, recursive components,
namespaced dirs, async components, markdown, custom resolvers, a UI library and icons)
with `Components({ vapor: true })` and the SFCs (or rather most of them) compiled by
`@vitejs/plugin-vue` in Vapor Mode.

```bash
pnpm -C examples/vite-vue3-vapor dev
```

Vapor specific differences compared to the vDOM fixture:

- `vue` is pinned to `3.6.0-rc.9` (Vapor Mode is not in a stable release yet) and
  `@vitejs/plugin-vue` to `^6.0.9`, the first version that supports `features: { vapor: true }`.
- `main.ts` mounts a vDOM root with `app.use(vaporInteropPlugin)`, the interop plugin is
  required to render Vapor components in the vDOM tree (and the other way around).
- `App.vue` uses `defineVaporAsyncComponent` instead of `defineAsyncComponent`.
- SFCs that only have a plain `<script>` (e.g. `book/index.vue`, `ui/button.vue`,
  `Recursive.vue`) can not be compiled in Vapor Mode - plugin-vue requires `<script setup>`
  for that. They stay vDOM and are rendered through the interop layer, which makes this
  fixture also a good mix of both modes.
- `<script setup>` SFCs (and the markdown files) are forced into Vapor Mode by
  `features: { vapor: true }`, a single file can also opt in with `<script setup vapor>`.

Known harmless warning of this fixture: Vant's `van-radio` renders its internal
`van-badge`/`van-icon` slots through the interop layer, so Vue logs
`Slot "default" invoked outside of the render function` twice. It happens with explicit
`import { Radio } from 'vant'` too, so it is unrelated to the auto import.
