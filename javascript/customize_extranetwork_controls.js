/** search textbox : prompt 
 * PcmCardSearch クラスを利用するため、custom_tree_button.js で event listner を追加
*/
const pcmAddSearchTextboxPrompt = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_search_textbox_prompt called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        let elem = document.createElement('div');
        elem.classList.add('extra-network-control--search');
        let elem2 = document.createElement('input');
        elem2.id = `${tabname}_promptcards_extra_search_prompt`;
        elem2.classList.add('extra-network-control--search-text');
        elem2.type = 'search';
        elem2.placeholder = 'Prompt Search';
        elem.appendChild(elem2);
        controlsDiv.insertBefore(elem, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    
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

/** search textbox : Description
 * PcmCardSearch クラスを利用するため、custom_tree_button.js で event listner を追加
*/
const pcmAddSearchTextboxDesc = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_search_textbox_desc called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);

        let elem = document.createElement('div');
        elem.classList.add('extra-network-control--search');
        let elem2 = document.createElement('input');
        elem2.id = `${tabname}_promptcards_extra_search_desc`;
        elem2.classList.add('extra-network-control--search-text');
        elem2.type = 'search';
        elem2.placeholder = 'Description Search';
        elem.appendChild(elem2);
        controlsDiv.insertBefore(elem, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    
    }
}

/** subdir toggle checkbox
 * PcmCardSearch クラスを利用するため、custom_tree_button.js で event listner を追加
*/
const pcmAddSubdirToggleCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_subdir_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        const label = document.createElement('label');
        label.textContent = 'SubDir:';
        label.classList.add('pcm-subdir-toggle-label');
        label.classList.add('pcm-checkbox-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // サブフォルダ表示切替チェックボックス
        const subdirCheckbox = document.createElement('input');
        subdirCheckbox.type = 'checkbox';
        subdirCheckbox.classList.add('pcm-checkbox');
        const checkboxId = `${tabname}_pcm_subdirs_toggle`;
        subdirCheckbox.id = checkboxId;
        label.htmlFor = checkboxId;
        subdirCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        subdirCheckbox.checked = true;
        controlsDiv.insertBefore(subdirCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

/* --------------------------------------------------------------------------------------*/

/** dirname toggle checkbox */
const pcmAddDirnameToggleCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_dirname_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        const label = document.createElement('label');
        label.textContent = 'ShowDir:';
        label.classList.add('pcm-dirname-toggle-label');
        label.classList.add('pcm-checkbox-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // フォルダ名表示切替チェックボックス
        const dirnameCheckbox = document.createElement('input');
        dirnameCheckbox.type = 'checkbox';
        const checkboxId = `${tabname}_pcm_dirname_toggle`;
        dirnameCheckbox.id = checkboxId;
        dirnameCheckbox.classList.add('pcm-checkbox');
        label.htmlFor = checkboxId;
        dirnameCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        dirnameCheckbox.checked = false;
        dirnameCheckbox.addEventListener('change', function() {
            _pcmRefreshHideDirName(tabname, 'promptcards');
        });
        controlsDiv.insertBefore(dirnameCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

/** dirname toggle callback, also called when refresh btn clicked */
function _pcmRefreshHideDirName(tabname, extra_networks_tabname) {
    const isShow = gradioApp().querySelector(`#${tabname}_pcm_dirname_toggle`).checked;
    const cardNames = gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .card .name`);
    for (let cardName of cardNames){
        if (isShow){
            cardName.textContent = cardName.getAttribute('orgname');
        }else{
            cardName.textContent = cardName.getAttribute('basename');
            
        }
    }
}

/* --------------------------------------------------------------------------------------*/

/** show description toggle checkbox */
const pcmAddShowDescToggleCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_show_desc_toggle_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        const label = document.createElement('label');
        label.textContent = 'ShowDesc:';
        label.classList.add('pcm-desc-toggle-label');
        label.classList.add('pcm-checkbox-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // フォルダ名表示切替チェックボックス
        const descCheckbox = document.createElement('input');
        descCheckbox.type = 'checkbox';
        const checkboxId = `${tabname}_pcm_desc_toggle`;
        descCheckbox.id = checkboxId;
        descCheckbox.classList.add('pcm-checkbox');
        label.htmlFor = checkboxId;
        descCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        descCheckbox.checked = true;
        descCheckbox.addEventListener('change', function() {
            _pcmRefreshShowDesc(tabname);
        });
        controlsDiv.insertBefore(descCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

/** show description toggle callback, also called when refresh btn clicked */
function _pcmRefreshShowDesc(tabname) {
    const isShow = gradioApp().querySelector(`#${tabname}_pcm_desc_toggle`).checked;
    const cardDescs = gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .card .description`);
    for (let cardDesc of cardDescs){
        cardDesc.classList.toggle('hidden', !isShow);
    }
}
/* --------------------------------------------------------------------------------------*/

/** image fit checkbox */
const pcmAddImageFitCheckbox = ()=>{
    for (let tabname of ['txt2img', 'img2img']){
        const selector = `.extra-networks-controls-div #${tabname}_promptcards_controls`;
        PCM_DEBUG_PRINT(`pcm_add_image_fit_checkbox called : ${selector}`);
        const controlsDiv = gradioApp().querySelector(selector);
        // ラベル
        const label = document.createElement('label');
        label.textContent = 'ImageFit:';
        label.classList.add('pcm-image-fit-label');
        label.classList.add('pcm-checkbox-label');
        controlsDiv.prepend(label); // 先頭に追加
        
        // フォルダ名表示切替チェックボックス
        const imageFitCheckbox = document.createElement('input');
        imageFitCheckbox.type = 'checkbox';
        const checkboxId = `${tabname}_pcm_image_fit_toggle`;
        imageFitCheckbox.id = checkboxId;
        imageFitCheckbox.classList.add('pcm-checkbox');
        label.htmlFor = checkboxId;
        imageFitCheckbox.classList.add('gr-checkbox', 'gr-text-input');
        imageFitCheckbox.checked = false;
        imageFitCheckbox.addEventListener('change', function() {
            const cards = Array.from(gradioApp().querySelectorAll(`#${tabname}_promptcards_cards > .card > img`));
            for (let card of cards){
                card.classList.toggle('fit-contain', imageFitCheckbox.checked);
            }
        });
        controlsDiv.insertBefore(imageFitCheckbox, controlsDiv.firstChild.nextSibling); // ラベルの後に追加
    }
}

/* --------------------------------------------------------------------------------------*/



// checkbox 追加 (onUiLoaded では早すぎるため要素を監視)
pcmWaitForContent('.extra-networks-controls-div #txt2img_promptcards_controls', ()=>{
    pcmAddSearchTextboxDesc();
    pcmAddSearchTextboxPrompt();
    pcmAddSubdirToggleCheckbox();
    pcmAddDirnameToggleCheckbox();
    pcmAddShowDescToggleCheckbox();
    pcmAddImageFitCheckbox();
});

// HideDirName : refresh btn の callback にも追加
pcmWaitForContent('.tab-nav #txt2img_promptcards_extra_refresh', ()=>{
    gradioApp().querySelector('#txt2img_promptcards_extra_refresh').addEventListener(
        'click', ()=>{_pcmRefreshHideDirName('txt2img', 'promptcards')});
});
pcmWaitForContent('.tab-nav #img2img_promptcards_extra_refresh', ()=>{
    gradioApp().querySelector('#img2img_promptcards_extra_refresh').addEventListener(
        'click', ()=>{_pcmRefreshHideDirName('img2img', 'promptcards')});
});
