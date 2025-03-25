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

/** opts.<キー名> の値を取得 (OnUiLoaded のタイミングが早いため、設定値の初期化を待つ場合に用いる)
 *  @param {string} key キー名
 *  @return {any} 値
 *  @param {number} timeout 最大待機時間 (デフォルト2000ms, 0: 無限待機)
 */
const pcmGetOptValueAsync = async (key, timeout=2000) => {
    let time = 0;
    let ret = undefined;
    while(time < timeout){
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
 *  @param {number} timeout 最大待機時間 (デフォルト2000ms, 0: 無限待機)
 *  @return {Element} 対象エレメント
*/
const pcmQuerySelectorAsync = async (selector, timeout=2000)=>{
    let content = gradioApp().querySelector(selector);
    let wait_ms = 0;
    while (!content && (timeout === 0 || wait_ms < timeout)){
        await pcmSleepAsync(100);
        wait_ms += 100;
        content = gradioApp().querySelector(selector);
    }
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


/** デバッグプリント */
let PCM_DEBUG_MODE = false;
const PCM_DEBUG_PRINT = (...args) => {
    if(PCM_DEBUG_MODE){ console.log(...args); }
};
