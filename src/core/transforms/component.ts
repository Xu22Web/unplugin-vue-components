import type MagicString from 'magic-string'
import type { Context } from '../context'
import type { ResolveResult } from '../transformer'
import { createDebug } from 'obug'
import { pascalCase, stringifyComponentImport } from '../utils'

const debug = createDebug('unplugin-vue-components:transform:component')

/**
 * Vapor Mode compiles a component tag that can not be statically resolved (e.g. `<el-button>`) to
 * `_createAssetComponent("el-button", props, slots, isSingleRoot, once, maybeSelfReference, ns, appContext)`,
 * which resolves the component by name at runtime and falls back to a plain element when it fails.
 *
 * Only the helper name and the name argument are matched here, the rest of the call is left untouched.
 */
const vaporAssetRE = /_?createAssetComponent\d*\(\s*(['"])([^'"]+)\1/g

/** Injected helper that adapts `createAssetComponent` calls to `createComponent`. */
const VAPOR_HELPER = '__unplugin_components_vapor_asset'
/** `createComponent` re-imported from `vue` under the plugin's namespace. */
const VAPOR_CREATE_COMPONENT = '__unplugin_components_createComponent'

function resolveVue3(
  code: string,
  s: MagicString,
  transformerUserResolveFunctions: boolean,
) {
  const results: ResolveResult[] = []

  /**
   * when using some plugin like plugin-vue-jsx, resolveComponent will be imported as resolveComponent1 to avoid duplicate import
   */
  for (const match of code.matchAll(/_?resolveComponent\d*\("(.+?)"\)/g)) {
    if (!transformerUserResolveFunctions && !match[0].startsWith('_')) {
      continue
    }
    const matchedName = match[1]
    if (match.index != null && matchedName && !matchedName.startsWith('_')) {
      const start = match.index
      const end = start + match[0].length
      results.push({
        rawName: matchedName,
        replace: resolved => s.overwrite(start, end, resolved),
      })
    }
  }

  return results
}

export default async function transformComponent(code: string, s: MagicString, ctx: Context, sfcPath: string) {
  let no = 0

  const results = resolveVue3(code, s, ctx.options.transformerUserResolveFunctions)

  for (const { rawName, replace } of results) {
    debug(`| ${rawName}`)
    const name = pascalCase(rawName)
    ctx.updateUsageMap(sfcPath, [name])
    const component = await ctx.findComponent(name, 'component', [sfcPath])
    if (component) {
      const varName = `__unplugin_components_${no}`
      s.prepend(`${stringifyComponentImport({ ...component, as: varName }, ctx)};\n`)
      no += 1
      replace(varName)
    }
  }

  if (ctx.options.vapor)
    no = await transformVaporComponents(code, s, ctx, sfcPath, no)

  debug(`^ (${no})`)
}

/**
 * Resolve the components used in Vapor Mode templates and rewrite the
 * `_createAssetComponent("name"` calls to the injected helper.
 *
 * Returns the next free index of the `__unplugin_components_*` variable counter.
 */
async function transformVaporComponents(
  code: string,
  s: MagicString,
  ctx: Context,
  sfcPath: string,
  no: number,
): Promise<number> {
  let count = 0
  const replaced = new Map<string, string | null>()

  for (const { rawName, replace } of resolveVapor(code, s, ctx.options.transformerUserResolveFunctions)) {
    // the same component can be used multiple times, reuse the first resolution
    if (replaced.has(rawName)) {
      const varName = replaced.get(rawName)
      if (varName)
        replace(varName)
      continue
    }

    debug(`| vapor ${rawName}`)
    const name = pascalCase(rawName)
    ctx.updateUsageMap(sfcPath, [name])
    const component = await ctx.findComponent(name, 'component', [sfcPath])
    if (!component) {
      replaced.set(rawName, null)
      debug(`| vapor ${rawName} (unresolved, left to Vapor runtime resolution)`)
      continue
    }

    const varName = `__unplugin_components_${no}`
    s.prepend(`${stringifyComponentImport({ ...component, as: varName }, ctx)};\n`)
    replaced.set(rawName, varName)
    no += 1
    count += 1
    replace(varName)
  }

  if (count) {
    // `createAssetComponent(name, props, slots, isSingleRoot, once, maybeSelfReference, ns, appContext)`
    // vs `createComponent(component, props, slots, isSingleRoot, once, appContext, ...)`.
    // `maybeSelfReference` and `ns` are only meaningful for name based resolution, which is exactly
    // what has been replaced here, so they are dropped - the result is equivalent to an explicit import.
    s.prepend(`${[
      `import { createComponent as ${VAPOR_CREATE_COMPONENT} } from 'vue'`,
      `const ${VAPOR_HELPER} = (component, rawProps, rawSlots, isSingleRoot, once, _maybeSelfReference, _ns, appContext) => ${VAPOR_CREATE_COMPONENT}(component, rawProps, rawSlots, isSingleRoot, once, appContext)`,
    ].join('\n')}\n`)
  }

  debug(`^ vapor (${count})`)

  return no
}

function resolveVapor(
  code: string,
  s: MagicString,
  transformerUserResolveFunctions: boolean,
): ResolveResult[] {
  const results: ResolveResult[] = []

  for (const match of code.matchAll(vaporAssetRE)) {
    if (!transformerUserResolveFunctions && !match[0].startsWith('_')) {
      continue
    }
    const matchedName = match[2]
    if (match.index != null && matchedName && !matchedName.startsWith('_')) {
      const start = match.index
      const end = start + match[0].length
      results.push({
        rawName: matchedName,
        replace: resolved => s.overwrite(start, end, `${VAPOR_HELPER}(${resolved}`),
      })
    }
  }

  return results
}
