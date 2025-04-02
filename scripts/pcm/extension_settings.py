import gradio as gr
from modules import script_callbacks, shared
import sys
from scripts.pcm.constants import DEBUG_PRINT

def on_ui_settings():
    section = ("prompt_cards_manager", "Prompt Cards Manager")

    # show mini gallery (needs reload ui)
    shared.opts.add_option("prompt_cards_manager_gallery_show_image", shared.OptionInfo(
        True, "Mini Gallery : Show Image Gallery",
        section=section
    ))

    # show mini gallery resolution
    shared.opts.add_option("prompt_cards_manager_gallery_show_resolution", shared.OptionInfo(
        True, "Mini Gallery : Show Resolution",
        section=section
    ))

    # show mini gallery seed
    shared.opts.add_option("prompt_cards_manager_gallery_show_seed", shared.OptionInfo(
        True, "Mini Gallery : Show Seed",
        section=section
    ))

    # show mini gallery cnet values
    shared.opts.add_option("prompt_cards_manager_gallery_show_cnet_values", shared.OptionInfo(
        True, "Mini Gallery : Show ControlNet Parameters",
        section=section
    ))

    # ignore dot starts
    shared.opts.add_option("prompt_cards_manager_ignore_dot_starts", shared.OptionInfo(
        True, "Ignore dirs and files starting with . (such as .git, .DS_Store)",
        section=section
    ))

    # default value : is_replace
    shared.opts.add_option("prompt_cards_manager_default_is_replace", shared.OptionInfo(
        True, "[Editor Default Value] Replace Mode ",
        section=section
    ))

    # default value : apply_resolution
    shared.opts.add_option("prompt_cards_manager_default_apply_resolution", shared.OptionInfo(
        True, "[Editor Default Value] Apply Resolution",
        section=section
    ))

    # default value : resolution width
    shared.opts.add_option("prompt_cards_manager_default_resolution_width", shared.OptionInfo(
        1024, "[Editor Default Value] Resolution Width",
        gr.Slider, {"minimum": 64, "maximum": 3072, "step": 8}, 
        section=section
    ))

    # default value : resolution height
    shared.opts.add_option("prompt_cards_manager_default_resolution_height", shared.OptionInfo(
        1024, "[Editor Default Value] Resolution Height",
        gr.Slider, {"minimum": 64, "maximum": 3072, "step": 8}, 
        section=section
    ))

    # default value : cnet_enabled
    shared.opts.add_option("prompt_cards_manager_default_cnet_enabled", shared.OptionInfo(
        True, "[Editor Default Value] CNet Enabled",
        section=section
    ))

    # controlnet preprocessor
    preprocessors = ["None"]
    def update_controlnet_preprocessor(preprocessors):
        def update_controlnet_preprocessor():
            if "lib_controlnet.global_state" in sys.modules:
                cn_module = sys.modules["lib_controlnet.global_state"]
                if hasattr(cn_module, "get_all_preprocessor_names") and callable(cn_module.get_all_preprocessor_names):
                    tmp = cn_module.get_all_preprocessor_names()
                    DEBUG_PRINT(tmp)
                    preprocessors.clear()
                    preprocessors.extend(tmp)   
                else:
                    DEBUG_PRINT("Prompt Cards Manager : get_all_preprocessor_names not found. This ControlNet extension vesion is not supported.")
            else:
                DEBUG_PRINT("Prompt Cards Manager : lib_controlnet.global_state not found. Maybe ControlNet extension is not installed.")
        return update_controlnet_preprocessor
    update_controlnet_preprocessor(preprocessors)()
    shared.opts.add_option("prompt_cards_manager_default_controlnet_preprocessor", shared.OptionInfo(
        "None", "ControlNet : Preprocessor",
        gr.Dropdown, lambda: {"choices": preprocessors},
        refresh=update_controlnet_preprocessor(preprocessors),
        section=section
    ))

    # controlnet models
    models = ["None"]
    def update_controlnet_models(models):
        def update_controlnet_models():
            if "lib_controlnet.global_state" in sys.modules:
                cn_module = sys.modules["lib_controlnet.global_state"]
                if hasattr(cn_module, "update_controlnet_filenames") and callable(cn_module.update_controlnet_filenames):
                    cn_module.update_controlnet_filenames()
                    tmp = cn_module.get_all_controlnet_names()
                    DEBUG_PRINT(tmp)
                    models.clear()
                    models.extend(tmp)
                else:
                    DEBUG_PRINT("Prompt Cards Manager : update_controlnet_filenames not found. This ControlNet extension vesion is not supported.")
            else:
                DEBUG_PRINT("Prompt Cards Manager : lib_controlnet.global_state not found. Maybe ControlNet extension is not installed.")
        return update_controlnet_models
    update_controlnet_models(models)()
    shared.opts.add_option("prompt_cards_manager_default_controlnet_models", shared.OptionInfo(
        "None", "ControlNet : Models",
        gr.Dropdown, lambda: {"choices": models},
        refresh=update_controlnet_models(models),
        section=section
    ))

    # controlnet weight
    shared.opts.add_option("prompt_cards_manager_default_controlnet_weight", shared.OptionInfo(
        1.0, "ControlNet : Weight",
        gr.Slider, {"minimum": 0.0, "maximum": 2.0, "step": 0.01}, 
        section=section
    ))

    # controlnet starting control step
    shared.opts.add_option("prompt_cards_manager_default_controlnet_starting_control_step", shared.OptionInfo(
        0, "ControlNet : Starting Control Step",
        gr.Slider, {"minimum": 0, "maximum": 1.0, "step": 0.01}, 
        section=section
    ))

    # controlnet ending control step
    shared.opts.add_option("prompt_cards_manager_default_controlnet_ending_control_step", shared.OptionInfo(
        1.0, "ControlNet : Ending Control Step",
        gr.Slider, {"minimum": 0, "maximum": 1.0, "step": 0.01}, 
        section=section
    ))

    # control mode
    shared.opts.add_option("prompt_cards_manager_default_controlnet_control_mode", shared.OptionInfo(
        "Balanced", "ControlNet : Control Mode",
        gr.Radio, {"choices": ["Balanced", "My Prompt is more important", "ControlNet is more important"]},
        section=section
    ))

    # resize mode
    shared.opts.add_option("prompt_cards_manager_default_controlnet_resize_mode", shared.OptionInfo(
        "Crop and Resize", "ControlNet : Resize Mode",
        gr.Radio, {"choices": ["Just Resize", "Crop and Resize", "Resize and Fill"]},
        section=section
    ))

    # hared.OptionInfo(100, "Time in ms to wait before triggering completion again")
    shared.opts.add_option("prompt_cards_manager_decoration_line_length", shared.OptionInfo(
        55, "Decoration Line Length (length or this: \"-------------------->\")",
        gr.Slider, {"minimum": 1, "maximum": 100, "step": 1},
        section=section
    ))

    # fix 'Template:' paste behavior of sd-dynamic-prompts.
    shared.opts.add_option("prompt_cards_manager_fix_template_paste_behavior", shared.OptionInfo(
        False,
        "Fix sd-dynamic-prompts 'Template:' pasting behavior. " + \
        "With this option enabled, when you using sd-dynamic-prompts' saving template option, " + \
        "'#' comment outed lines in 'Prompt' and 'Negative prompt' fields will be pasted in their fields correctly.",
        section=section
    ))

    # cancel editing with 'Ctrl + Q'
    shared.opts.add_option("prompt_cards_manager_cancel_editing_with_ctrl_q", shared.OptionInfo(
        False,
        "Card Editor shortcut key : 'Ctrl + Q' for canceling instead of 'Esc'.",
        section=section
    ))

    # save editting with 'Ctrl + S'
    shared.opts.add_option("prompt_cards_manager_save_editing_with_ctrl_s", shared.OptionInfo(
        True,
        "Card Editor shortcut key : 'Ctrl + S' for saving. To disable, uncheck this option.",
        section=section
    ))

    # open folder
    shared.opts.add_option("prompt_cards_manager_open_folder_enabled", shared.OptionInfo(
        True,
        "Enable the button for opening the folder in Explorer (Windows Only).\n"+\
        "!! IMPORTANT !! If you publicly open your a1111 server via the internet, never enable this option. This is for local only.",
        section=section
    ))


# コールバック登録
script_callbacks.on_ui_settings(on_ui_settings)