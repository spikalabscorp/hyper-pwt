import type { Plugin } from "vite";

const REACT_EXPORTS = [
  "Children",
  "Component",
  "Fragment",
  "Profiler",
  "PureComponent",
  "StrictMode",
  "Suspense",
  "SuspenseList",
  "cache",
  "cloneElement",
  "createContext",
  "createElement",
  "createFactory",
  "createRef",
  "createServerContext",
  "forwardRef",
  "isValidElement",
  "lazy",
  "memo",
  "startTransition",
  "unstable_act",
  "unstable_useCacheRefresh",
  "unstable_useDeferredValue",
  "unstable_useEffectEvent",
  "unstable_useTransition",
  "use",
  "useActionState",
  "useCallback",
  "useContext",
  "useDebugValue",
  "useDeferredValue",
  "useEffect",
  "useEffectEvent",
  "useFormState",
  "useFormStatus",
  "useId",
  "useImperativeHandle",
  "useInsertionEffect",
  "useLayoutEffect",
  "useMemo",
  "useOptimistic",
  "useReducer",
  "useRef",
  "useState",
  "useSyncExternalStore",
  "useTransition",
  "version",
  "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
];

const REACT_DOM_EXPORTS = [
  "createPortal",
  "createRoot",
  "findDOMNode",
  "flushSync",
  "hydrate",
  "hydrateRoot",
  "render",
  "unmountComponentAtNode",
  "unstable_batchedUpdates",
  "unstable_renderSubtreeIntoContainer",
  "unstable_createEventHandle",
  "version",
  "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED",
];

const VIRTUAL_REACT_ID = "\0mendix:react";
const VIRTUAL_REACT_DOM_ID = "\0mendix:react-dom";
const VIRTUAL_REACT_DOM_CLIENT_ID = "\0mendix:react-dom/client";
const VIRTUAL_JSX_RUNTIME_ID = "\0mendix:react/jsx-runtime";
const VIRTUAL_JSX_DEV_RUNTIME_ID = "\0mendix:react/jsx-dev-runtime";

const RESERVED_EXPORTS = new Set([
  "default",
  "__esModule",
  "constructor",
  "prototype",
]);

const isValidIdentifier = (name: string) => /^[A-Za-z_$][\w$]*$/.test(name);

const normalizeExportNames = (names: string[]) => {
  const set = new Set<string>();
  for (const name of names) {
    if (!name || RESERVED_EXPORTS.has(name) || !isValidIdentifier(name)) {
      continue;
    }
    set.add(name);
  }
  return Array.from(set).sort();
};

const buildModuleResolverPrelude = () => `
const __mx_global = typeof globalThis !== "undefined"
  ? globalThis
  : typeof window !== "undefined"
    ? window
    : undefined;
const __mx_require = __mx_global?.requirejs ?? __mx_global?.require;
const __mx_requireContexts = __mx_global?.requirejs?.s?.contexts;
const __mx_getGlobalValue = (names) => {
  if (!__mx_global) return undefined;
  for (const name of names) {
    const value = __mx_global[name];
    if (value !== undefined) return value;
  }
  return undefined;
};
const __mx_setGlobalValue = (names, value) => {
  if (!__mx_global || value === undefined) return;
  for (const name of names) {
    if (!__mx_global[name]) __mx_global[name] = value;
  }
};
const __mx_getFromDefined = (id) => {
  if (!__mx_requireContexts) return undefined;
  for (const contextKey of Object.keys(__mx_requireContexts)) {
    const defined = __mx_requireContexts[contextKey]?.defined;
    if (defined && id in defined) return defined[id];
  }
  return undefined;
};
const __mx_requireSync = (id) => {
  if (typeof __mx_require !== "function") return undefined;
  try {
    const result = __mx_require(id);
    if (result !== undefined) return result;
  } catch (_) {}
  return undefined;
};
const __mx_resolve = (ids) => {
  for (const id of ids) {
    const fromDefined = __mx_getFromDefined(id);
    if (fromDefined !== undefined) return fromDefined;
    const fromRequire = __mx_requireSync(id);
    if (fromRequire !== undefined) return fromRequire;
  }
  return undefined;
};
`;

const buildGlobalShimModule = (
  globalNames: string[],
  exportsList: string[],
  moduleIds: string[],
) => {
  const safeExports = normalizeExportNames(exportsList);
  const primaryGlobalName = globalNames[0];
  const lines: string[] = [
    buildModuleResolverPrelude(),
    `const __mx_globalNames = ${JSON.stringify(globalNames)};`,
    `let target = __mx_getGlobalValue(__mx_globalNames);`,
    `if (!target) {`,
    `  target = __mx_resolve(${JSON.stringify(moduleIds)});`,
    `}`,
    `if (!target) {`,
    `  console.warn("[hyper-pwt] Mendix React global '${primaryGlobalName}' is missing. Hot reload may fail.");`,
    `}`,
    `__mx_setGlobalValue(__mx_globalNames, target);`,
    `const get = (key) => (target ? target[key] : undefined);`,
    `export default target;`,
  ];

  for (const name of safeExports) {
    lines.push(`export const ${name} = get("${name}");`);
  }

  return lines.join("\n");
};

