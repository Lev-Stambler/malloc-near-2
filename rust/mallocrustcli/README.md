mallocrustcli
=============



[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/mallocrustcli.svg)](https://npmjs.org/package/mallocrustcli)
[![Downloads/week](https://img.shields.io/npm/dw/mallocrustcli.svg)](https://npmjs.org/package/mallocrustcli)
[![License](https://img.shields.io/npm/l/mallocrustcli.svg)](https://github.com/Lev-Stambler/mallocrustcli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g mallocrustcli
$ mallocrustcli COMMAND
running command...
$ mallocrustcli (-v|--version|version)
mallocrustcli/0.0.0 linux-x64 node-v14.17.0
$ mallocrustcli --help [COMMAND]
USAGE
  $ mallocrustcli COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`mallocrustcli hello [FILE]`](#mallocrustcli-hello-file)
* [`mallocrustcli help [COMMAND]`](#mallocrustcli-help-command)

## `mallocrustcli hello [FILE]`

describe the command here

```
USAGE
  $ mallocrustcli hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ mallocrustcli hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/Lev-Stambler/mallocrustcli/blob/v0.0.0/src/commands/hello.ts)_

## `mallocrustcli help [COMMAND]`

display help for mallocrustcli

```
USAGE
  $ mallocrustcli help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.2/src/commands/help.ts)_
<!-- commandsstop -->
