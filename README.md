# openevnt-js

The JavaScript and TypeScript libraries for [Open Evnt](https://evnt.directory), a data format for representing events. All of them are on npm in the `@evnt` scope.

The specification, the website and governance live in [openevnt/evnt](https://github.com/openevnt/evnt).

**Packages**

- [@evnt/types](./packages/types/): TypeScript types
- [@evnt/schema](./packages/schema/): Zod schemas
- [@evnt/builder](./packages/builder/): Builder API for events
- [@evnt/partial-date](./packages/partial-date/): Partial Date utilities
- [@evnt/translations](./packages/translations/): Translations utilities
- [@evnt/convert](./packages/convert/): Converters to and from other formats
- [@evnt/pretty](./packages/pretty/): Pretty-printing utilities
- [@evnt/dev](./packages/dev/): CLI for `.evnt.json` files

## Contributing

This monorepo uses [pnpm](https://pnpm.io/) as the package manager.

- `pnpm install` - install dependencies
- `pnpm build` - build all packages
- `pnpm test` - run vitest tests
- `pnpm fmt` - run oxfmt
- `pnpm lint` - run oxlint
