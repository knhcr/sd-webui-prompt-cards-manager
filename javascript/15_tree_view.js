/** ディレクトリツリービューのアイテムクリック */
function pcmExtraNetworksTreeOnClick(event, tabname, extra_networks_tabname) {
    /**
     * Handles `onclick` events for buttons within an `extra-network-tree .tree-list--tree`.
     *
     * Determines whether the clicked button in the tree is for a file entry or a directory
     * then calls the appropriate function.
     *
     * @param event                     The generated event.
     * @param tabname                   The name of the active tab in the sd webui. Ex: txt2img, img2img, etc.
     * @param extra_networks_tabname    The id of the active extraNetworks tab. Ex: lora, checkpoints, etc.
     */
    var btn = event.currentTarget;
    var par = btn.parentElement;
    PCM_DEBUG_PRINT(`pcmExtraNetworksTreeOnClick: CLICKED BUTTON`);
    if (par.dataset.treeEntryType === "file") {
        pcmExtraNetworksTreeProcessFileClick(event, btn, tabname, extra_networks_tabname);
    } else {
        pcmExtraNetworksTreeProcessDirectoryClick(event, btn, tabname, extra_networks_tabname);
    }
}

/** ディレクトリツリービューのファイルアイテムクリック */
function pcmExtraNetworksTreeProcessFileClick(event, btn, tabname, extra_networks_tabname) {
    /**
     * Processes `onclick` events when user clicks on files in tree.
     *
     * @param event                     The generated event.
     * @param btn                       The clicked `tree-list-item` button.
     * @param tabname                   The name of the active tab in the sd webui. Ex: txt2img, img2img, etc.
     * @param extra_networks_tabname    The id of the active extraNetworks tab. Ex: lora, checkpoints, etc.
     */
    // NOTE: Currently unused.
    PCM_DEBUG_PRINT(`pcmExtraNetworksTreeOnClick: FILE TYPE TREE BUTTON clicked`);
    return;
}

