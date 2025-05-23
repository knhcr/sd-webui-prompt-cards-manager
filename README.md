# Prompt Cards Manager
[日本語README](./README_ja.md)

## Overview
This is an extension for [AUTOMATIC1111/stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui) that allows you to manage prompts and negative prompts using card-based GUI, similar to that of LoRA. You can register any prompts for any images, and this extension display the images as cards in the **PromptCards** tab of Extra Networks.
By clicking on a card, you can input the registered prompt or replace a prompt that has already been entered by another card.

Additionally, as an extra feature, a mini gallery that always displays the generated image is added to the right side of the prompt area. This allows you to adjust the prompt while previewing the generated results without switching back and forth to the Generation tab. (If not needed, it can be hidden in the `Settings`.)


![inserted_text](./docs/images/01_title.png)

* Example uses:
  - Reuse favorite prompts with a single card click
  - Switch parts of prompts (characters, poses, situations) with a card click
  - Manage prompts for LoRAs that have learned multiple concepts (clothing, characters) as cards for each concept
  - Manage complex prompts combining multiple LoRAs or wildcards, etc, as a single card
etc.

If you use forge WebUI, you can also set the card image directly to ControlNet by clicking a dedicated button.
(Currently only for forge builtin ControlNet)

Note that this extension does not have features to automatically generate prompts or apply them randomly.


-----------------------------------------------------------------------------------------------------------------------------
## Update History
* 2025/04/21
  - Changed shortcut key folder selection behavior
    + Select a category from another category resumes past selected position.
    + `Shift` - `Ctrl` - `<Num>` : Select Reverse order
    + `Shift` - `Ctrl` - `0` : Redo Select Folder (Same as `Alt` - `0`)

* 2025/04/21
  - bugfix. Stabilized initial page open and card refresh.

* 2025/04/19
  - Changed control belt buttons
    + Added refresh only current selected dir button,
    + Removed toggle show tree view button,
    + Added toggle show card name,
    + Changed behavior of show description button. If enabled, clicking the name area of card will select its directory, instead of inserting prompt.
  - Changed card click behavior
    + When clicking on the same card as the one clicked immediately before, if there have been changes to the content of the prompt, modify it so that the card's content overwrites the existing content instead of deleting it.

* 2025/04/16
  - Changed to refresh the card view when you altered its info without pushing refresh button.
  - Changed PromptCards tab height.

* 2025/04/12
  - Added CNet image horizontal mirror button at Mini Gallery.

* 2025/04/11
  - Added CNet mask editor function. You can open it by roller icon button in Mini Gallery.
  - Changed category shorcut key behavior. Now collapse another category than currently selected.
  - bug fix. Stabilized behavior on changing Extra Networks tabs.

* 2025/04/02
  - Changed Card Edit Window Resolution button behavior.

