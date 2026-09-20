import type { UserConfig } from 'vite'
import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import { VantResolver } from '@xu22web/unplugin-vue-components/resolvers'
import Components from '@xu22web/unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import Inspect from 'vite-plugin-inspect'

const config: UserConfig = {
  resolve: {
    alias: {
      '/~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },
  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
      // `features.vapor` (requires `@vitejs/plugin-vue` >= 6.0.9) forces every SFC
      // that can be compiled in Vapor Mode into it; a single file can also opt in
      // with `<script setup vapor>`. SFCs with only a normal `<script>` can not be
      // forced (Vapor SFC support requires `<script setup>`), they stay vDOM and
      // are rendered through the Vapor <-> vDOM interop instead.
      features: {
        vapor: true,
      },
    }),
    Markdown({}),
    Icons(),
    Inspect(),
    Components({
      // enable Vapor Mode support, see the "Vapor Mode" section of the README
      vapor: true,
      extensions: ['vue', 'md', 'svg'],
      directoryAsNamespace: true,
      dts: true,
      globalNamespaces: ['global'],
      include: [/\.vue($|\?)/, /\.md($|\?)/],
      resolvers: [
        (name) => {
          if (name === 'MyCustom')
            return path.resolve(__dirname, 'src/CustomResolved.vue').replaceAll('\\', '/')
        },
        VantResolver(),
        IconsResolver({
          componentPrefix: 'i',
        }),
      ],
      dumpComponentsInfo: true,
    }),
  ],
  build: {
    sourcemap: true,
  },
}

export default config
