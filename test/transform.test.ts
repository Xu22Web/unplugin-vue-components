import type { ComponentResolver } from '../src'
import { describe, expect, it } from 'vitest'
import { pascalCase } from '../src'
import { Context } from '../src/core/context'

const resolver: ComponentResolver[] = [
  {
    type: 'component',
    resolve: name => ({ from: `test/component/${name}` }),
  },
  {
    type: 'directive',
    resolve: name => ({ from: `test/directive/${name}` }),
  },
]

describe('transform', () => {
  it('vue3 transform should work', async () => {
    const code = `
    const render = (_ctx, _cache) => {
      const _component_test_comp = _resolveComponent("test-comp")
      const _directive_loading = _resolveDirective("loading")

      const _resolveNoUnderscore = resolveComponent("test-comp")

      return _withDirectives(
        (_openBlock(),
        _createBlock(_resolveNoUnderscore, null, null, 512 /* NEED_PATCH */)),
        _createBlock(_component_test_comp, null, null, 512 /* NEED_PATCH */)),
        [[_directive_loading, 123]]
      )
    }
    `

    let ctx = new Context({
      resolvers: [resolver],
      transformerUserResolveFunctions: false,
      directives: true,
    })
    ctx.sourcemap = false
    expect(await ctx.transform(code, '')).toMatchSnapshot('no-user-resolve')

    ctx = new Context({
      resolvers: [resolver],
      transformerUserResolveFunctions: true,
      directives: true,
    })
    ctx.sourcemap = false
    expect(await ctx.transform(code, '')).toMatchSnapshot('with-user-resolve')
  })
})

describe('component and directive as same name', () => {
  it('vue3 transform should work', async () => {
    const code = `
    const render = (_ctx, _cache) => {
      const _component_el_infinite_scroll = _resolveComponent("el-infinite-scroll")
      const _directive_el_infinite_scroll = _resolveDirective("el-infinite-scroll")

      return _withDirectives(
        (_openBlock(),
        _createBlock(_component_test_comp, null, null, 512 /* NEED_PATCH */)),
        [[_directive_loading, 123]]
      )
    }
    `

    const ctx = new Context({
      resolvers: [resolver],
      directives: true,
    })
    ctx.sourcemap = false
    expect(await ctx.transform(code, '')).toMatchSnapshot()
  })
})

describe('prefix transform', () => {
  it('transform with prefix should work', async () => {
    const code = `
    const render = (_ctx, _cache) => {
      const _component_test_comp = _resolveComponent("custom-prefix-test-comp")
      const _component_testComp = _resolveComponent("CustomPrefixTestComp")
      const _component_testComp = _resolveComponent("customPrefixTestComp")

      return _withDirectives(
        (_openBlock(),
        _createBlock(_component_test_comp, null, null, 512 /* NEED_PATCH */)),
        _createBlock(_component_testComp, null, null, 512 /* NEED_PATCH */)),
        _createBlock(_component_TestComp, null, null, 512 /* NEED_PATCH */))
      )
    }
    `

    const ctx = new Context({
      prefix: 'CustomPrefix',
      directives: true,
    })
    ctx.sourcemap = false
    const componentName = 'TestComp'
    const name = `${pascalCase(ctx.options.prefix)}${pascalCase(componentName)}`
    // @ts-expect-error for test
    ctx._componentNameMap = {
      [name]: {
        as: name,
        from: 'test/component/test-comp.vue',
      },
    }
    expect(await ctx.transform(code, '')).toMatchSnapshot()
  })
})

const vaporResolver: ComponentResolver[] = [
  {
    type: 'component',
    resolve: (name) => {
      if (name === 'ElButton') {
        return {
          from: 'element-plus/es',
          name: 'ElButton',
          sideEffects: 'element-plus/es/components/button/style/css',
        }
      }
    },
  },
]