/** ディレクトリツリービューのディレクトリアイテムクリック */
function pcmExtraNetworksTreeProcessDirectoryClick(event, btn, tabname, extra_networks_tabname) {
    /**
     * Processes `onclick` events when user clicks on directories in tree.
     *
     * Here is how the tree reacts to clicks for various states:
     * unselected unopened directory: Diretory is selected and expanded.
     * unselected opened directory: Directory is selected.
     * selected opened directory: Directory is collapsed and deselected.
     * chevron is clicked: Directory is expanded or collapsed. Selected state unchanged.
     *
     * @param event                     The generated event.
     * @param btn                       The clicked `tree-list-item` button.
     * @param tabname                   The name of the active tab in the sd webui. Ex: txt2img, img2img, etc.
     * @param extra_networks_tabname    The id of the active extraNetworks tab. Ex: lora, checkpoints, etc.
     */
    var ul = btn.nextElementSibling;
    // This is the actual target that the user clicked on within the target button.
    // We use this to detect if the chevron was clicked.
    var true_targ = event.target;

    function _expand_or_collapse(_ul, _btn, _tabname) {
        // not used
    }

    function _remove_selected_from_all() {
        // Removes the `selected` attribute from all buttons.
        var sels = document.querySelectorAll("div.tree-list-content");
        [...sels].forEach(el => {
            delete el.dataset.selected;
        });
    }

    function _select_button(_btn) {
        // Removes `data-selected` attribute from all buttons then adds to passed button.
        _remove_selected_from_all();
        _btn.dataset.selected = "";
    }

    function _update_search(_tabname, _extra_networks_tabname, _search_text) {
        // _search_text は <div type="button" data-path="prompt_cards\subdir\subdir$"> の data-path の値
        //   - data-path は ui_extra_networks.py の create_tree_dir_item_html() で初期化される (dir_path の値がそのまま入る)
        //     + Case Sensitive, $ は含まない, パスの区切り文字は正規化されていない

        if(_search_text) {
            // パスの区切り文字を正規化
            _search_text = _search_text.replace(/\\/g, '/');
            
            // SubDirチェックボックスの状態を確認
            var subdirToggleBtn = gradioApp().querySelector(`#${_tabname}_pcm_subdirs_toggle`);
            if (subdirToggleBtn && !subdirToggleBtn.classList.contains('enabled') && !_search_text.endsWith('$')) {
                // SubDirにチェックが無い場合は$を付加
                _search_text += '$';
            }
        }
        PcmCardSearch.updateQuery(_tabname, "path", _search_text, true); // クエリを更新し、マッチ結果も更新
    }

    
    // シェブロン をクリック : expand / collapse のトグルのみ
    if (true_targ.matches(".tree-list-item-action--leading, .tree-list-item-action-chevron")) {
        if (ul.hasAttribute("hidden")){
            pcmExpandDirItem(tabname, btn.closest('li.tree-list-item'), true);
        } else {
            pcmCollapseDirItem(tabname, btn.closest('li.tree-list-item'));
        }
    } 
    // ボタン部分をクリック
    else {
        const li = btn.closest('li.tree-list-item');

        // 選択中 かつ 展開中 => 折り畳む (当該フォルダのみ)
        if ("selected" in btn.dataset && !(ul.hasAttribute("hidden"))) {
            pcmCollapseDirItem(tabname, li);
            //_select_button(btn, tabname, extra_networks_tabname);
            //_update_search(tabname, extra_networks_tabname, btn.dataset.path);
        } 

        // 非選択中 かつ 展開中 => 選択 (念のため再帰的展開も実施)
        else if (!("selected" in btn.dataset) && !(ul.hasAttribute("hidden"))) {
            pcmExpandDirItem(tabname, li, true);
            _select_button(btn, tabname, extra_networks_tabname);
            _update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }

        // 選択中 かつ 折り畳み中 => 展開 (念のため再帰的展開)
        else if ("selected" in btn.dataset && (ul.hasAttribute("hidden"))){
            pcmExpandDirItem(tabname, li, true);
            //_select_button(btn, tabname, extra_networks_tabname);
            //_update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }

        // 非選択中 かつ 折り畳み中 => 展開して選択 (念のため再帰的展開)
        else {
            pcmExpandDirItem(tabname, li, true);
            _select_button(btn, tabname, extra_networks_tabname);
            _update_search(tabname, extra_networks_tabname, btn.dataset.path);
        }
    }

    // 現在選択中のフォルダの更新
    let dirElem = null;
    if (event.target.tagName === 'SPAN') dirElem = event.target.parentElement.parentElement;
    else if (event.target.tagName === 'DIV') dirElem = event.target.parentElement;
    else return; // ここには来ない
    pcmUpdateSelectedFolderHistory(tabname, pcmDirTreeElementToSearchPath(dirElem));
}


/** ツリービューのディレクトリアイテムを展開する
 * @param {string} tabname "txt2img" or "img2img"
 * @param {any} target Elemnt or str (CSS Selector) of 'li.tree-list-item' element
 * @param {boolean} recursive ルートノードから再帰的に展開するか (デフォルトfalse)
 */
function pcmExpandDirItem(tabname, target, recursive=false){
    if(typeof target === 'string'){
        target = gradioApp().querySelector(target);
    }
    if(!target) return;
    
    if(target.classList.contains('pcm-tree-view-leaf-dir')){
        // 葉ノードの場合は何もしない
    } else{
        const elemUL = target.querySelector(':scope > ul');
        const elemDiv = target.querySelector(':scope > div.tree-list-content');
        if(!elemUL || !elemDiv) return;
        if(elemUL.hasAttribute("hidden")) elemUL.removeAttribute("hidden");
        elemDiv.dataset.expanded = "";
    }

    if(recursive){
        const container = gradioApp().querySelector(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_tree`);
        if(!container) return;

        const parent = target.parentElement.parentElement;
        if(!parent || parent.tagName !== 'LI' || !container.contains(parent)) return;

        pcmExpandDirItem(tabname, parent, recursive);
    }
}


/** ツリービューのディレクトリアイテムを折り畳む
 * @param {string} tabname "txt2img" or "img2img"
 * @param {any} target Elemnt or str (CSS Selector) of 'li.tree-list-item' element
 */
function pcmCollapseDirItem(tabname, target){
    if(typeof target === 'string'){
        target = gradioApp().querySelector(target);
    }
    if(!target) return;
    
    if(target.classList.contains('pcm-tree-view-leaf-dir')){
        // 葉ノードの場合は何もしない
    } else{
        const elemUL = target.querySelector(':scope > ul');
        const elemDiv = target.querySelector(':scope > div.tree-list-content');
        if(!elemUL || !elemDiv) return;
        if(!elemUL.hasAttribute("hidden")) elemUL.setAttribute("hidden", "");
        delete elemDiv.dataset.expanded;
    }
}

/** ツリービューのアイテムにタイトルをセット
 * @param {string} tabname "txt2img" or "img2img"
*/
pcmTreeViewItemsSetTitle = (tabname)=>{
    PCM_DEBUG_PRINT(`pcmTreeViewItemsSetTitle called : ${tabname}`);
    if(!["txt2img", "img2img"].includes(tabname)) return;

    const elems = gradioApp().querySelectorAll(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_tree .tree-list-content.tree-list-content-dir`);
    for (const elem of elems){
        let title = ""
        let path = elem.getAttribute('data-path');
        if(path){
            path = path.replaceAll('\\', '/');
            title = path.split('/').slice(-1)[0];
        }
        elem.setAttribute('title', title);
    }
}

/** ツリービューの葉ノードにマークとして pcm-tree-view-leaf-dir class をセットし、chevron のクラスを tree-list-leaf-chevron に変更
 * @param {string} tabname "txt2img" or "img2img"
*/
pcmTreeViewSetLeafDirMark = (tabname=null)=>{
    PCM_DEBUG_PRINT(`pcmTreeViewSetLeafDirMark called : ${tabname}`);
    if(!["txt2img", "img2img"].includes(tabname)) return;

    const elems = Array.from(gradioApp().querySelectorAll(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_tree li.tree-list-item[data-tree-entry-type="dir"]`));
    for (const elem of elems){
        // 直下の ul > li に data-tree-entry-type="dir" があるか
        const children = Array.from(elem.querySelectorAll(':scope > ul > li[data-tree-entry-type="dir"]'));
        let hasChildren = true;
        if(children.length === 0) hasChildren = false;
        elem.classList.toggle('pcm-tree-view-leaf-dir', !hasChildren);
        if(!hasChildren){
            const chevron = elem.querySelector('i.tree-list-item-action-chevron');
            if(chevron){
                chevron.classList.add('tree-list-leaf-chevron');
                chevron.classList.remove('tree-list-item-action-chevron');
            }
        }
    }
}


/** 選択したフォルダの履歴 (配列は t2i, i2i の順) */
let pcmSelectedFolderHistory = [[null], [null]]; // 選択した要素の履歴(新しい順), 各要素は searchPath (末尾に $ は付かない)
let pcmSelectedFolderHistoryIndex = [0, 0]; // Undo/Redo 用現在のインデックス
let pcmSelectedFolderHistoryIndexMax = 40; // 履歴の最大長
let pcmSelectedFolderHistoryIsEventUndoRedo = 0; // Undo :-1, Redo:1, 通常のclick イベント: 0

/** カテゴリごとの最後に選択したフォルダ */
const pcmSelectedFolderOfEachCategory = [{}, {}]; // {'category_name': 'folderPath'}


/** dir tree のフォルダクリック時の履歴更新処理 
 *  - 連続して同じフォルダをクリックした場合はスキップ
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {string} searchPath 最新の選択フォルダ のsearchPath (末尾の $ は本処理内で除去される)
*/
function pcmUpdateSelectedFolderHistory(tabname, searchPath){
    let tabIndex;
    if (tabname === "txt2img"){
        tabIndex = 0;
    }else if (tabname === "img2img"){
        tabIndex = 1;
    }else{
        return;
    }

    // カテゴリ毎の最終選択フォルダ
    if(searchPath){
        let parts = searchPath.split("/");
        if(parts.length>1){
            PCM_DEBUG_PRINT(`pcmUpdateSelectedFolderHistory tabname: ${tabname}, category: ${parts[1]}, searchPath: ${searchPath}`);
            pcmSelectedFolderOfEachCategory[tabIndex][parts[1]] = searchPath;
        }
    }

    // 選択履歴
    PCM_DEBUG_PRINT(`pcmUpdateSelectedFolderHistory tabIndex: ${tabIndex}, searchPath: ${searchPath}`);
    const historyArray = pcmSelectedFolderHistory[tabIndex];

    // Undo/Redo から来た場合, history index だけを更新して終了
    if(pcmSelectedFolderHistoryIsEventUndoRedo !== 0){
        let tmp = pcmSelectedFolderHistoryIndex[tabIndex] + pcmSelectedFolderHistoryIsEventUndoRedo;
        if(tmp < 0 || tmp >= historyArray.length){
            // ここには来ないが念のため
            PCM_DEBUG_PRINT(`pcmUpdateSelectedFolderHistory tabIndex: ${tabIndex}, illegal index`);
        }else{
            pcmSelectedFolderHistoryIndex[tabIndex] = tmp;
        }
        pcmSelectedFolderHistoryIsEventUndoRedo = 0;
        return;
    }

    // 通常のクリックイベントの場合,現在の history index が 0 になるように更新
    if(pcmSelectedFolderHistoryIndex[tabIndex] > 0){
        // 今の index よりも新しい履歴は削除
        historyArray.splice(0, pcmSelectedFolderHistoryIndex[tabIndex]);
        pcmSelectedFolderHistoryIndex[tabIndex] = 0; // 現在のインデックスを0に
    }
    // 今いるフォルダと違うフォルダのクリックだった場合は履歴に追加
    if(historyArray[0] !== searchPath){
        if (historyArray.length >= pcmSelectedFolderHistoryIndexMax){
            historyArray.pop();
        }
        if (searchPath.endsWith('$')) searchPath = searchPath.slice(0, -1);
        historyArray.unshift(searchPath);
    }
}

/** 数字指定で dir tree のフォルダの click event を発火
 *   - 上の並びから {number} 個目のカテゴリをクリック (0スタート)
 *   - 現在の選択場所が既に当該カテゴリ内の何れかだった場合はカテゴリ内の次/前のフォルダを選択(循環)
 * @param {number} number 数字
 * @param {number} tabname タブ名 (txt2img, img2img)
 * @param {boolean} reverse 前のフォルダを選択するか (デフォルトfalse)
*/
function pcmCardPageSwitchCategory(number, tabname, reverse=false){
    let categorieElems = gradioApp().querySelectorAll(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_tree > ul > li > ul > li[data-tree-entry-type="dir"]`);
    if (categorieElems.length <= number){
        return;
    }

    // タブ名から tabIndex を取得
    let tabIndex;
    if (tabname === "txt2img") tabIndex = 0;
    else if (tabname === "img2img") tabIndex = 1;
    else return;

    // 選択履歴と対象カテゴリの情報を取得
    const targetCategoryElem = categorieElems[number]; // 対象カテゴリのトップ
    const targetCategoryName = targetCategoryElem.querySelector(".tree-list-item-label").textContent.trim(); // 対象のカテゴリ名
    const targetChildren = Array.from(targetCategoryElem.querySelectorAll(`li[data-tree-entry-type="dir"]`)); // 対象カテゴリのサブフォルダ全て
    
    let targetCategoryLastPath; // 対象カテゴリの最後に選択したフォルダのパス
    if(targetCategoryName in pcmSelectedFolderOfEachCategory[tabIndex]){
        targetCategoryLastPath = pcmSelectedFolderOfEachCategory[tabIndex][targetCategoryName];
    }else{
        targetCategoryLastPath = null;
    }
    const currentPath = pcmSelectedFolderHistory[tabIndex][pcmSelectedFolderHistoryIndex[tabIndex]]; // 現在選択中のフォルダのパス
    let currentCategoryName = null; // 現在選択中のカテゴリ名
    if (currentPath){
        let parts = currentPath.split('/');
        if(parts.length > 1){
            currentCategoryName = parts[1];
        }
    }
    PCM_DEBUG_PRINT(`pcmCardPageSwitchCategory tabname: ${tabname}, targetCategoryName: ${targetCategoryName}, currentPath: ${currentPath}, currentCategoryName: ${currentCategoryName}`);

    // ターゲットを決定
    function _getTarget(targetCategoryElem, targetCategoryName, targetChildren, targetCategoryLastPath, currentPath, currentCategoryName, reverse){
        if (targetCategoryLastPath === null){
            return targetCategoryElem; // 初めて対象カテゴリをクリックした場合 -> 対象カテゴリのトップ
        }
        
        // 現在選択中のノードを取得
        let currentElem = pcmSearchPathToDirTreeElement(currentPath, tabname);
        if(!currentElem){
            return targetCategoryElem; // 現在選択中のノードが既に無くなっていた場合 -> 対象カテゴリのトップ
        }

        if (currentCategoryName !== targetCategoryName){
            // 対象カテゴリが現在選択中のカテゴリと異なる場合
            let target = pcmSearchPathToDirTreeElement(targetCategoryLastPath, tabname);
            if(target){
                return target; // 対象カテゴリの最後に選択したノードが存在している場合 -> そのノード
            }else{
                return targetCategoryElem; // 対象カテゴリの最後に選択したノードが既に無くなっていた場合 -> 対象カテゴリのトップ
            }
            
        } else{
            // 対象カテゴリが現在選択中のカテゴリと同じ場合
            let choices = [targetCategoryElem].concat(targetChildren); // 対象カテゴリのトップも含めた選択対象のリスト
            let tmpIndex = choices.indexOf(currentElem); // 現在のノードがどれであるか
            if(tmpIndex===-1){
                return targetCategoryElem; // 選択中のノードが既に無くなっていた場合 -> 対象カテゴリのトップ
            }else{
                if(reverse){
                    tmpIndex = (tmpIndex - 1 + choices.length) % choices.length;
                }else{
                    tmpIndex = (tmpIndex + 1) % choices.length;
                }
                return choices[tmpIndex];
            }
        }
    }

    let target = _getTarget(targetCategoryElem, targetCategoryName, targetChildren, targetCategoryLastPath, currentPath, currentCategoryName, reverse);
    if(!target){
        PCM_DEBUG_PRINT(`pcmCardPageSwitchCategory target not found error. tabname: ${tabname}, targetCategoryName: ${targetCategoryName}, currentPath: ${currentPath}, currentCategoryName: ${currentCategoryName}`);
        return; // ここには来ないはず
    }

    // 対象をクリック
    target.querySelector(`:scope > .tree-list-content`).click();

    // 対象カテゴリ以外のカテゴリのノードを折り畳む
    for (const elem of categorieElems){
        if(elem !== targetCategoryElem){
            pcmCollapseDirItem(tabname, elem);
        }
    }
}

/** Ctrl + 0, Alt + 0 で Undo/Redo 用 click コールバック
 *   - クリック履歴の更新は custom_tree_button.js のディレクトリ click event で発生するため不要
 * @param {string} tabname タブ名 (txt2img, img2img)
 * @param {number} isUndoRedo 1: Undo, -1: Redo
*/
function pcmCardPageDoUndoRedo(tabname, isUndoRedo){
    let tabIndex;
    if (tabname === "txt2img") tabIndex = 0;
    else if (tabname === "img2img") tabIndex = 1;
    else return;

    let nextIndex = pcmSelectedFolderHistoryIndex[tabIndex] + isUndoRedo;
    if(nextIndex < 0 || nextIndex >= pcmSelectedFolderHistory[tabIndex].length ){
        pcmSelectedFolderHistoryIsEventUndoRedo = 0; // 念のため
        return;
    }
    pcmSelectedFolderHistoryIsEventUndoRedo = isUndoRedo;
    const searchText = pcmSelectedFolderHistory[tabIndex][nextIndex];
    const elem = pcmSearchPathToDirTreeElement(searchText, tabname);
    if(!elem){
        // DOM 上に既に存在しない場合 ( refresh がちゃんと呼べていればここには来ない筈)
        PCM_DEBUG_PRINT(`pcmCardPageDoUndoRedo tabname: ${tabname}, searchText: ${searchText} not found in DOM`);
        pcmSelectedFolderHistoryIndex[tabIndex] = nextIndex;
        return;
    }
    elem.querySelector(`:scope> .tree-list-content`).click();
}


/** Ctrl + 数字キー, Alt + 0 コールバック登録
 *   - 数字キーは 1-9 まで -> -1 して 0-8 にマッピング
*/
window.addEventListener('keydown', (event)=>{
    // 現在のタブ名を取得
    function _getTabname(){
        let elem = null;
        elem = gradioApp().querySelector('#tab_txt2img');
        if(elem && elem.style.display === 'block'){
            return "txt2img";
        }
        elem = gradioApp().querySelector('#tab_img2img');
        if(elem && elem.style.display === 'block'){
            return "img2img";
        }
        return null;
    }

    if(event.shiftKey && event.ctrlKey && /^Digit\d$/.test(event.code)){
        // shift + ctrl + 数字キー -> カテゴリクリック (逆順), 0 の場合は Redo
        //  - shift + 数字キーは event.key が !, " などの記号になるため event.code を使用
        event.preventDefault();

        let tabname = _getTabname();
        if(!tabname) return;

        PCM_DEBUG_PRINT(`pcm shortcut key tabname: ${tabname}, C-S-${event.code}`);

        if(event.code === 'Digit0'){
            pcmCardPageDoUndoRedo(tabname, -1); // Redo
        }else{
            pcmCardPageSwitchCategory(parseInt(event.code.slice(-1),10)-1, tabname, true); // カテゴリクリック (逆順)
        }

    } else if(event.ctrlKey && /^\d$/.test(event.key)){
        // ctrl + 数字キー -> カテゴリクリック, 0 の場合は Undo
        event.preventDefault();

        let tabname = _getTabname();
        if(!tabname) return;

        PCM_DEBUG_PRINT(`pcm shortcut key tabname: ${tabname}, C-${event.key}`);

        if(event.key === '0'){
            pcmCardPageDoUndoRedo(tabname, 1); // Undo
        }else{
            pcmCardPageSwitchCategory(parseInt(event.key,10)-1, tabname, false); // カテゴリクリック
        }

    } else if(event.altKey && event.key === '0'){
        // alt + 0 -> Redo
        event.preventDefault();

        let tabname = _getTabname();
        if(!tabname) return;
        pcmCardPageDoUndoRedo(tabname, -1); // Redo
    }
}, true);


/** dir tree util: search path -> フォルダ要素 (<li>), 無ければ null
 *   - Clickable 要素は <li> 直下の ':scope > .tree-list-content'
*/
function pcmSearchPathToDirTreeElement(path, tabname){
    // 各 <li> がノード, 属性 data-tree-entry-type="dir" がディレクトリタイプ
    //   - 直下の '> .tree-list-content' が clickable 要素 
    //   - 二つ下の '> span.tree-list-item-label' の textContent がノードの表示名 (trim() 必須)
    PCM_DEBUG_PRINT(`pcmSearchPathToDirTreeElement path: ${path}`);
    if (path === null) return null;
    const dirs = path.split('/');

    let layer0 = gradioApp().querySelector(`#${tabname}_${PCM_EXTRA_NETWORKS_TABNAME}_tree > ul > li`);
    if(!layer0) return null;

    let tmpLayer = layer0;
    let isFound = false;
    for (const dir of dirs.slice(1)){ // root dir はスキップして子孫からチェック
        isFound = false;
        const nextLayers = tmpLayer.querySelectorAll(`:scope > ul > li[data-tree-entry-type="dir"]`);
        for (const nextLayer of nextLayers){
            if(nextLayer.querySelector(`:scope > .tree-list-content > span.tree-list-item-label`).textContent.trim() === dir){
                tmpLayer = nextLayer;
                isFound = true;
                tmpLayer = nextLayer;
                break;
            }
        }
        if(!isFound) return null;
    }
    return tmpLayer;
}

/** dir tree util: フォルダ要素 (<li>) -> search path
 *   - Clickable 要素は <li> 直下の ':scope > .tree-list-content'
 *     + event から呼ぶときは event.target.parentElement を引数にすること
*/
function pcmDirTreeElementToSearchPath(elem){
    try{
        let tmpLayer = elem; // <li>
        PCM_DEBUG_PRINT(`pcmDirTreeElementToSearchPath tmpLayer.tagName: ${tmpLayer.tagName}`);
        let ret = tmpLayer.querySelector(`:scope > .tree-list-content > span.tree-list-item-label`).textContent.trim();
    
        while(tmpLayer){
            tmpLayer = tmpLayer.parentElement.parentElement; // <li>
            if(tmpLayer.tagName !== 'LI') break;
            ret = tmpLayer.querySelector(`:scope > .tree-list-content > span.tree-list-item-label`).textContent.trim() + '/' + ret;
        }
        return ret;
    }catch(error){
        PCM_DEBUG_PRINT(`pcmDirTreeElementToSearchPath error`, error);
        PCM_DEBUG_PRINT(error.stack);
        return "";
    }
}