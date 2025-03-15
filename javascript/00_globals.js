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

/** デバッグプリント */
const PCM_DEBUG_MODE = false;
const PCM_DEBUG_PRINT = PCM_DEBUG_MODE ? (...args) => {console.log(...args);} : () => {};