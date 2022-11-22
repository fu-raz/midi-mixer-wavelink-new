# WaveLink MIDI Mixer Plugin for 1.6+

This plugin was created as a proof of concept for the new WaveLink 1.6 software. Elgato made a lot of changes to how their client works. I first started using MIDI Mixer with the WaveXLR plugin from Anais Betts (https://github.com/anaisbetts/midi-mixer-wavexlr). When the new version of WaveLink dropped, their plugin stopped working. I couldn't get the new version to work with her code, so I had to start over.

This is by no means a plugin that I'm going to support, but it does sort of work.

## What's working

### Input
- Mixers are added to MIDI Mixer for all your WaveLink channels
- Mixer volume is synced with WaveLink bi-directionally
- Mute buttons work
- Linked sliders adjust volume for both monitor and stream bi-directionally

### Output
- Mixers are added for Monitor Mix and Stream Mix
- Mute buttons work

## What's probably broken, but will be fixed
- Right now the plugin only works when WaveLink is already running, no idea what happens when you boot the PC and plugin is loaded
- If you add or remove channels in WaveLink they don't delete/sync with the plugin

## What's NOT working
- Settings page can't be filled dynamically, so there's no way I can add a switch output button. Even if I wanted to
- Right now, there's no way to detect when sliders are linked or unlinked and there's also no way to link or unlink from MIDI mixer. If I find a way to do that, I'll add it.