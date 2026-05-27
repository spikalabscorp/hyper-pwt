# hyper-pwt

<img src="https://raw.githubusercontent.com/repixelcorp/hyper-pwt/main/static/header.png" alt="hyper-pwt" width="100%" height="auto">

A faster, more modern, superior alternative for [Mendix PWT](https://github.com/mendix/widgets-tools).

## How to migration to hyper-pwt?

Bascially, hyper-pwt is a drop-in replacement for Mendix PWT.

First, install hyper-pwt from npm.

```bash
npm install --dev @repixelcorp/hyper-pwt
```

Second, replace pluggable-widgets-tools to hyper-pwt in widget's package.json.

```json
{
  "scripts": {
    "dev": "hyper-pwt start:web",
    "build": "hyper-pwt build:web",
    "lint": "hyper-pwt lint",
    "lint:fix": "hyper-pwt lint:fix",
    "format": "hyper-pwt format",
    "test:unit": "hyper-pwt test:unit:web",
    "prerelease": "npm run lint",
    "release": "hyper-pwt release:web"
  }
}
```

Use `hyper-pwt build:web --production` when you want the production build
path without switching your script to `release:web`.

Third, open tsconfig.json and change extends to hyper-pwt like below.

```json
{
  "extends": "@repixelcorp/hyper-pwt/src/configurations/typescript/tsconfig.base",
  "include": ["./src", "./typings"]
}
```

### I use custom rollup configuration.

First, proceed with the basic replacement process.

If the widget does not function properly after installing hyper-pwt, you can customize your Vite configuration by referring to the [“Custom build configurations”](#custom-build-configurations) section.

## Custom build configurations

### Web

Create vite.config.mjs on your pwt root directory.

```javascript
import { definePWTConfig } from "@repixelcorp/hyper-pwt";

export default definePWTConfig(() => {
  return {
    // Your custom configuration in here.
  };
});
```

hyper-pwt uses the [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react) plugin. The settings for this plugin can be changed as follows.

```javascript
import { definePWTConfig } from "@repixelcorp/hyper-pwt";

export default definePWTConfig(() => {
  return {
    reactPluginOptions: {
      jsxRuntime: "classic",
    },
  };
});
```

definePWTConfig also supports asynchronous mode. It can be used as follows.

```javascript
import { definePWTConfig } from "@repixelcorp/hyper-pwt";

export default definePWTConfig(async () => {
  const promise = await somethingPromise();

  return {};
});
```

### Native

TODO

## Linting and formatting

hyper-pwt runs `lint`, `lint:fix`, and `format` with oxlint and oxfmt.

For drop-in migration, existing Mendix PWT `.eslintrc.js` and
`prettier.config.js` files can remain in the widget project. When no
`.oxlintrc` or `.oxfmtrc` config exists, hyper-pwt applies generated
oxlint/oxfmt compatibility settings that mirror the Mendix PWT Prettier
defaults.

The command targets follow Mendix PWT:

- `lint`: format check for `src`, `typings`, and `tests`, then lint `src`.
- `lint:fix`: format write for `src`, `typings`, and `tests`, then fix `src`.
- `format`: format write for `src`, `typings`, and `tests`.

## Unit testing

hyper-pwt runs `test:unit` and `test:unit:web` with the web Jest
configuration used by Mendix PWT. Jest arguments are passed through, so common
flags such as `--runInBand`, `--coverage`, `--coverage=false`, `--ci`,
`--no-cache`, and `--u` work as they do with PWT. The Mendix
`--subprojectPath <value>` wrapper argument is stripped before Jest is invoked.

The default web unit-test configuration discovers
`src/**/*.spec.{js,jsx,ts,tsx}`, runs in `jsdom`, loads
`@testing-library/jest-dom`, provides `TextEncoder` and `TextDecoder`, and
writes coverage to `dist/coverage` when coverage is enabled.

## Performance compare with Mendix PWT

The results below were obtained using our own tools within the [benchmark directory](./benchmark), and the code for the benchmarked widgets is also available for review.

If you wish to reproduce the benchmark results, you can do so using the tools and widgets within the [benchmark directory](./benchmark).

### Web Widget Build

| Category      | @mendix/pluggable-widgets-tools | @repixelcorp/hyper-pwt | Result                          |
| ------------- | ------------------------------- | ---------------------- | ------------------------------- |
| Build time    | 27475ms                         | 4135ms                 | **-23340.00ms (84.95% faster)** |
| Memory Usage  | 0.11MB                          | 0.08MB                 | **-0.03MB (26.93% less)**       |
| MPK File Size | 1.26MB                          | 557.08KB               | **-731.37KB (56.76% less)**     |

### Native Widget

TODO

## Support pwt tasks

- [x] start:web
- [ ] start:native
- [x] build:web
- [ ] build:native
- [x] release:web
- [ ] release:native
- [x] lint
- [x] lint:fix
- [x] format
- [x] test:unit:web
- [ ] test:unit:native
- [ ] Widget Generator

## Support platforms

- [x] Web
  - [x] Basic Functions
  - [x] Linter and Formatting
  - [x] TDD Functions
- [ ] Native
  - [ ] Basic Functions
  - [ ] Linter and Formatting
  - [ ] TDD Functions

## License

@repixelcorp/hyper-pwt is distributed under the MIT License.

Please refer to the [LICENSE](./LICENSE).

## Disclaimers

### No Warranty

THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. THE DEVELOPERS AND REPIXEL CO., LTD. DO NOT GUARANTEE THAT THE SOFTWARE IS FREE OF BUGS, ERRORS, OR OTHER DEFECTS.

### Limitation of Liability

IN NO EVENT SHALL THE DEVELOPERS OR REPIXEL CO., LTD. BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. THIS INCLUDES, BUT IS NOT LIMITED TO, LOSS OF DATA, DAMAGE TO MENDIX PROJECTS, BUSINESS INTERRUPTION, OR LOST PROFITS. THE ENTIRE RISK AS TO THE QUALITY AND PERFORMANCE OF THE SOFTWARE IS WITH YOU.

### User Responsibility & Data Backup

IT IS THE USER'S SOLE RESPONSIBILITY TO ENSURE THE ADEQUATE BACKUP OF ANY AND ALL DATA, INCLUDING MENDIX PROJECTS, BEFORE USING THIS TOOL. WE STRONGLY RECOMMEND PERFORMING A FULL BACKUP BEFORE RUNNING ANY BUILD PROCESS WITH THIS SOFTWARE.

### Unofficial Tool & Trademarks

This is an unofficial tool developed independently by Repixel Co., Ltd. and is not affiliated with, endorsed, sponsored, or supported by Mendix Technology BV or its parent company Siemens AG.

Mendix® is a registered trademark of Mendix Technology BV. Any use of the Mendix trademark is for nominative purposes only, to identify that this tool is designed to work with the Mendix platform, and does not imply any official association.

### Compatibility & Maintenance

This tool was developed for a specific version of the Mendix platform and its Pluggable Widget Tools (PWT). Future updates to the Mendix platform may break the functionality of this tool without notice. We do not guarantee ongoing compatibility or provide any obligation to maintain, support, update, or otherwise service this software.
