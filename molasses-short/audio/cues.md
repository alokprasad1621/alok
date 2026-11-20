# The Bridge That Fell for a Song - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `sfx_gen.py` / `instruments.py`, placed by `sfx.py` / `music.py`, mixed by `mix.py`.
Voice = `voice/voice.wav`, gain only (no EQ, no compression, no pitch).

## Files
| file | content |
|---|---|
| `mix.wav` | final mix, 48 kHz, stereo, 24-bit, 3,240,000 samples = 67.500 s |
| `stem_voice.wav` / `stem_music.wav` / `stem_sfx.wav` | stems at mix gain (they sum to the mix before the master limiter) |

## Master loudness (own BS.1770-4 meter)
- Integrated **-15.0 LUFS**, true peak **-1.2 dBTP**, LRA 2.3 LU, max momentary -11.9 LUFS, max short-term -13.5 LUFS
- Stems: voice -14.0 LUFS, music -24.5 LUFS, sfx -28.9 LUFS (voice gain +3.65 dB, same gain on every stem)
- Master limiter (4x oversampled look-ahead, ceiling -1.2 dBTP): max gain reduction 3.89 dB, active (>0.1 dB) on 62.09 % of samples, >0.5 dB on 31.86 %

ffmpeg ebur128 cross-check:
```
ffmpeg check failed: [Errno 2] No such file or directory: 'ffmpeg'
```

## Voice on top: per-section loudness (LUFS, integrated per stem, at mix gain)
bed = music + sfx. margin = voice - bed (integrated over the section). speech median / p10 = median and 10th percentile of the 400 ms momentary margin (voice - bed) over windows centred on spoken words.

| section (shots) | time s | voice | music | sfx | bed | margin LU | speech median LU | speech p10 LU |
|---|---|---|---|---|---|---|---|---|
| hook (1) | 0.00-4.33 | -13.7 | -23.4 | -34.9 | -23.1 | 9.5 | 9.7 | 8.3 |
| town (2) | 4.33-10.87 | -14.0 | -24.3 | -39.6 | -24.2 | 10.2 | 10.2 | 6.2 |
| march (3) | 10.87-15.67 | -14.8 | -25.0 | -37.1 | -24.7 | 10.0 | 10.2 | 6.4 |
| bounce (4-5) | 15.67-23.13 | -13.8 | -24.9 | -34.5 | -24.4 | 10.7 | 10.2 | 7.4 |
| whistle (6) | 23.13-28.57 | -14.2 | -22.6 | -29.7 | -21.8 | 7.6 | 7.9 | 4.2 |
| groan (7) | 28.57-31.60 | -13.5 | -25.4 | -29.3 | -24.0 | 10.5 | 10.1 | 6.8 |
| snap+fall (8) | 31.60-36.63 | -13.7 | -23.8 | -22.1 | -21.2 | 7.5 | 8.2 | 2.4 |
| water (9-10) | 36.63-42.07 | -13.8 | - | -27.5 | -27.5 | 13.7 | 15.3 | 9.2 |
| sway (11) | 42.07-45.30 | -13.3 | -27.0 | -44.4 | -27.0 | 13.6 | 14.8 | 11.6 |
| swing (12) | 45.30-47.43 | -14.1 | -25.0 | -33.3 | -24.4 | 10.2 | 10.6 | 8.2 |
| march2 (13) | 47.43-54.13 | -14.7 | -26.3 | -41.8 | -26.2 | 11.4 | 11.4 | 8.8 |
| rule (14) | 54.13-60.30 | -14.2 | -25.0 | -29.4 | -23.7 | 9.4 | 11.2 | 5.0 |
| tourists (15) | 60.30-66.00 | -13.2 | -24.9 | -35.1 | -24.5 | 11.3 | 12.3 | 9.3 |

## Music map (original march, Bb major, 120 bpm: quarter note = footfall)
Music target per section, LU under the voice (after a -3 dB speech duck keyed from words.json): hook -9.5, town -10.5, march -10.0, bounce -10.0, whistle -9.5, tension -10.0, sway -12.0, swing -11.5, march2 -10.5, rule -11.5, tourists -11.0. Applied section gains (dB): hook -8.6, town -4.1, march -8.2, bounce -8.4, whistle -6.2, tension -8.6, sway -8.4, swing -8.3, march2 -6.5, rule -6.3, tourists -8.1, dropout -8.6.

Rides (music only, dB): 3.65-4.30 s -3.0, 26.95-27.36 s -2.0, 32.20-32.77 s -4.0, 61.25-61.98 s -3.0 - so quiet sentence-final words stay on top and the band blooms in the gaps after them. The hook's last two footfalls (3.5, 4.0) are also 3 dB lower in the SFX for '...walking across it.'

