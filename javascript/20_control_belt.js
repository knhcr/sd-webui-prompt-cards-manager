/** search textbox : prompt */
const pcmAddSearchTextboxPrompt = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_search_textbox_prompt called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        let elem = document.createElement('div');
        elem.classList.add('extra-network-control--search');
        let elem2 = document.createElement('input');
        elem2.id = `${tabname}_promptcards_extra_search_prompt`;
        elem2.classList.add('extra-network-control--search-text');
        elem2.type = 'search';
        elem2.placeholder = 'Search from Prompt';
        elem2.title = 'Search from card prompt.\n' +
                    'White spaces and commas are both treated as word separators.';
        elem2.addEventListener('input', ()=>{
            pcmPromptSearchCallback(tabname);
        });
        elem.appendChild(elem2);
        controlsDiv.prepend(elem);
    }

    // register to tag autocomplete
    if (typeof getTextAreas === 'function') {
      if (!thirdParty["prompt-card-manager"]) {
        thirdParty["prompt-card-manager"] = {
          "base": "#txt2img_promptcards_controls",
          "hasIds": true,
          "selectors": ["#txt2img_promptcards_extra_search_prompt"]
        };
      }
    }    

}
/** Prompt Search Callback */
function pcmPromptSearchCallback(tabname){
    const elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_search_prompt`);
    if(!elem) return;
    let query = elem.value;
    if (query === null || query === undefined) query = "";
    PcmCardSearch.updateQuery(tabname, "prompt", query, true);
}

/* --------------------------------------------------------------------------------------*/
/** search textbox : Description */
const pcmAddSearchTextboxDesc = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_search_textbox_desc called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        let elem = document.createElement('div');
        elem.classList.add('extra-network-control--search');
        let elem2 = document.createElement('input');
        elem2.id = `${tabname}_promptcards_extra_search_desc`;
        elem2.classList.add('extra-network-control--search-text');
        elem2.type = 'search';
        elem2.placeholder = 'Search from Path & Prompt & Desc';
        elem2.title = 'Search from path and prompt and description.\n' +
                    'If one of them matches, the card will be shown.\n' + 
                    'Only white spaces are treated as word separators.';
        elem2.addEventListener('input', ()=>{
            pcmDescSearchCallback(tabname);
        });
        elem.appendChild(elem2);
        controlsDiv.prepend(elem);
    }
}
/** Desc Search Callback */
function pcmDescSearchCallback(tabname){
    const elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_search_desc`);
    if(!elem) return;
    let query = elem.value;
    if (query === null || query === undefined) query = "";
    PcmCardSearch.updateQuery(tabname, "desc", query, true);
}

/* --------------------------------------------------------------------------------------*/
/** subdir toggle button */
const pcmAddSubdirToggleBtn = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_subdir_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        
        // サブフォルダ表示切替ボタン
        const btn = document.createElement('div');
        btn.id = `${tabname}_pcm_subdirs_toggle`;
        btn.classList.add('pcm-control-belt-btn');
        btn.classList.add('enabled');
        btn.innerHTML = `<img class="off" src="${PCM_API_ENDPOINT_BASE}/resources/file-tree-svgrepo-com.svg" alt="Show Desc Off">` + 
                        `<img class="on" src="${PCM_API_ENDPOINT_BASE}/resources/file-tree-blue-svgrepo-com.svg" alt="Show Desc On">`;
        btn.title = 'Show Subdir';
        btn.addEventListener('click', function() {
            pcmSubdirToggle(tabname);
        });
        controlsDiv.prepend(btn);
    }
}
/** subdir toggle callback */
function pcmSubdirToggle(tabname, asis=false) {
    const btn = gradioApp().querySelector(`#${tabname}_pcm_subdirs_toggle`);
    const PCM_SEARCH_ROOT = 'prompt_cards';
    
    let search_text = PcmCardSearch.queries[tabname].path;
    if(btn){
        if(!asis) btn.classList.toggle('enabled', !btn.classList.contains('enabled'));
        if (btn.classList.contains('enabled')) {
            if (search_text.endsWith('$')) {
                search_text = search_text.slice(0, -1);
            }else{
                search_text += '$';
            }
        } else {
            if (!search_text.endsWith('$')) {
                if (!search_text) {
                    search_text = PCM_SEARCH_ROOT + '$'; // 空文字の場合(全マッチ状態) の場合に $ を付ける場合はルートノードを付加 
                } else {
                    search_text += '$';
                }
            }
        }
        PcmCardSearch.updateQuery(tabname, "path", search_text);
    }
}

