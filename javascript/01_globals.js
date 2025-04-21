/** API エンドポイントのベース URL */
const PCM_API_ENDPOINT_BASE = '/sd-webui-prompt-cards-manager';

/** Extra Networks のタブ名 */
const PCM_EXTRA_NETWORKS_TABNAME = 'promptcards';

/** elem_id から Gradio のコンポーネントオブジェクトを取得
 *  複数ある場合は最初にヒットしたオブジェクト
 *  props.value に Gradio が管理する各コンポーネントの value が格納されている
 *  @param {string} elem_id コンポーネントの elem_id
 *  @return {object} ステータスオブジェクト
 */
const pcmGetGradioComponentByElemId = (elem_id) => {
    if(!window.gradio_config || !window.gradio_config.components){
        console.error("PCM error. window.gradio_config not found. This Gradio version is not supported.");
        return null;
    }
    return window.gradio_config.components.find(c => c.props && c.props.elem_id === elem_id);
}

/** opts.<キー名> の値を A1111 の共有オブジェクトから取得
 * opts は初期化されるまでのタイミングが遅い(OnUiLoadedから数秒後) ため、
 * 初期化直後にwaitして確実に取得する用途に使う
 * (なお、pcm に関する設定はこれではなく、python起動時に初期化される専用のAPIから pcmGetSettingsAsync を用いて取得可能)
 *  @param {string} key キー名
 *  @return {any} 値
 *  @param {number} timeout 最大待機時間 (デフォルト5000ms, 0: 無限待機)
 */
const pcmGetOptValueAsyncA1111 = async (key, timeout=5000) => {
    let time = 0;
    let ret = undefined;
    while(timeout===0 || time < timeout){
        ret = opts[key];
        if (ret !== undefined) break;
        await pcmSleepAsync(100);
        time += 100;
    }
    if (time >= timeout){
        console.error(`pcmGetOptValueAsync timeout: ${key}`);
        return null;
    }

    PCM_DEBUG_PRINT(`pcmGetOptValueAsync: ${key} ${ret}`);
    return ret;
}

/** Settings の全ての値を専用の API から取得
 *  @param {number} timeout 最大待機時間 (デフォルト5000ms, 0: 無限待機)
 */
const pcmGetSettingsAsync = async (timeout=5000) => {
    let data = undefined;
    let time = 0;
    while((timeout===0 || time<timeout) && !data){
        try{
            const res = await fetch(`${PCM_API_ENDPOINT_BASE}/settings`);
            if (!res.ok) throw new Error();
            data = await res.json();
        }catch (e){
            console.error(`pcmGetOptValueAsync error: ${e}`);
            await pcmSleepAsync(100);
            time += 100;
        }
    }
    if (time >= timeout){
        console.error(`Prompt Card Manager error. Failed to get settings from server.`);
        data = null;
    }
    return data;
}

/** Settings のキー名 */
const PCM_SETTINGS_KEYS = {
    "mini_gallery":{
        "show_image": "prompt_cards_manager_gallery_show_image",
        "show_resolution": "prompt_cards_manager_gallery_show_resolution",
        "show_seed": "prompt_cards_manager_gallery_show_seed",
        "show_cnet": "prompt_cards_manager_gallery_show_cnet",
    },

    "cards":{
        "ignore_dot_starts": "prompt_cards_manager_ignore_dot_starts",
        "default_is_replace": "prompt_cards_manager_default_is_replace",
        "default_apply_resolution": "prompt_cards_manager_default_apply_resolution",
        "default_resolution_width": "prompt_cards_manager_default_resolution_width",
        "default_resolution_height": "prompt_cards_manager_default_resolution_height",
        "default_cnet_enabled": "prompt_cards_manager_default_cnet_enabled",
    },

    "cnet":{
        "default_preprocessor": "prompt_cards_manager_default_controlnet_preprocessor",
        "default_models": "prompt_cards_manager_default_controlnet_models",
        "default_weight": "prompt_cards_manager_default_controlnet_weight",
        "default_starting_control_step": "prompt_cards_manager_default_controlnet_starting_control_step",
        "default_ending_control_step": "prompt_cards_manager_default_controlnet_ending_control_step",
        "default_control_mode": "prompt_cards_manager_default_controlnet_control_mode",
        "default_resize_mode": "prompt_cards_manager_default_controlnet_resize_mode",
    },

    "mask_editor":{
        "min_brush_size": "prompt_cards_manager_mask_editor_min_brush_size",
        "max_brush_size": "prompt_cards_manager_mask_editor_max_brush_size",
        "default_brush_size": "prompt_cards_manager_default_mask_editor_brush_size",
        "default_invert_mask": "prompt_cards_manager_default_mask_editor_invert_mask",
    },

    "control_belt":{
        "show_subdirs": "prompt_cards_manager_control_belt_show_subdirs",
        "show_dirname": "prompt_cards_manager_control_belt_show_dirname",
        "show_actions": "prompt_cards_manager_control_belt_show_actions",
        "show_desc": "prompt_cards_manager_control_belt_show_desc",
        "fit_image": "prompt_cards_manager_control_belt_fit_image",
    },

    "misc":{
        "decoration_line_length": "prompt_cards_manager_decoration_line_length",
        "fix_template_paste_behavior": "prompt_cards_manager_fix_template_paste_behavior",
        "cancel_editing_with_ctrl_q": "prompt_cards_manager_cancel_editing_with_ctrl_q",
        "save_editing_with_ctrl_s": "prompt_cards_manager_save_editing_with_ctrl_s",
        "open_folder_enabled": "prompt_cards_manager_open_folder_enabled",
    }
};