| time s | frame | music |
|---|---|---|
| 0.00 | 0 | hook: theme A1-A2 tutti, 7 whistlers, tuba/after-beats/snare; snare fill 3.0-4.3 under 'across it.' |
| 4.33 | 130 | Bb button + light clash exactly on the white flash (frame 130), then the band is gone |
| 5.00 | 150 | story: theme A1-A2 light (glock + fife, tuba on 1/3, horns on 2/4, light snare) |
| 9.00 | 270 | full band: theme A3-A8 (cymbal), boots are the bass drum |
| 15.00 | 450 | tuba switches to bouncing octaves as the bridge starts bouncing |
| 21.00 | 630 | vamp bar, no melody: room for 'Somebody starts whistling' |
| 22.25 | 668 | solo whistler: 3-note pickup D-Eb-F into theme A on 23.0 (in Bb, on the beat) |
| 23.75 | 712 | the column joins the whistling (8 more whistlers by 24.75) |
| 29.22 | 877 | whistlers falter one by one (pitch droops, 29.2-29.7): faces turn nervous |
| 29.50 | 885 | tension: F7 pedal, tuba eighths, snare drive |
| 31.00 | 930 | chromatic climb F7 - F#dim7 - Gm - G#dim7, glock ticking 16ths, snare roll crescendo |
| 33.00 | 990 | DEAD STOP on 'Then,' - music silent through the bolt, the drop and the two-feet-deep joke |
| 43.43 | 1303 | warm return: pad Bb - Eb/Bb - Bb - F7, soft low brass, vibes pendulum on each sway extreme (84 bpm) |
| 47.24 | 1417 | music-box waltz (116 bpm, 3/4): one bar per swing cycle, pizzicato oom-pah-pah |
| 48.79 | 1464 | pushes 48.79 / 50.34 / 51.89 / 53.44 = downbeats (tiny triangle ting), melody climbs each bar |
| 53.62 | 1609 | music-box run up 'higher and higher' into the march |
| 54.00 | 1620 | march returns soft and golden, 6 whistlers, theme A1-A2 |
| 58.85 | 1766 | snare roll pp-mf into the rule |
| 59.33 | 1780 | brass stab Bb + timpani on hammer blow 1 ('rule'), F on blow 2 ('Never'), Bb + cymbal on blow 3 ('step') |
| 62.00 | 1860 | relaxed tourist version: swung, laid-back vibes melody, walking pizzicato bass, brushes |
| 65.20 | 1956 | final Bb chord on 'tourists' (66.72-67.24), rings out, faded to silence at 67.5 |

