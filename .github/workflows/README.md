# Release workflow

`release.yaml` publishes `@shiianamchi/hyper-pwt` to npm through npm Trusted
Publishing. It replaces the former separate mainline and canary workflows because
npm allows only one trusted publisher workflow per package.

Before the workflow can publish, a package maintainer must configure the trusted
publisher on npm:

```bash
npm trust github @shiianamchi/hyper-pwt --repo shiianamchi/hyper-pwt --file release.yaml
```

After the first successful trusted publish, remove any old npm publish secret
from GitHub Actions and disable token-based publishing in the npm package
settings.