/* --------------------------------------------------------------------------------------*/
/** dirname toggle button */
const pcmAddDirnameToggleBtn = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_dirname_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        // フォルダ名表示切替ボタン
        const btn = document.createElement('div');
        btn.id = `${tabname}_pcm_dirname_toggle`;
        btn.classList.add('pcm-control-belt-btn');
        //btn.classList.add('enabled');
        btn.innerHTML = `<img class="off" src="${PCM_API_ENDPOINT_BASE}/resources/folder-exclamation-svgrepo-com.svg" alt="Show Desc Off">` + 
                        `<img class="on" src="${PCM_API_ENDPOINT_BASE}/resources/folder-exclamation-blue-svgrepo-com.svg" alt="Show Desc On">`;
        btn.title = 'Show Dirname';
        btn.addEventListener('click', function() {
            pcmHideDirNameToggle(tabname);
        });
        controlsDiv.prepend(btn);
    }
}
/** dirname toggle callback, also called when refresh btn clicked with asis=true. */
function pcmHideDirNameToggle(tabname, asis=false) {
    const btn = gradioApp().querySelector(`#${tabname}_pcm_dirname_toggle`);
    const cardNames = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .pcm-card .name`));
    if (btn){
        if(!asis) btn.classList.toggle('enabled', !btn.classList.contains('enabled'));
        for (let cardName of cardNames){
            if (btn.classList.contains('enabled')){
                cardName.textContent = cardName.getAttribute('orgname');
            }else{
                cardName.textContent = cardName.getAttribute('basename');
            }
        }
    }
}

/* --------------------------------------------------------------------------------------*/
/** show description toggle button */
const pcmAddShowDescToggleBtn = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_show_desc_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        // show description toggle button
        const btn = document.createElement('div');
        btn.id = `${tabname}_pcm_desc_toggle`;
        btn.classList.add('pcm-control-belt-btn');
        //btn.classList.add('enabled');
        btn.innerHTML = `<img class="off" src="${PCM_API_ENDPOINT_BASE}/resources/details-svgrepo-com.svg" alt="Show Desc Off">` + 
                        `<img class="on" src="${PCM_API_ENDPOINT_BASE}/resources/details-blue-svgrepo-com.svg" alt="Show Desc On">`;
        btn.title = 'Show Description';
        btn.addEventListener('click', function() {
            pcmShowDescToggle(tabname);
        });
        controlsDiv.prepend(btn);
    }
}
/** show description toggle callback, also called when refresh btn clicked with asis=true. */
function pcmShowDescToggle(tabname, asis=false) {
    const btn = gradioApp().querySelector(`#${tabname}_pcm_desc_toggle`);
    const cardDescs = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .pcm-card .description`));
    if (btn){
        if(!asis) btn.classList.toggle('enabled', !btn.classList.contains('enabled'));
        for (let cardDesc of cardDescs){
            cardDesc.classList.toggle('hidden', !btn.classList.contains('enabled'));
        }
    }
}

/* --------------------------------------------------------------------------------------*/
/** image fit toggle button */
const pcmAddImageFitBtn = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_image_fit_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        // image fit toggle button
        const btn = document.createElement('div');
        btn.id = `${tabname}_pcm_image_fit_toggle`;
        btn.classList.add('pcm-control-belt-btn');
        btn.classList.add('enabled');
        btn.innerHTML = `<img class="off" src="${PCM_API_ENDPOINT_BASE}/resources/minimize-square-minimalistic-svgrepo-com.svg" alt="Image Fit Off">` + 
                        `<img class="on" src="${PCM_API_ENDPOINT_BASE}/resources/minimize-square-minimalistic-blue-svgrepo-com.svg" alt="Image Fit On">`;
        btn.title = 'Image Fit';
        btn.addEventListener('click', function() {
            pcmImageFitToggle(tabname);
        });
        controlsDiv.prepend(btn);
    }
}
/** image fit toggle callback, also called when refresh btn clicked with asis=true. */
function pcmImageFitToggle(tabname, asis=false){
    const btn = gradioApp().querySelector(`#${tabname}_pcm_image_fit_toggle`);
    const cardImgs = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .pcm-card > img`));
    if (btn){
        if(!asis) btn.classList.toggle('enabled', !btn.classList.contains('enabled'));
        for (let cardImg of cardImgs){
            cardImg.classList.toggle('fit-contain', btn.classList.contains('enabled'));
        }
    }
}

/* --------------------------------------------------------------------------------------*/
/** open folder button */
const pcmAddOpenFolderButton = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_open_folder_button called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        // Open Folder Button
        const openFolderButton = document.createElement('div');
        openFolderButton.id = `${tabname}_pcm_open_folder_btn`;
        openFolderButton.classList.add('pcm-control-belt-push-btn');
        openFolderButton.innerHTML = `
            <img class="normal" src="${PCM_API_ENDPOINT_BASE}/resources/window-svgrepo-com.svg" alt="Open Folder">
            <img class="hover" src="${PCM_API_ENDPOINT_BASE}/resources/window-blue-svgrepo-com.svg" alt="Open Folder hover">
        `;
        openFolderButton.title = 'Open Folder by Explorer (Windows Only)';
        openFolderButton.addEventListener('click', function() {
            pcmOpenFolder(tabname);
        });
        controlsDiv.prepend(openFolderButton); // 先頭に追加
    }
}
function pcmOpenFolder(tabname){
    PCM_DEBUG_PRINT(`pcmOpenFolder called : ${tabname}`);
    let path = "";
    let selected = gradioApp().querySelector(`#${tabname}_promptcards_tree .tree-list-content[data-selected]`);
    if (selected){
        selected = selected.parentElement;
        path = pcmDirTreeElementToSearchPath(selected);
        path = path.split('/').slice(1).join('/');
    }else{
        path = "";
    }

    const url = `${PCM_API_ENDPOINT_BASE}/open-folder?path=${path}`;
    fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
}