## SFX events
Level convention: every EVENT has a naive level (LU vs the voice stem, as the event's max momentary loudness); applied = naive - 6 dB (standard mix rule) + distance/intensity offsets. BEDS are integrated loudness, not reduced. 'mix LUFS' = the event's max momentary loudness in the final mix (voice stem = -14.0 LUFS integrated). Column sounds also get the camera-distance low-pass and more valley reverb.

| # | time s | frame | cue | what | naive LU | applied LU | mix LUFS | pan |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.0 | hook_groans | the tank still groaning in the flash-forward, far behind | -14 | -20.0 | -34.0 | -0.35 |
| 2 | 0.000 | 0.0 | hook_roar | the flash-forward: the surge already roaring down the street under the voice | -14 | -20.0 | -34.0 | -0.30 |
| 3 | 4.333 | 130.0 | amb_town (bed, integrated) | Commercial Street, cold morning: breeze, sparrows, distant industry (shots 2-7) | -30 | -30.0 | -44.0 | +0.00 |
| 4 | 4.333 | 130.0 | flash_whoosh | reverse swell into the white flash (frame 130) + soft low whoomp | -5 | -11.0 | -25.0 | +0.00 |
| 5 | 4.333 | 130.0 | tank_groans | steel groans rising out of the tank over the whole setup (shots 3-7) | -8 | -14.0 | -28.0 | +0.25 |
| 6 | 11.267 | 338.0 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 7 | 12.317 | 369.5 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 8 | 13.367 | 401.0 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 9 | 14.417 | 432.5 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 10 | 15.467 | 464.0 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 11 | 16.517 | 495.5 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 12 | 17.567 | 527.0 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 13 | 18.617 | 558.5 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 14 | 19.667 | 590.0 | seam_drip | molasses drips into a bucket at the seam | -20 | -26.0 | -40.0 | -0.15 |
| 15 | 19.900 | 597.0 | tank_tick | metal fatigue tick, nearer each time | -16 | -22.0 | -36.0 | +0.20 |
| 16 | 21.500 | 645.0 | tank_tick | metal fatigue tick, nearer each time | -15 | -21.0 | -35.0 | +0.20 |
| 17 | 22.700 | 681.0 | tank_tick | metal fatigue tick, nearer each time | -14 | -20.0 | -34.0 | +0.20 |
| 18 | 24.000 | 720.0 | tank_tick | metal fatigue tick, nearer each time | -13 | -19.0 | -33.0 | +0.20 |
| 19 | 24.350 | 730.5 | uneasy_murmur | workers unsettled at the wall: 'ugh' / 'oh' + a hushed word | -18 | -24.0 | -38.0 | +0.00 |
| 20 | 25.200 | 756.0 | tank_tick | metal fatigue tick, nearer each time | -12 | -18.0 | -32.0 | +0.20 |
| 21 | 25.700 | 771.0 | uneasy_murmur | workers unsettled at the wall: 'ugh' / 'oh' + a hushed word | -18 | -24.0 | -38.0 | +0.00 |
| 22 | 26.300 | 789.0 | tank_tick | metal fatigue tick, nearer each time | -11 | -17.0 | -31.0 | +0.20 |
| 23 | 26.900 | 807.0 | uneasy_murmur | workers unsettled at the wall: 'ugh' / 'oh' + a hushed word | -18 | -24.0 | -38.0 | +0.00 |
| 24 | 27.200 | 816.0 | tank_tick | metal fatigue tick, nearer each time | -10 | -16.0 | -30.0 | +0.20 |
| 25 | 27.900 | 837.0 | tank_tick | metal fatigue tick, nearer each time | -9 | -15.0 | -29.0 | +0.20 |
| 26 | 28.400 | 852.0 | tank_tick | metal fatigue tick, nearer each time | -8 | -14.0 | -28.0 | +0.20 |
| 27 | 31.067 | 932.0 | rivet_cracks | RIVETS FIRE OFF LIKE RIFLE SHOTS: a dozen steel cracks marching down the seam | -2 | -8.0 | -22.0 | +0.15 |
| 28 | 32.133 | 964.0 | burst_snap | THE TANK UNZIPS: low crack + the whole shell letting go | -2 | -8.0 | -22.0 | -0.10 |
| 29 | 32.153 | 964.6 | burst_gas | two million gallons let go: air push + the giant brown surge starts | +0 | -6.0 | -20.0 | -0.15 |
| 30 | 32.183 | 965.5 | burst_splash | molasses slams the street: heavy thud + thick splash + bubble cloud | -1 | -7.0 | -21.0 | +0.00 |
| 31 | 32.253 | 967.6 | burst_crowd | the street screams | -5 | -11.0 | -25.0 | +0.00 |
| 32 | 33.033 | 991.0 | gush_roar | the front sweeps on: continuous thick rushing that follows the camera | -6 | -12.0 | -26.0 | -0.25 |
| 33 | 34.733 | 1042.0 | lid_land | the tank lid lands on the street: steel gong + ground thud + settle | -4 | -10.0 | -24.0 | +0.20 |
| 34 | 34.823 | 1044.7 | lid_land | the tank lid lands on the street: steel gong + ground thud + settle | -4 | -10.0 | -24.0 | +0.20 |
| 35 | 36.633 | 1099.0 | amb_flood (bed, integrated) | molasses all around the stuck ones: thick lapping, slow bubbles, wet dragging (shots 9-10) | -18 | -18.0 | -32.0 | +0.00 |
| 36 | 36.713 | 1101.4 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.66 |
| 37 | 36.783 | 1103.5 | flee_crowd | everyone runs: shouts, whoas, splashing chaos | -8 | -14.0 | -28.0 | +0.00 |
| 38 | 36.798 | 1104.0 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.54 |
| 39 | 36.883 | 1106.5 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.41 |
| 40 | 36.968 | 1109.0 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.29 |
| 41 | 37.053 | 1111.6 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.12 |
| 42 | 37.138 | 1114.1 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.25 |
| 43 | 37.223 | 1116.7 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | -0.17 |
| 44 | 37.308 | 1119.2 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.01 |
| 45 | 37.393 | 1121.8 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.01 |
| 46 | 37.478 | 1124.3 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.31 |
| 47 | 37.563 | 1126.9 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.18 |
| 48 | 37.648 | 1129.5 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.51 |
| 49 | 37.733 | 1132.0 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.57 |
| 50 | 37.818 | 1134.5 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.64 |
| 51 | 37.903 | 1137.1 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.77 |
| 52 | 37.988 | 1139.6 | running_feet | wet running footsteps past the lens | -12 | -18.0 | -32.0 | +0.82 |
| 53 | 38.500 | 1155.0 | groans | hurt people sitting in the settled flood | -13 | -19.0 | -33.0 | +0.00 |
| 54 | 38.533 | 1156.0 | wading_slosh | slow dragging in waist-deep molasses | -16 | -22.0 | -36.0 | +0.04 |
| 55 | 39.600 | 1188.0 | groans | hurt people sitting in the settled flood | -13 | -19.0 | -33.0 | +0.00 |
| 56 | 40.100 | 1203.0 | groans | hurt people sitting in the settled flood | -13 | -19.0 | -33.0 | +0.00 |
| 57 | 40.133 | 1204.0 | wading_slosh | slow dragging in waist-deep molasses | -16 | -22.0 | -36.0 | +0.12 |
| 58 | 41.000 | 1230.0 | groans | hurt people sitting in the settled flood | -13 | -19.0 | -33.0 | +0.00 |
| 59 | 41.733 | 1252.0 | wading_slosh | slow dragging in waist-deep molasses | -16 | -22.0 | -36.0 | +0.54 |
| 60 | 42.067 | 1262.0 | amb_golden (bed, integrated) | golden-hour calm over the settled flood: soft breeze, blackbirds, crickets, laps (shots 11-13) | -29 | -29.0 | -43.0 | +0.00 |
| 61 | 45.700 | 1371.0 | stoop_babble | warm voices at the stoop | -20 | -26.0 | -40.0 | +0.00 |
| 62 | 47.000 | 1410.0 | cork_pop | the bottle gives: cork clink + fizz burst in the golden quiet | -8 | -14.0 | -28.0 | +0.25 |
| 63 | 48.433 | 1453.0 | lap_far | the flood settling: thick lazy lap against the stoops | -22 | -28.0 | -42.0 | +0.13 |
| 64 | 50.833 | 1525.0 | lap_far | the flood settling: thick lazy lap against the stoops | -22 | -28.0 | -42.0 | +0.10 |
| 65 | 53.233 | 1597.0 | lap_far | the flood settling: thick lazy lap against the stoops | -22 | -28.0 | -42.0 | -0.60 |
| 66 | 54.133 | 1624.0 | amb_pad (bed, integrated) | by the pad again: breeze, sparrows, a wagon far off (shot 14) | -27 | -27.0 | -41.0 | +0.00 |
| 67 | 54.400 | 1632.0 | onlooker_murmur | neighbours watching the sign: approving murmurs | -19 | -25.0 | -39.0 | +0.00 |
| 68 | 56.100 | 1683.0 | onlooker_murmur | neighbours watching the sign: approving murmurs | -19 | -25.0 | -39.0 | +0.00 |
| 69 | 59.243 | 1777.3 | hammer_swish | hammer swing | -20 | -26.0 | -40.0 | +0.30 |
| 70 | 59.333 | 1780.0 | hammer | hammer blow 1/3 nailing the sign: steel 'tink' + board 'thock' + post | -5 | -11.0 | -25.0 | +0.30 |
| 71 | 59.510 | 1785.3 | hammer_swish | hammer swing | -20 | -26.0 | -40.0 | +0.30 |
| 72 | 59.600 | 1788.0 | hammer | hammer blow 2/3 nailing the sign: steel 'tink' + board 'thock' + post | -5 | -11.0 | -25.0 | +0.30 |
| 73 | 59.777 | 1793.3 | hammer_swish | hammer swing | -20 | -26.0 | -40.0 | +0.30 |
| 74 | 59.867 | 1796.0 | hammer | hammer blow 3/3 nailing the sign: steel 'tink' + board 'thock' + post | -4 | -10.0 | -24.0 | +0.30 |
| 75 | 60.300 | 1809.0 | amb_town_end (bed, integrated) | warm afternoon on the clean street: breeze, sparrows, flags (shot 15) | -29 | -29.0 | -43.0 | +0.00 |
| 76 | 60.800 | 1824.0 | shovel_scrape | molasses scraped off the cobbles | -17 | -23.0 | -37.0 | -0.50 |
| 77 | 60.900 | 1827.0 | cleanup_murmur | the sweet-tooth kids + the adults: light chatter and laughing | -15 | -21.0 | -35.0 | +0.00 |
| 78 | 62.700 | 1881.0 | shovel_scrape | molasses scraped off the cobbles | -17 | -23.0 | -37.0 | -0.32 |
| 79 | 63.400 | 1902.0 | kid_giggles | two kids giggling over the traded candy, right on the ending | -13 | -19.0 | -33.0 | +0.00 |
