from typing import Any
from modules import script_callbacks
from modules import shared
from scripts.pcm.category import CategoryAlias
import re

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
    

# Template 内のカテゴリにエイリアスを適用
def apply_alias_to_category(infotext: str, parameters: dict[str, Any]) -> None:
    new_parameters = {}
    if ("Template" in parameters and "Prompt" in parameters):
        parameters["Template"] = _replace_category(parameters["Template"])

    if ("Negative Template" in parameters and "Negative prompt" in parameters):
        parameters["Negative Template"] = _replace_category(parameters["Negative Template"])


def _replace_category(text):
    category_alias = CategoryAlias().get_aliases()
    for k,v in category_alias.items():
        p_s = rf'## -- \[{k}\] (-+)>##'
        v_s = rf'## -- \[{v}\] \1>##'
        text = re.sub(p_s, v_s, text, count=0, flags=0)
        p_e = rf'## <-+ \[{k}\] --'
        v_e = rf'## <\1 \[{k}\] --'
        text = re.sub(p_e, v_e, text, count=0, flags=0)
        

script_callbacks.on_infotext_pasted(apply_alias_to_category) # on_infotext_pasted より先に実行
script_callbacks.on_infotext_pasted(on_infotext_pasted)