const path = require('node:path');
const fs = require('node:fs');
const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const workspaceEntryPoints = {
  '@folio/ai-contracts': path.join(workspaceRoot, 'packages/ai-contracts/src/index.ts'),
  '@folio/business-workspace': path.join(workspaceRoot, 'packages/business-workspace/src/index.ts'),
  '@folio/domain': path.join(workspaceRoot, 'packages/domain/src/index.ts'),
  '@folio/first-minute': path.join(workspaceRoot, 'packages/first-minute/src/index.ts'),
  '@folio/import-engine': path.join(workspaceRoot, 'packages/import-engine/src/index.ts'),
  '@folio/melo-engine': path.join(workspaceRoot, 'packages/melo-engine/src/index.ts'),
  '@folio/melo-policy': path.join(workspaceRoot, 'packages/melo-policy/src/index.ts'),
  '@folio/open-banking': path.join(workspaceRoot, 'packages/open-banking/src/index.ts'),
  '@folio/plan-engine': path.join(workspaceRoot, 'packages/plan-engine/src/index.ts'),
  '@folio/release-readiness': path.join(workspaceRoot, 'packages/release-readiness/src/index.ts'),
  '@folio/storage': path.join(workspaceRoot, 'packages/storage/src/index.ts'),
  '@folio/store-release': path.join(workspaceRoot, 'packages/store-release/src/index.ts'),
  '@folio/ui': path.join(workspaceRoot, 'packages/ui/src/index.ts'),
};

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(new Set([...(config.watchFolders ?? []), workspaceRoot]));
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, 'node_modules'),
  path.join(workspaceRoot, 'node_modules'),
];

// Worktree support: in a git worktree, node_modules is a junction to the main checkout's
// install (one pnpm install serves every worktree). Metro indexes files by REALPATH, so the
// junction target must be a watch folder and a node_modules root too — otherwise every module
// "does not exist". In a normal checkout realpath === path and this is a no-op.
for (const nm of config.resolver.nodeModulesPaths.slice()) {
  try {
    const real = fs.realpathSync(nm);
    if (real !== nm) {
      config.watchFolders = Array.from(new Set([...config.watchFolders, path.dirname(real)]));
      config.resolver.nodeModulesPaths.push(real);
    }
  } catch {
    // path may not exist (e.g. per-package node_modules in hoisted mode) — fine.
  }
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const workspaceEntryPoint = workspaceEntryPoints[moduleName];

  if (path.isAbsolute(moduleName) && fs.existsSync(moduleName)) {
    return {
      filePath: moduleName,
      type: 'sourceFile',
    };
  }

  if (workspaceEntryPoint) {
    return {
      filePath: workspaceEntryPoint,
      type: 'sourceFile',
    };
  }

  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    const tsCandidate = path
      .resolve(path.dirname(context.originModulePath), moduleName)
      .replace(/\.js$/, '.ts');
    if (fs.existsSync(tsCandidate)) {
      return {
        filePath: tsCandidate,
        type: 'sourceFile',
      };
    }
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