/* --------------------------------------------------------------------------------------*/
/** refresh dir button */
async function pcmAddRefreshDirButton(){
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        //PCM_DEBUG_PRINT(`pcm_add_refresh_dir_button called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        
        // Open Folder Button
        const refreshDirButton = document.createElement('div');
        refreshDirButton.id = `${tabname}_pcm_refresh_dir_btn`;
        refreshDirButton.classList.add('pcm-control-belt-push-btn');
        refreshDirButton.innerHTML = `
            <img class="normal" src="${PCM_API_ENDPOINT_BASE}/resources/refresh-dir.svg" alt="RefreshDir">
            <img class="hover" src="${PCM_API_ENDPOINT_BASE}/resources/refresh-dir-blue.svg" alt="RefreshDir hover">
        `;
        refreshDirButton.title = 'Refresh Only Current Directory';
        refreshDirButton.addEventListener('click', async function() {
            await pcmRefreshDir(tabname);
        });
        controlsDiv.prepend(refreshDirButton); // 先頭に追加
    }
}

/** 指定されたディレクトリを更新し、更新後のディレクトリ直下のDOMを取得
 * @param {string} tabname 
 * @param {boolean} is_recurse 現状再帰更新は未実装 [TODO]
*/
async function pcmRefreshDir(tabname, is_recurse=false){
    // 現在のディレクトリを取得
    const selector = `#${tabname}_promptcards_tree .tree-list-content-dir[data-selected]`;
    const selected = gradioApp().querySelector(selector);
    let path = "";
    if (selected){
        path = pcmDirTreeElementToSearchPath(selected.parentElement);
        path = path.split('/').slice(1).join('/'); // root ('prompt_cards') を除く
    }
    PCM_DEBUG_PRINT(`pcmRefreshDir called : ${tabname}, "${path}"`);

    // Directory 更新要求
    const url = `${PCM_API_ENDPOINT_BASE}/refresh-dir`;
    const data = {
        path: path,
        tabName: tabname,
        is_recurse: is_recurse
    };
    const response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
    const json = await response.json();
    // json
    //{
    //    "html": {
    //        "txt2img": html, // if "txt2img" is specified in tabName, else key not exists
    //        "img2img": html  // if "img2img" is specified in tabName, else key not exists
    //    },
    //    "cardData": card_info_for_search
    //}

    // path に対応するディレクトリの DOM の差し替え
    if (tabname in json["html"]){
        // 古いカードを取得
        const oldCards = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards .pcm-card`))
            .filter(x=>{
                const orgname = x.querySelector(".name").getAttribute("orgname");
                const cardPath = orgname.split("/").slice(0,-1).join("/");
                return cardPath === path;
            });

        PCM_DEBUG_PRINT(`pcmRefreshDir: ${tabname}, oldCards: ${oldCards.length}`);

        // 新しいカードを追加
        const innerHtml = json["html"][tabname];
        const fragment = document.createRange().createContextualFragment(innerHtml);
        if (oldCards.length > 0){
            // 一つ以上古いカードが存在する場合は最初のカードの場所
            oldCards[0].parentElement.insertBefore(fragment, oldCards[0]);
        }else{
            // 古いカードが存在しない場合 (全体にカード自体存在しない場合も含む) は最後に追加
            gradioApp().querySelector(`#${tabname}_promptcards_cards`).appendChild(fragment);
        }
        // 古いカードを削除
        for (const oldCard of oldCards){
            oldCard.remove();
        }
    }

    // cardData を更新
    PcmCardSearch.deleteCardData(path+"$", tabname);
    PcmCardSearch.updateCardData(json["cardData"], tabname);

    // マッチ結果と表示オプションを更新
    PcmCardSearch.updateMatch(tabname, true);
    pcmApplyShowOptions(tabname);
}


