import { dirname } from 'path';
import { logger } from '@nx/devkit';

/*
 * Babel preset to provide TypeScript support and module/nomodule for Nx.
 */

export interface NxWebBabelPresetOptions {
  useBuiltIns?: boolean | string;
  decorators?: {
    decoratorsBeforeExport?: boolean;
    legacy?: boolean;
  };
  loose?: boolean;
  /** @deprecated Use `loose` option instead of `classProperties.loose`
   */
  classProperties?: {
    loose?: boolean;
  };
}

module.exports = function (api: any, options: NxWebBabelPresetOptions = {}) {
  api.assertVersion(7);

  const isModern = api.caller((caller) => caller?.isModern);

  // use by @nx/cypress react component testing to prevent core js build issues
  const isTest = api.caller((caller) => caller?.isTest);

  // This is set by `@nx/rollup:rollup` executor
  const isNxPackage = api.caller((caller) => caller?.isNxPackage);

  const emitDecoratorMetadata = api.caller(
    (caller) => caller?.emitDecoratorMetadata ?? true
  );

  // Determine settings  for `@babel//babel-plugin-transform-class-properties`,
  // so that we can sync the `loose` option with `@babel/preset-env`.
  // TODO(v18): Remove classProperties since it's no longer needed, now that the class props transform is in preset-env.
  const loose = options.classProperties?.loose ?? options.loose ?? true;
  if (options.classProperties) {
    logger.warn(
      `Use =\`loose\` option instead of \`classProperties.loose\`. The \`classProperties\` option will be removed in Nx 18`
    );
  }

  return {
    presets: [
      // Support module/nomodule pattern.
      [
        require.resolve('@babel/preset-env'),
        // For Jest tests, NODE_ENV is set as 'test' and we only want to set target as Node.
        // All other options will fail in Jest since Node does not support some ES features
        // such as import syntax.
        isTest || process.env.NODE_ENV === 'test'
          ? { targets: { node: 'current' }, loose: true }
          : {
              // Allow importing core-js in entrypoint and use browserslist to select polyfills.
              useBuiltIns: options.useBuiltIns ?? 'entry',
              corejs: 3,
              // Do not transform modules to CJS
              modules: false,
              targets: isModern ? { esmodules: 'intersect' } : undefined,
              bugfixes: true,
              // Exclude transforms that make all code slower
              exclude: ['transform-typeof-symbol'],
              // This must match the setting for `@babel/plugin-proposal-class-properties`
              loose,
            },
      ],
      [
        require.resolve('@babel/preset-typescript'),
        {
          allowDeclareFields: true,
        },
      ],
    ],
    plugins: [
      !isNxPackage
        ? [
            require.resolve('@babel/plugin-transform-runtime'),
            {
              corejs: false,
              helpers: true,
              regenerator: true,
              useESModules: isModern,
              absoluteRuntime: dirname(
                require.resolve('@babel/runtime/package.json')
              ),
            },
          ]
        : null,
      require.resolve('babel-plugin-macros'),
      emitDecoratorMetadata
        ? require.resolve('babel-plugin-transform-typescript-metadata')
        : undefined,
      // Must use legacy decorators to remain compatible with TypeScript.
      [
        require.resolve('@babel/plugin-proposal-decorators'),
        options.decorators ?? { legacy: true },
      ],
    ].filter(Boolean),
    overrides: [
      // Convert `const enum` to `enum`. The former cannot be supported by babel
      // but at least we can get it to not error out.
      {
        test: /\.tsx?$/,
        plugins: [
          [
            require.resolve('babel-plugin-const-enum'),
            {
              transform: 'removeConst',
            },
          ],
        ],
      },
    ],
  };
};