const buildReactDomClientShim = () => {
  return `
${buildModuleResolverPrelude()}
const __mx_reactDomNames = ["ReactDOM"];
const __mx_reactDomClientNames = ["ReactDOMClient"];

let ReactDOM = __mx_getGlobalValue(__mx_reactDomNames);
if (!ReactDOM) {
  ReactDOM = __mx_resolve(["react-dom"]);
}
let ReactDOMClient = __mx_getGlobalValue(__mx_reactDomClientNames);
if (!ReactDOMClient) {
  ReactDOMClient = __mx_resolve(["react-dom/client"]);
}

if (!ReactDOM && !ReactDOMClient) {
  console.warn("[hyper-pwt] Mendix ReactDOM globals are missing. react-dom/client shim may fail.");
}

__mx_setGlobalValue(__mx_reactDomNames, ReactDOM);
__mx_setGlobalValue(__mx_reactDomClientNames, ReactDOMClient);

const ensureContainer = (container) => {
  if (!container) {
    throw new Error("[hyper-pwt] react-dom/client: container is required.");
  }
};

const legacyCreateRoot = (container) => {
  ensureContainer(container);
  if (!ReactDOM?.render) {
    throw new Error("[hyper-pwt] react-dom/client: ReactDOM.render is not available in this Mendix React version.");
  }

  return {
    render: (element) => ReactDOM.render(element, container),
    unmount: () => ReactDOM.unmountComponentAtNode?.(container),
  };
};

const legacyHydrateRoot = (container, element) => {
  ensureContainer(container);
  if (ReactDOM?.hydrate) {
    ReactDOM.hydrate(element, container);
  } else if (ReactDOM?.render) {
    ReactDOM.render(element, container);
  } else {
    throw new Error("[hyper-pwt] react-dom/client: ReactDOM.hydrate/render is not available in this Mendix React version.");
  }

  return {
    render: (nextElement) => ReactDOM.render(nextElement, container),
    unmount: () => ReactDOM.unmountComponentAtNode?.(container),
  };
};

const createRoot = ReactDOMClient?.createRoot ?? ReactDOM?.createRoot ?? legacyCreateRoot;
const hydrateRoot = ReactDOMClient?.hydrateRoot ?? ReactDOM?.hydrateRoot ?? legacyHydrateRoot;

export { createRoot, hydrateRoot };
export default (ReactDOMClient ?? { createRoot, hydrateRoot });
`;
};

const buildJsxRuntimeShim = (isDev: boolean) => {
  const runtimeGlobalNames = isDev
    ? ["ReactJSXDevRuntime", "react_jsx_dev_runtime"]
    : ["ReactJSXRuntime", "react_jsx_runtime"];
  const runtimeModuleId = isDev ? "react/jsx-dev-runtime" : "react/jsx-runtime";
  const exportsLines: string[] = [
    buildModuleResolverPrelude(),
    `const __mx_reactNames = ["React"];`,
    `const __mx_runtimeNames = ${JSON.stringify(runtimeGlobalNames)};`,
    `let React = __mx_getGlobalValue(__mx_reactNames);`,
    `if (!React) React = __mx_resolve(["react"]);`,
    `let Runtime = __mx_getGlobalValue(__mx_runtimeNames);`,
    `if (!Runtime) Runtime = __mx_resolve(["${runtimeModuleId}"]);`,
    `if (!Runtime) {`,
    `  console.warn("[hyper-pwt] Mendix React runtime '${runtimeModuleId}' is missing. JSX fallback will use React.createElement.");`,
    `}`,
    `__mx_setGlobalValue(__mx_reactNames, React);`,
    `__mx_setGlobalValue(__mx_runtimeNames, Runtime);`,
    `const createElementFallback = (type, props, key) => {`,
    `  if (!React?.createElement) {`,
    `    throw new Error("[hyper-pwt] React.createElement is unavailable for JSX runtime fallback.");`,
    `  }`,
    `  const nextProps = props ? { ...props } : {};`,
    `  if (key !== undefined) nextProps.key = key;`,
    `  return React.createElement(type, nextProps);`,
    `};`,
    `const Fragment = Runtime?.Fragment ?? React?.Fragment;`,
  ];

  if (isDev) {
    exportsLines.push(`
const jsxDEV =
  Runtime?.jsxDEV ??
  createElementFallback;
export { Fragment, jsxDEV };
export default (Runtime ?? { Fragment, jsxDEV });
`);
  } else {
    exportsLines.push(`
const jsx =
  Runtime?.jsx ??
  createElementFallback;
const jsxs = Runtime?.jsxs ?? jsx;
export { Fragment, jsx, jsxs };
export default (Runtime ?? { Fragment, jsx, jsxs });
`);
  }

  return exportsLines.join("\n");
};

export function mendixHotreloadReactPlugin(): Plugin {
  return {
    name: "mendix-hotreload-react-shim",
    enforce: "pre",
    apply: "serve",
    resolveId(id) {
      if (id === "react") return VIRTUAL_REACT_ID;
      if (id === "react-dom") return VIRTUAL_REACT_DOM_ID;
      if (id === "react-dom/client") return VIRTUAL_REACT_DOM_CLIENT_ID;
      if (id === "react/jsx-runtime") return VIRTUAL_JSX_RUNTIME_ID;
      if (id === "react/jsx-dev-runtime") return VIRTUAL_JSX_DEV_RUNTIME_ID;
      return null;
    },
    load(id) {
      if (id === VIRTUAL_REACT_ID) {
        return buildGlobalShimModule(["React"], REACT_EXPORTS, ["react"]);
      }
      if (id === VIRTUAL_REACT_DOM_ID) {
        return buildGlobalShimModule(["ReactDOM"], REACT_DOM_EXPORTS, [
          "react-dom",
        ]);
      }
      if (id === VIRTUAL_REACT_DOM_CLIENT_ID) {
        return buildReactDomClientShim();
      }
      if (id === VIRTUAL_JSX_RUNTIME_ID) {
        return buildJsxRuntimeShim(false);
      }
      if (id === VIRTUAL_JSX_DEV_RUNTIME_ID) {
        return buildJsxRuntimeShim(true);
      }
      return null;
    },
  };
}