/**
 * Trimmed down but structurally identical to what the Vapor compiler (vue 3.6.0-rc.9,
 * via `@vitejs/plugin-vue` with `features.vapor`) emits for a template using
 * `<el-button />` twice, a local `<hello-world />` and an unresolvable `<unknown-component />`.
 * `isSingleRoot` / `once` are only emitted when they are truthy.
 */
const vaporCode = `
import { createAssetComponent as _createAssetComponent } from 'vue'

const _sfc_main = {
  setup(__props) {
    return (_ctx) => {
      const n0 = _createAssetComponent("el-button", { type: () => ("primary") }, null, false)
      const n1 = _createAssetComponent("el-button", null, null)
      const n2 = _createAssetComponent("hello-world", null, null, true)
      const n3 = _createAssetComponent("unknown-component", null, null)
      return [n0, n1, n2, n3]
    }
  },
}
`

function getCode(result: Awaited<ReturnType<Context['transform']>>) {
  if (!result || typeof result === 'string')
    return typeof result === 'string' ? result : ''
  return result.code
}

describe('vapor', () => {
  it('is disabled by default', async () => {
    const ctx = new Context({ resolvers: [vaporResolver] })
    ctx.sourcemap = false
    expect(await ctx.transform(vaporCode, '')).toMatchSnapshot()
  })

  it('transforms components resolved by resolvers', async () => {
    const ctx = new Context({ resolvers: [vaporResolver], vapor: true })
    ctx.sourcemap = false
    const result = await ctx.transform(vaporCode, '')
    const code = getCode(result)

    expect(code).toContain('import { createComponent as __unplugin_components_createComponent } from \'vue\'')
    expect(code).toContain('import { ElButton as __unplugin_components_0 } from \'element-plus/es\'')
    expect(code).toContain('import \'element-plus/es/components/button/style/css\'')
    // only the helper name and the name argument are rewritten
    expect(code).not.toContain('_createAssetComponent("el-button"')
    expect(code.match(/__unplugin_components_vapor_asset\(__unplugin_components_0/g)).toHaveLength(2)
    // unresolvable components are left for the Vapor runtime to resolve
    expect(code).toContain('_createAssetComponent("unknown-component"')
    // the custom resolvers map feeds the generated declaration file
    expect(ctx.componentCustomMap.ElButton).toMatchObject({ from: 'element-plus/es', name: 'ElButton' })

    expect(result).toMatchSnapshot()
  })

  it('transforms components found in dirs/globs', async () => {
    const ctx = new Context({ vapor: true })
    ctx.sourcemap = false
    // @ts-expect-error for test
    ctx._componentNameMap = {
      HelloWorld: {
        as: 'HelloWorld',
        from: '/src/components/HelloWorld.vue',
      },
    }
    const result = await ctx.transform(vaporCode, '')

    expect(getCode(result)).toContain('import __unplugin_components_0 from \'/src/components/HelloWorld.vue\'')
    expect(getCode(result)).toContain('__unplugin_components_vapor_asset(__unplugin_components_0')
    expect(result).toMatchSnapshot()
  })

  it('shares the variable counter with the vdom transform', async () => {
    const code = `
    const _component_test_comp = _resolveComponent("test-comp")
    const el = _createAssetComponent("test-comp-two", null, null)
    `
    const ctx = new Context({ resolvers: [resolver], vapor: true })
    ctx.sourcemap = false
    const result = await ctx.transform(code, '')

    expect(getCode(result)).toContain('_component_test_comp = __unplugin_components_0')
    expect(getCode(result)).toContain('__unplugin_components_vapor_asset(__unplugin_components_1')
    expect(result).toMatchSnapshot()
  })

  it('does not transform user resolve functions when disabled', async () => {
    const code = `const el = createAssetComponent("test-comp", null, null)`
    const ctx = new Context({
      resolvers: [resolver],
      transformerUserResolveFunctions: false,
      vapor: true,
    })
    ctx.sourcemap = false
    expect(await ctx.transform(code, '')).toMatchSnapshot()
  })
})
