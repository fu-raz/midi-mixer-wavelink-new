# MIDI Mixer WaveLink 1.6+ Plugin 

This plugin was created as a proof of concept for the new WaveLink 1.6 software. Elgato made a lot of changes to how their client works. I first started using MIDI Mixer with the WaveXLR plugin from Anais Betts (https://github.com/anaisbetts/midi-mixer-wavexlr). When the new version of WaveLink dropped, their plugin stopped working. I couldn't get the new version to work with their code, so I had to start over.

This is by no means a plugin that I'm going to support, but it does sort of work.

## About the code

Yeah I know, this was made with the template and I should've done this in TypeScript and use build scripts and whatever. I didn't, so yeah.

## What's working

### Plugin
- Reconnects to WaveLink when connection is lost

### Input
- Mixers are added to MIDI Mixer for all your WaveLink channels
- Mixer volume is synced with WaveLink bi-directionally
- Mute buttons work
- Linked sliders adjust volume for both monitor and stream bi-directionally

### Output
- Mixers are added for Monitor Mix and Stream Mix
- Mute buttons work

### Switching monitormix outputs
- I've implemented an ALPHA feature that allows you to select output devices in the settings page. After selecting the outputs you want and reloading the plugin, you will get buttons for each output and a switch rotation button. The output buttons will change the monitormix device in WaveLink to the selected device. The rotation button will toggle (or rotate if you select more than 2) between the selected devices.
Please know that this is a real ugly way to do this, but it was the only way I was able to do it with the current settings. If MIDI Mixer allows more dynamic settings pages, I might rewrite it. I don't know what happens when devices are unplugged or the computer is rebooted. This is really just a proof of concept.

## What's probably broken, but will be fixed
- If you add or remove channels in WaveLink they don't delete/sync with the plugin

## What's NOT working
- Right now, there's no way to detect when sliders are linked or unlinked and there's also no way to link or unlink from MIDI mixer. If I find a way to do that, I'll add it.
