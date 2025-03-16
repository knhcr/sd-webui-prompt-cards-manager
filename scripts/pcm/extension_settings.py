import gradio as gr
from modules import script_callbacks, shared
import sys
from scripts.pcm.constants import DEBUG_PRINT

def on_ui_settings():
    section = ("prompt_cards_manager", "Prompt Cards Manager")

    # ignore dot starts
    shared.opts.add_option("prompt_cards_manager_ignore_dot_starts", shared.OptionInfo(
        True, "Ignore dirs and files starting with '.' (like '.DS_Store', '.git', etc.)",
        section=section
    ))

    # default value : is_replace
    shared.opts.add_option("prompt_cards_manager_default_is_replace", shared.OptionInfo(
        True, "Replace Mode (Default value)",
        section=section
    ))

    # default value : apply_resolution
    shared.opts.add_option("prompt_cards_manager_default_apply_resolution", shared.OptionInfo(
        True, "Apply Resolution (Default value)",
        section=section
    ))

    # default value : resolution width
    shared.opts.add_option("prompt_cards_manager_default_resolution_width", shared.OptionInfo(
        1024, "Resolution Width (Default value)",
        gr.Slider, {"minimum": 64, "maximum": 3072, "step": 8}, 
        section=section
    ))

    # default value : resolution height
    shared.opts.add_option("prompt_cards_manager_default_resolution_height", shared.OptionInfo(
        1024, "Resolution Height (Default value)",
        gr.Slider, {"minimum": 64, "maximum": 3072, "step": 8}, 
        section=section
    ))

    # default value : cnet_enabled
    shared.opts.add_option("prompt_cards_manager_default_cnet_enabled", shared.OptionInfo(
        True, "CNet Enabled (Default value)",
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


# コールバック登録
script_callbacks.on_ui_settings(on_ui_settings)