/** elem_id から Gradio のコンポーネントオブジェクトを取得
 *  全てのオブジェクトを配列で返す
 *  props.value に Gradio が管理する各コンポーネントの value が格納されている
 *  @param {string} elem_id コンポーネントの elem_id
 *  @return {object[]} ステータスオブジェクトの配列
 */
const pcmGetGradioComponentsAllByElemId = (elem_id) => {
    if(!window.gradio_config || !window.gradio_config.components){
        console.error("PCM error. window.gradio_config not found. This Gradio version is not supported.");
        return [];
    }
    return window.gradio_config.components.filter(c => c.props && c.props.elem_id === elem_id);
}


/** Selector に一致する要素の内、テキストに txt を含む(一致ではない)最初の要素を返す。無ければ null
 *  @param {string} selector セレクタ
 *  @param {string} txt テキスト
 *  @param {Element} base_elem 基準エレメント (デフォルトは gradioApp())
 *  @param {boolean} toLower テキストを小文字に変換して比較するかどうか (デフォルトは false)
 *  @return {Element} 対象エレメント。無ければ null
*/
const pcmGetElementBySelectorAndText = (selector, txt, base_elem = gradioApp(), toLower = false) => {
    const elems = base_elem.querySelectorAll(selector);
    let ret = null;
    if (toLower){
        ret = Array.from(elems).find(elem => elem.textContent.toLowerCase().includes(txt.toLowerCase()));
    }else{
        ret = Array.from(elems).find(elem => elem.textContent.includes(txt));
    }
    if (!ret){
        console.error(`pcmDropImageToCnet getElementBySelectorAndText not found : ${selector} ${txt}`);
        return null;
    }
    return ret;
}

/** 指定されたセレクタに一致する要素が存在するまで待機し、存在したらコールバックを実行  */
const pcmWaitForContent = (selector,cb)=>{
    const content = gradioApp().querySelector(selector);
    if (content){
        cb();
    } else {
        setTimeout(()=>pcmWaitForContent(selector,cb),100);
    }
}

/** 指定されたセレクタに一致する要素が存在するまで待機し、対象エレメントを返す。無ければnull
 *  @param {string} selector セレクタ
 *  @param {number} timeout 最大待機時間 (デフォルト5000ms, 0: 無限待機)
 *  @return {Element} 対象エレメント
*/
const pcmQuerySelectorAsync = async (selector, timeout=5000)=>{
    let content = gradioApp().querySelector(selector);
    let wait_ms = 0;
    while (!content && (timeout === 0 || wait_ms < timeout)){
        await pcmSleepAsync(100);
        wait_ms += 100;
        content = gradioApp().querySelector(selector);
    }
    if (!content) PCM_DEBUG_PRINT(`pcmQuerySelectorAsync timeout: ${selector}`);
    return content;
}

/** 要素を取得、無ければエラーメッセージを吐いてnullを返す */
const pcmGetElement = (selector, base_elem = gradioApp(), suppressError = false) => {
    if(base_elem === null) base_elem = gradioApp();
    const element = base_elem.querySelector(selector);
    if (!element) {
        if (!suppressError){
            console.error(`pcmDropImageToCnet element not found : ${selector}`);
        }
        return null;
    }
    return element;
}

/** 指定されたミリ秒数だけ待機する */
const pcmSleepAsync = async (ms) => new Promise(resolve => setTimeout(resolve, ms));


/** Data URI から DataTransfer オブジェクトを作成する */
const pcmCreateDataTransferAsync = async (dataUri) => {
    const mimeType = dataUri.split(';')[0].split(':')[1];
    const base64Data = dataUri.split(',')[1];
    const binaryData = atob(base64Data);
    const arrayBuffer = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) {
        arrayBuffer[i] = binaryData.charCodeAt(i);
    }
    // blob から File を作成して DataTransfer にセット
    const blob = new Blob([arrayBuffer], { type: mimeType });
    const file = new File([blob], "image.png", { type: mimeType });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    dataTransfer.effectAllowed = "all";
    return dataTransfer;
}


/** デバッグフラグ */
if(typeof PCM_DEBUG_MODE === "undefined"){
    window.PCM_DEBUG_MODE = false;
}

/** デバッグプリント */
if(PCM_DEBUG_MODE){
    window.PCM_DEBUG_PRINT = console.log;
    window.PCM_DEBUG_TRACE = console.trace;
}else{
    window.PCM_DEBUG_PRINT = () => {};
    window.PCM_DEBUG_TRACE = () => {};
}