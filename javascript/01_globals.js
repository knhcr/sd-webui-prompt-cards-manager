/** API エンドポイントのベース URL */
const PCM_API_ENDPOINT_BASE = '/sd-webui-prompt-cards-manager';


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


/** Selector に一致する要素の内、テキストに txt を含む(一致ではない)最初の要素を返す。無ければ null */
const pcmGetElementBySelectorAndText = (selector, txt, base_elem = gradioApp()) => {
    const elems = base_elem.querySelectorAll(selector);
    const ret = Array.from(elems).find(elem => elem.textContent.includes(txt));
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


/** デバッグフラグ */
if(typeof PCM_DEBUG_MODE === "undefined"){
    window.PCM_DEBUG_MODE = false;
}

/** デバッグプリント */
if(PCM_DEBUG_MODE){
    window.PCM_DEBUG_PRINT = console.log;
}else{
    window.PCM_DEBUG_PRINT = () => {};
}