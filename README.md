# Photo tagging

Obsidian plugin for tagging people on photos

  - [Motivation](#motivation)
  - [Installation](#installation)
    - [Obsidian Community Plugins](#obsidian-community-plugins)
    - [Manual installation](#manual-installation)
  - [Manual](#manual)
  - [Tests](#tests)
  - [BDFL](#bdfl)

## Motivation

I have a lot of genealogy data regarding my family and its history. I use Obsidian to work with this data.
At some point, I needed a simple software to tag people on photos and then show a person's photos on their page.
I did not find the existing plugin, so I decided to write my own.

## Installation

> [!IMPORTANT]  
> You must have [`libvips`](https://github.com/libvips/libvips) installed. See installation instructions: https://www.libvips.org/install.html.
>
> Nope, you cannot disable it.

`libvips` is used to generate image tiles (image pyramids). The `photo-tagging` plugin uses it to handle large images.

When the user opens the image in the tagger for the first time, the plugin automatically generates image tiles and a preview image.
The plugin will use them to display and zoom large images effectively.

### Obsidian Community Plugins

The photo-tagging plugin is available in the [Obsidian Community Plugins](https://obsidian.md/help/community-plugins) list. So, you can install it right from the Obsidian app. Here is a direct link to the plugin page: https://community.obsidian.md/plugins/photo-tagging.

### Manual installation

You can install the plugin by downloading the release assets, placing them inside your Obsidian vault, and enabling it in the settings:

1. Go to the [TheBestTvarynka/photo-tagging/releases](https://github.com/TheBestTvarynka/photo-tagging/releases) page and download release assets: `main.js`, `manifest.json`, and `styles.css`.
2. Place these files in the vault plugin directory:

```bash
VAULT_DIR=/path/to/vault
PHOTO_TAGGING_DIR=${VAULT_DIR}/.obsidian/plugins/photo-tagging
mkdir -p ${PHOTO_TAGGING_DIR}
cp main.js ${PHOTO_TAGGING_DIR}
cp styles.css ${PHOTO_TAGGING_DIR}
cp manifest.json ${PHOTO_TAGGING_DIR}
```

3. Enable the Grafily plugin in the Obsidian settings (`Community Plugins` section).

## Manual

1. You manually add tags to photos using the built-in tagger:
   ![](./assets/tagging.png)
   
   You can open tagger from the file context menu (`Tag people` option):
   
   ![](./assets/context_menu.png)
2. Every tag is linked to some note. In my case, every note represents a person.
3. Add the following code block to see the person's photos inside the note:
   ```md
       ```tagged-photos
       ```
   ```
   The plugin automatically resolves photos assigned to the current person:
   
   | Person's plain gallery | Photos are grouped by hashtags |
   |-|-|
   | ![](./assets/profile.png) | ![](./assets/profile_hashtags.png) |

   By default, the block shows photos where the current note is tagged. Add one of these options inside the block to change that:

   | Option | Shows |
   |-|-|
   | `group: hashtags` | Photos where the current note is tagged, grouped by hashtag. |
   | `type: hashtag` | Photos with the hashtag named like the current note. |
   | `hashtag: <name>` | Photos with the `<name>` hashtag. |
4. Select a hashtag in the tagger to open its `tag-<name>` note at the root of the vault. The note is created on first use and contains a block with the `hashtag: <name>` option.

All tags are saved inside JSON file. By default, the JSON file is located in the `photo-tags.json` at the root of the vault.
You can change it in the plugin settings.

## Tests

Integration tests run in a real, isolated Obsidian instance using [`obsidian-integration-testing`](https://github.com/mnaoumov/obsidian-integration-testing). You must have Obsidian and `libvips` installed.

```bash
npm test
```

Each test copies `assets/base_vault` into the `test_vaults/` directory and installs the fresh plugin build there. The copy stays on disk after the run, so you can inspect it.

## BDFL

Did you hear about [BDFL](https://en.m.wikipedia.org/wiki/Benevolent_dictator_for_life)?

TL;DR:

> **Benevolent dictator for life (BDFL)** is a title given to a small number of open-source software development leaders, typically project founders who retain the final say in disputes or arguments within the community.

For the Photo-tagging project, the BDFL is [@TheBestTvarynka (Pavlo Myroniuk)](https://github.com/TheBestTvarynka), original creator of Photo-tagging.
