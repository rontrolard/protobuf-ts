#!/usr/bin/env node

// wraps protoc installed by install.js for calling with `npx protoc`
// adds the following special behaviour:
// 1. add a --proto_path argument to the include/ directory of the release
// 2. add a --plugin argument for all plugins found in node_modules/.bin

const {spawnSync} = require('child_process');
const {listInstalled, findProtocPlugins} = require('./util');

let release = listInstalled()[0];
if (!release) {
    console.error("protoc not found. Looks like something went wrong during installation.");
    process.exit(1);
    return;
}

let command = release.protocPath;
let args = [
    // pass all arguments to the process
    ...process.argv.slice(2),
    // add the "include" directory of the installed protoc to the proto path
    // do this last, otherwise it can shadow a user input
    "--proto_path", release.includePath,
];

// search for any protoc-gen-xxx plugins in .bin and add --plugin arguments for them
for (let plugin of findProtocPlugins(process.cwd())) {
    args.unshift("--plugin", plugin);
}

let child = spawnSync(command, args, {
    // protoc accepts stdin for some commands, pipe all IO
    stdio: [process.stdin, process.stdout, process.stderr],
    shell: false
});

if (child.error) {
    console.error("Unable to spawn protoc. " + child.error);
    process.exit(1);
}
process.exit(child.status);