* 2025/04/02
  - Added functionality for opening current card folder via Windows Explorer. (Windows Only)
  - Changed card display option checkboxes to icon buttons.
  - Added category alias functionality. ([category alias](#assigning-category-name-for-each-folders))
  - bug fix.

* 2025/03/31
  - Added yellow border to cards without card info json file.
  - bug fix. around Card refresh function.

* 2025/03/30
  - bug fix. Changed to trim thumbnail cache file name when the original file's path length is too long.

* 2025/03/27
  - bug fix. Stabilized around Card refresh function.

* 2025/03/25
  - Added Seed Controller to Mini Gallery. Now you can select hide or show for each controls.
  - Improved `Ctrl - <0-9>` shortcut key's behavior ([shortcut keys](#keyboard-shortcut)).
  - Improved directory tree view's appearance
  - bug fix

* 2025/03/23
  - Improved display style
  - Added two textboxes for card search (Prompt search and Description search).
  - bug fix

* 2025/03/22
  - Added shortcut keys for Category switch in PromptCards tab ([shortcut keys](#keyboard-shortcut)).
  - Improved Mini Gallery functionality.

* 2025/03/20
  - Added Resolution Slider and CNet checkbox to mini gallery
  - Added shortcut key for saving with `Ctrl-S` at Card Edit page. (Optional)

* 2025/03/19
  - Added Mini Gallery
    + At the right side of prompt textarea, now you can always see a small gallery component
      which shows the image generation result. ([Sample](#mini-gallery))
    + If you don't need this, uncheck the option to hide that at `Settings` page. (Show by default)

* 2025/03/18
  - Adjusted Card display
    + Added `ShowDirName` Checkbox, where you can toggle display folder path or not.
    + Normalized folder path separator to `/`.
    + Removed file name extension from card display.
  - Added an option to choose `Ctrl+Q` key for canceling Card Edti page instead of `Esc`.
  - Added an option to fix [sd-dynamic-prompts](https://github.com/adieyal/sd-dynamic-prompts) 's template pasting behavior.
    + Enabling the `Fix sd-dynamic-prompts 'Template:' pasting behavior` option in this extension's Settings,
      the issue, where all comment lines that were saved as template in png_info with sd-dynamic-prompts’ `Save template to metadata` option are completely removed when restoring as generation parameters from images, will be fixed.
      (Disabled by default)
  - Bug fix.

* 2027/03/17
  - Added an option to ignore `.` starting files and dirs (such as `.git`)

* 2025/03/15
  - First version


-----------------------------------------------------------------------------------------------------------------------------
## Prerequisites
* This extension inserts prompts surrounded by decorative lines starting with `#`.
  Make sure you have another extension installed that treats lines starting with `#` as comments.
  - For example, [sd-dynamic-prompts](https://github.com/adieyal/sd-dynamic-prompts) has such functionality
  - Also, if you're using a forge-based WebUI, it probably comes with this functionality by default
  - You can operate without using decorative lines by turning off `Replace Mode` ([described later](#prompt-registration-modal-window)), but in that case, prompt replacement cannot be performed


-----------------------------------------------------------------------------------------------------------------------------
## How to Use
### Card Preparation
#### Image Placement
* Place any image files in the `extensions/sd-webui-prompt-cards-manager/prompt_cards` folder.
  - This extension recognizes `.png`, `.jpg`, `.jpeg`, `.webp` files.
  - By default, files and dirs starting with `.` (such as `.git`) are ignored.
    If you needs them, you can set the option to not to be ignored in the Settings section.


* Like LoRA, you can create subfolders to classify and manage cards more easily.
  - This extension treats the first-level folder name as the "**category**" of that card.
    + You can assign category name for each folder separately other than its folder name.

* After you placed images in the folder, press the refresh button in the top right of the PromptCards tab,
  the placed images will be displayed as cards.


##### Assigning Category name for each folders
* For example, when you creates `character_001` and `character_002` folders, and you want to assign category `character` to both of them.

* How to assign
  1. Create new empty text file in `promt_cards` folder, and set its name to `_category_alias.yaml`.
  2. Write category name you want to assign into the text file in the format `"folder name": "category name"`, one per line.
    - `*` matches any text.

* e.g. : Assign `character` to all folders starting with `character_`, and `pose` to all folders with `pose_`.

```yaml
"character_*": "character"
"pose_*": "pose"
```


#### Registering Prompts to Cards
* Press the Card Edit button (`i` button) in the top right of the card to display the prompt registration modal screen ([described later](#prompt-registration-modal-window)),
  enter the prompts you want to register in Prompt and Negative Prompt, and press Save
![example](./docs/images/02_btn_edit.png)


### Using Cards
* Clicking a card will apply the registered Prompt and Negative Prompt
  - Prompts are surrounded by decorative lines that include the category name (= 1st-level subfolder name)
    + If decorative lines with the same category name already exist, they will be replaced
    + Otherwise, they will be added to the end
  - Clicking the same card consecutively toggles between applying and removing the prompt

* Since this extension just performs text input, you can freely edit prompts including those in decorative lines
  - If you click a card of the same category again, all content within the decorative lines will be deleted and replaced
  - Since the decorative lines are used as markers for detection, if you change the decorative lines, the replacement target cannot be detected and prompt will be added to the bottom of the current prompt

* The cards with `Replace Mode` uncehcked ([described later](#prompt-registration-modal-window)) will not use decorative lines, and the registered prompts will simply be added to the bottom of Prompt / Negative Prompt.


![example](./docs/images/03_prompt.png)

#### Using ControlNet
* For the cards with `CNet Enabled` checked ([described later](#prompt-registration-modal-window)), a button for setting the card image to ControlNet will be displayed
  - With clicking this button, the card image is automatically put in the ControlNet unit-0.
  - ControlNet settings can be configured in the WebUI's Settings tab (currently cannot be changed per card)
  - After changing `CNet Enabled` check/uncheck, you need to press refresh button in the card list view to redraw the button display
  - Currenly a1111 is not supported. (Only for forge builtin ControlNet)


![example](./docs/images/04_btn_cnet.png)

-----------------------------------------------------------------------------------------------------------------------------
# Screen Descriptions
## Extra Networks Prompt Cards Tab
* You can choose both tree style view and directory style view
  - `Settings` > `Stable Diffusion` > `Extra Networks` > `Extra Networks directory view style`
  - When you change this setting, you need to restart WebUI server

![example](./docs/images/tree.png)

### Keyboard Shortcut
  - `Ctrl - 1 ~ 9` : You can switch Category 1st to 9th from above listed in tree view. By pressing continuously, you can traverse the subfolders of the target category.
    + `Shift - Ctrl - 1 ~ 9` : Select in reverse order.
  - `Ctrl - 0` / `Alt - 0` : You can Undo / Redo for Category switching.
    + `Shift - Ctrl - 0` : Also Redo selection.


### Control Belt
  - `Image Fit` button : whether to display card images fitted.
  - `Show Description` button : whether to display cards' descriptions.
  - `Show DirName` button : whether to display cards' folder path.
  - `Show SubDir` button : whether to display the cards in subfolders of the selected folder.
  - `Prompt Search` textbox filters cards by Prompt text of cards.
    + Both whitespace and comma work as word separator. (AND condition)
  - `Description Search` textbox filters cards by Description text of cards.
    + Whitespace works as word separator. (AND condition)
  - `Open Folder` button : open current card folder by Windows Explorer. (Windows Only)
    + If you use a1111/forge remotely via network, disable this functionality from Settings.

![ShowDirName](./docs/images/showDirName.png)

### Mini Gallery
  - At the right side of prompt textarea, you can always see a small gallery which shows the image generation result.
  - All of the values are syncronized with those of Generation tab.
  - If you don't need this gallery, uncheck `Settings` > `Show Mini Gallery` option.
  - By pushing roller icon, you can open mask map editor for ControlNet, and apply map to CNet.

![MiniGellery](./docs/images/mini%20gallery.png)


## Prompt Registration Modal Window
* Pressing the Card Edit button in the top right of the card opens a screen like this

![example](./docs/images/05_editor.png)

* Prompt
  - Enter any prompt you want to register for this card
  - Completion by [a1111-sd-webui-tagcomplete](https://github.com/DominikDoom/a1111-sd-webui-tagcomplete) works
  - If a txt file with the same name as the image exists (e.g. `foo.txt` for `foo.png`),
    the content in the txt file will be automatically loaded into the `Prompt` text area.

* Negative Prompt
  - Same as Prompt 

* Description
  - Use this textarea as your memo for card description

* Replace Mode
  - When checked, Prompt and Negative Prompt are inserted with decorative lines
    Also, if text of the same category is already exists in Prompt / Negative Prompt area, that location will be replaced.
  - When unchecked, decorative lines are not used and text is simply added to the bottom of the current Prompt and Negative Prompt

* CNet Enabled
  - Determines whether to display a button to set the card image to Control Net for this card
  - After changing, please reload the card list with the refresh button in the top right of the tab

* Apply Resolution to Generation Parameters
  - When checked, not only the prompt but also the resolution registered here will be set to the generation parameters resolution
  - When turned off, the values registered here are ignored and the resolution is not changed
  - Utility buttons for resolution registration
    + Lock button: Move the slider while maintaining the aspect ratio
    + 1/2 button: Sets to 1/2 of the current resolution
    + 8n button: Adjusts the current resolution values to the nearest multiple of 8
    + 64n button: Similar to 8n, adjusts to multiples of 64

* Set Data from Image Metadata buttons in the right column
  - Prompt: If the card image was AI-generated (precisely, if it contains Stable Diffusion metadata), copies the Prompt from the metadata to the Prompt area on the left
  - Negative Prompt: Same as Prompt
  - Resolution: Copies the resolution values of the card image to the resolution sliders on the left column with scaling its value to 1024 resolution size.

* You can also use the `Esc` key instead of the Cancel button to cancel this screen

## Settings
* In the WebUI's Settings under `Uncategorized` > `Prompt Cards Manager`, you can configure various default values when loading new images and settings for when setting images to ControlNet

# Known Issues
*  To enable handling a large number of images in the browser, this extension generates lightweight thumbnail images and caches
  them when loading new images.
   If you add or modify a large number of images all at once (e.g., several hundreds) and then press the update button,
  the processing time can be significant. This may trigger a timeout on the framework's side, potentially causing the PromptCards tab
  to remain stuck on a black screen. (This issue should stem from an outdated Gradio callback chain problem.)
   However, there is no issue with the server-side internal processing - it completes successfully regardless of the timeout.
  If this happens, simply reload the browser page, and the next time you push refresh button, everything shoud load correctly.

# Credits
This extension utilizes the folloing third-party resouces.

## Icons
* https://www.svgrepo.com/svg/485431/info-1, LICENSE: CC Attribution License, AUTHOR: Anastasia Savenko
* https://www.svgrepo.com/svg/335585/lock-unlocked, LICENSE: MIT License, AUTHOR: BrightspaceUI
* https://www.svgrepo.com/svg/335586/lock, LICENSE: MIT License, AUTHOR: BrightspaceUI
* https://www.svgrepo.com/svg/524192/upload-square, LICENSE: CC Attribution License, AUTHOR: Solar Icons
* https://www.svgrepo.com/svg/524193/upload-twice-square, LICENSE: CC Attribution License, AUTHOR: Solar Icons
* https://www.svgrepo.com/svg/371822/details, LICENSE: MIT License, AUTHOR: vmware
* https://www.svgrepo.com/svg/376060/file-tree, LICENSE: MIT License, AUTHOR: Gitlab
* https://www.svgrepo.com/svg/435987/window, LICENSE: MIT License, AUTHOR: Flux Icons
* https://www.svgrepo.com/svg/532815/folder-exclamation, LICENSE: CC Attribution License, AUTHOR: Dazzle UI
* https://www.svgrepo.com/svg/525443/minimize-square-minimalistic, LICENSE: CC Attribution License, AUTHOR: Solar Icons
* https://www.svgrepo.com/svg/343263/reset, LICENSE: PD License, AUTHOR: CoreyGinnivan
* https://www.svgrepo.com/svg/362678/eraser-bold, LICENSE: MIT License, AUTHOR: phosphor
* https://www.svgrepo.com/svg/258637/mirror-horizontally-graphic-design, LICENSE: CC0 License, UPLOADER: SVG Repo
* https://www.svgrepo.com/svg/129307/painting-roller, LICENSE: CC0 License, UPLOADER: SVG Repo
* https://www.svgrepo.com/svg/368760/id, LICENSE: MIT License, AUTHOR: teenyicons