from typing import Any
from modules import script_callbacks
from modules import shared

# Fix sd-dynamic-prompts's Template paste behavior.
# 'Template:' is now already handled in the process of modules.infotext_utils.parse_generation_parameters()
# and parsed into dict key 'Template'. So the original callback which treat as plane text 'Tempalte:'
# doesn't work anymore.
def on_infotext_pasted(infotext: str, parameters: dict[str, Any]) -> None:
    if shared.opts.prompt_cards_manager_fix_template_paste_behavior:
        new_parameters = {}
        if ("Template" in parameters and "Prompt" in parameters):
            parameters["Prompt"] = parameters["Template"]
        if ("Negative Template" in parameters and "Negative prompt" in parameters):
            parameters["Negative prompt"] = parameters["Negative Template"]
        parameters.update(new_parameters)
    else:
        return


script_callbacks.on_infotext_pasted(on_infotext_pasted)