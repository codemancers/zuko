# Scripts

## launchctld.plist

This LaunchAgent runs the Nx serve targets from this repo.

- Command: `/Users/yuva/passion/agents/node_modules/.bin/nx run-many -t serve`
- Working dir: `/Users/yuva/passion/agents` (via `WorkingDirectory` in the plist)
- PATH: `/Users/yuva/.nvm/versions/node/v22.14.0/bin:/usr/bin:/bin:/usr/sbin:/sbin`
- Logs: `/tmp/zuko.out.log`, `/tmp/zuko.err.log`

### Install

```sh
mkdir -p ~/Library/LaunchAgents
cp ./scripts/launchctld.plist ~/Library/LaunchAgents/com.passion.agents.nx-serve.plist
launchctl load -w ~/Library/LaunchAgents/com.passion.agents.nx-serve.plist
```

### Uninstall

```sh
launchctl unload -w ~/Library/LaunchAgents/com.passion.agents.nx-serve.plist
rm ~/Library/LaunchAgents/com.passion.agents.nx-serve.plist
```