/* --------------------------------------------------------------------------------------*/
/** Card List Refresh Button Callback */
function pcmRefreshCardListButtonSetCallback(){
    for (const tabname of ['txt2img', 'img2img']){
        let elem = gradioApp().querySelector(`#${tabname}_promptcards_extra_refresh`);
        if(elem){
            elem.addEventListener('click', ()=>{
                PcmCardSearch.updateCards(tabname);
            });
        }
    }
}


/** 表示オプションの適用 : ShowDir, ShowDesc, ImageFit */
const pcmApplyShowOptions = (tabname)=>{
    pcmHideDirNameToggle(tabname, true);
    pcmShowDescToggle(tabname, true);
    pcmImageFitToggle(tabname, true);
}


/* --------------------------------------------------------------------------------------*/
// checkbox 追加 (onUiLoaded では早すぎるため要素を監視)
pcmWaitForContent('.extra-networks-controls-div #txt2img_promptcards_controls', ()=>{
    pcmAddRefreshDirButton();
    pcmAddOpenFolderButton();
    pcmAddSearchTextboxDesc();
    pcmAddSearchTextboxPrompt();
    pcmAddSubdirToggleBtn();
    pcmAddDirnameToggleBtn();
    pcmAddShowDescToggleBtn();
    pcmAddImageFitBtn();
    pcmRefreshCardListButtonSetCallback();
});
