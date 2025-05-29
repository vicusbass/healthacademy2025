var bixgrowUrl = 'https://api.bixgrow.com';

let bgRefHashCode = bgGetParameterByName('bg_ref');
if(bgRefHashCode){
  const payload = {
    shop: Shopify.shop,
    affiliate_id: bgRefHashCode,
    url: window.location.href,
    referral_site: document.referrer
  }
  bgUseFetch(`${bixgrowUrl}/api/v2/automatic-coupon-customer`,'GET', payload).then(responseData => {
  if(Object.keys(responseData).length > 0)
  {
    if(!responseData.is_dynamic_coupon){
      createCustomerDiscountPopup(responseData.settings,false,responseData?.discount_code);
      autoAppliedCoupon(responseData?.discount_code);
    }else if(bgRefHashCode != bgGetCookie('bixgrow_affiliate_referral') ){
      createCustomerDiscountPopup(responseData.settings,true,responseData?.discount_code);
    }
  }
})
}

let toolbarsRefHashCode = bgRefHashCode ? bgRefHashCode : bgGetCookie('bgaffilite_id');
if(toolbarsRefHashCode){
  getStoreToolBars(toolbarsRefHashCode);
}

function getStoreToolBars(refHashCode){
        const payload = {
          shop: Shopify.shop,
          affiliate_id: refHashCode,
          url: window.location.href
        }

        bgUseFetch(`${bixgrowUrl}/api/store-toolbar`,'GET', payload).then(obj => {
          if(Object.keys(obj).length>0)
          {
              var enableToolbar = obj.settings.enable_shopping_with_toolbar;
              var enableFloatWidget = obj.settings.enable_shopping_with_floating_widget;
              var shopping_with_toolbar =  obj.settings.shopping_with_toolbar;
              var shopping_with_floating_widget = obj.settings.shopping_with_floating_widget; 
              if(enableToolbar)
              {
                  let existingToolbarElement = document.getElementById('__bixgrow_topbar');

                  if (existingToolbarElement) {
                    existingToolbarElement.remove();
                  }

                  let head = document.head || document.getElementsByTagName('head')[0];
                  let style = document.createElement('style');
                  let topBar = document.createElement("div");
                  topBar.style.width = '100%';
                  topBar.style.zIndex = '2157484649';
                  topBar.style.position = 'relative';
                  topBar.id='__bixgrow_topbar';  
                  window.onscroll = function(){
                      if(document.body.scrollTop > 5 || document.documentElement.scrollTop > 5){
                          topBar.classList.add('bixgrow_fixed');
                      } 
                      else{
                          topBar.classList.remove('bixgrow_fixed');
                      }
                  }
                  document.body.insertBefore(topBar,document.body.firstChild);
                  let css = `
                  #__bixgrow_topbar {
                    text-align: ${shopping_with_toolbar.textAlign};
                    background-color: ${shopping_with_toolbar.bgColor};
                    color: ${shopping_with_toolbar.textColor};
                    width: 100%;
                  }
                  
                  #__bixgrow_topbar_style {
                    display: inline-block;
                    line-height: 40px;
                  }
                
                  .bixgrow_fixed {
                    position: ${shopping_with_toolbar.position} !important;
                    top: 0;
                    width: 100%;
                    z-index: 2157484649;
                  }
                
                  .bixgrow-toolbar-special-text {
                    color: ${shopping_with_toolbar.special_text};
                  }
                `;
                  style.type = 'text/css';
                  if (style.styleSheet){
                    // This is required for IE8 and below.
                  style.styleSheet.cssText = css;
                  } else {
                      style.appendChild(document.createTextNode(css));
                  }
                  head.appendChild(style);
                  let divContent = '<div id="__bixgrow_topbar_style">'+ shopping_with_toolbar.textContent +'</div>';
                  if(shopping_with_toolbar.textContent){
                    topBar.insertAdjacentHTML('beforeend',divContent); 
                  }else{
                    topBar.remove();
                  }       
              }
              if(enableFloatWidget)
              {
                  let existingFloatWidgetElement = document.getElementById('__bixgrow_float_widget');

                  if(existingFloatWidgetElement){
                    existingFloatWidgetElement.remove();
                  }

                  let head = document.head || document.getElementsByTagName('head')[0];
                  let style = document.createElement('style');
                  let widget = document.createElement("div");
                  widget.id='__bixgrow_float_widget';
                  widget.classList.add('bixgrow_div_main');
                  if(shopping_with_floating_widget.is_show_only_avatar == 0){
                      widget.classList.add('bixgrow_style_toogle_click');
                  }
                  document.body.appendChild(widget);
                  let css = 
                  '.bixgrow_div_main{'+'overflow: hidden;position: fixed;'+
                          'bottom: '+ shopping_with_floating_widget.spacingBottom+'px;'+'z-index: 21111;box-sizing: content-box;'+
                          shopping_with_floating_widget.position+': '+ shopping_with_floating_widget.spacingRight+'px;'+
                          'box-shadow: rgb(0 0 0 / 20%) 0px 4px 8px 0px;'+
                          'border-radius: 50%;'+
                          'background-color: '+ shopping_with_floating_widget.bgColor+';'+
                          'height:auto;'+
                          '-webkit-box-pack: end;'+
                          'justify-content: end;'+
                          '-webkit-box-align: center;'+
                          'align-items: center;'+
                          'min-height: 50px;'+
                          'display: flex;'+
                          'flex-direction: row;'+
                          'padding: 8.46667px;}'+
                    '#__bixgrow_text_floating_widget_style {'+
                              'margin-right: 16px; margin-left: 16px; white-space: pre-line;'+
                              'color:'+ shopping_with_floating_widget.textColor + ';'+                   
                          '}'+
                    '.bixgrow_style_toogle_click{border-radius:1.2rem '+ shopping_with_floating_widget.size+'px '+shopping_with_floating_widget.size+ 'px ' +'1.2rem;}'+
                    '.__bixgrow_img_floating_widget_style{border-radius: 50%;overflow: hidden;object-fit: cover;'+
                    'width:' +shopping_with_floating_widget.size+'px;'+
                    'height:' +shopping_with_floating_widget.size+'px;'+
                    'transition: all 0.3s ease 0s;pointer-events: auto;}'+
                    '.__bixgrow_img_floating_widget_style:hover{'+
                      'transform: scale(0.85);'+
                  '}'+     '.bixgrow-widget-special-text{ color:'+
                  shopping_with_floating_widget.special_text +
                        '}';
                  style.type = 'text/css';
                  if (style.styleSheet){
                    // This is required for IE8 and below.
                  style.styleSheet.cssText = css;
                  } else {
                      style.appendChild(document.createTextNode(css));
                  }
                  head.appendChild(style);
                  let divContent = `<div id="__bixgrow_text_floating_widget_style" ${shopping_with_floating_widget.is_show_only_avatar == 0?'style="display:block"': 'style="display:none"'} >`+ shopping_with_floating_widget.textContent +'</div>';
                  widget.insertAdjacentHTML('beforeend',divContent);
                  let img = document.createElement('IMG');
                  img.classList.add('__bixgrow_img_floating_widget_style');
                  img.src = obj.settings.avatar_link? obj.settings.avatar_link : shopping_with_floating_widget.placeholderIcon;
                  img.addEventListener('click', function(event){
                      let divContentTemp = document.getElementById("__bixgrow_text_floating_widget_style");
                      if(divContentTemp.style.display==='none')
                      {
                          divContentTemp.style.display='block';
                      }
                      else{
                      divContentTemp.style.display='none'; 
                      }
                      widget.classList.toggle("bixgrow_style_toogle_click");
                  });
                  widget.appendChild(img);
              }
          }
        })
}

function autoAppliedCoupon(discountCode){
    discountCode = encodeURIComponent(discountCode);
    try{
      const url = `https://${shopDomainToolbar}/discount/${discountCode}`;
      bgUseFetch(url,'GET');
    }catch(error){
      console.log(error);
    }
  }
  
  async function bgUseFetch(url, method = "GET",params = null,headers = { "Content-Type": "application/json"} ){
    try {
      const options = {
        method: method,
        headers: {
          ...headers
        }
      }
      if(params){
        if(method == 'GET'){
          const queryString = new URLSearchParams(params).toString();
          url += '?' + queryString;
        }else{
          options.body = JSON.stringify(params);
        }
      }
      const response = await fetch(url,options);
      if(!response.ok){
        throw new Error(response.statusText);
      }
      const responseData = await response.json().catch(() => null);
      if(responseData){
        return responseData;
      }
    } catch (error) {
       throw error;
    }
    
  }
  
  function createCustomerDiscountPopup(settingsData,isDynamicCoupon = false,discountCode){
    let styleData = settingsData.style;
    let textData = settingsData.text;
    let bgHead = document.head || document.getElementsByTagName('head')[0];
    let myBgModal = document.getElementById('bgModal');
    if(myBgModal){
      myBgModal.remove();
    }
   let referralDiv = document.createElement("div");
   referralDiv.id = "bgModal";
   referralDiv.classList.add('bgModal');
   document.body.appendChild(referralDiv);
   let bgStyle = document.createElement("style");
   let bgCss = `.bgModal{
    display:none;
    position:fixed;
    z-index:9999;
    left:0;
    top:0;
    width:100%;
    height:100%;
    overflow:scroll;
    background-color: rgb(0,0,0,0.25);
    -webkit-animation-name: bgAnimatefade;
    -webkit-animation-duration: 0.4s;
    animation-name: bgAnimatefade;
    animation-duration: 0.4s;
    justify-content:center;
    align-items:center;
   }
   .bgModal--open{
    display:flex;
   }
   .bgModal__content{
    width: 450px;
    background: ${ styleData.card_background || '#fff'};
    padding:24px;
    border-radius:16px;
    text-align:center;
    color:#1B283F;
    position: relative;
    box-shadow: 1px 0px 0px 0px rgba(0, 0, 0, 0.13), -1px 0px 0px 0px rgba(0, 0, 0, 0.13), 0px -1px 0px 0px rgba(0, 0, 0, 0.17), 0px 1px 0px 0px rgba(204, 204, 204, 0.50), 0px 8px 16px -4px rgba(26, 26, 26, 0.22);
    width: 600px;
    border-radius: 0px;
    padding: 30px 40px;
   }
   .bgBody{
    display:flex;
    gap: 20px;
    flex-direction: column;
    justify-content: center;
   }
   .bgDescription{
    display:flex;
    gap: 15px;
    flex-direction: column;
    justify-content: center;
    align-items: center;
   }
   .bgAvatar{
    width: 50px;
    height: 50px;
    border-radius: 50%;
    object-fit:cover;
   }
   .bgHeading{
    font-size:38px;
    font-weight:650;
    color: ${styleData.text_color || 'rgb(0, 0, 0)'};
    line-height: normal;
   }
   .bgContent{
    font-size:21px;
    font-weight:450;
    line-height: normal;
    color: ${styleData.text_color || 'rgb(0, 0, 0)'}
   }
   .bgDisplayNone{
     display:none !important;
   }
.bgInputWrapper {
  position: relative;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 12px;
  border: 1px dashed  ${styleData.discount_box_border || '#81868b'};
  min-width: 200px;
  background: ${styleData.discount_box_background || '#fff'}
}
   .bgInputWrapper .bgInput {
    text-align: center;
    font-weight: 550;
    line-height: normal;
    font-size: 18px;
    color: ${styleData.discount_code_color || '#000'}
}
   .bgInputWrapper .bgInputCopy {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
}
   .bgButtonWrapper{
    margin-top:16px;
   }
   .bgBtn{
    border: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    border-radius: 4px;
    padding: 13px 16px;
    background: #1B283F;
    cursor:pointer;
    display:flex;
    justify-content:center;
    align-items:center;
    width: 100%;
   }
   .bgBtn__content{
    color: ${styleData.button_text_color || '#fff'};
    font-weight:450;
    line-height:normal;
    white-space: nowrap;
    user-select: none;
    font-size:21px;
   }
   .bgBtn--primary{
    background: ${styleData.button_background || 'rgba(74, 74, 74, 1)' };
    
   }
   .bgClose{
    position:absolute;
    top: 10px;
    right: 12px;
    cursor: pointer;
    width: 28px;
    height: 28px;
   }
   .bgDisabled{
    pointer-events: none;
    opacity: 0.5;
   }
   .bixgrow-loading .bixgrow-spinner {
    display: inline-block; 
  }
  .bixgrow-loading .bgBtn__content {
    display:none;
  }
  @-webkit-keyframes bgAnimatefade {
    from {opacity:0} 
    to {opacity:1}
  }
  
  @keyframes bgAnimatefade {
    from {opacity:0}
    to {opacity:1}
  }

  @media (max-width: 600px) {
    .bgModal__content{
      width: 100%;
      border-radius: 0;
      padding:20px;
    }
    .bgHeading{
      font-size: 30px;
    }
    .bgContent{
      font-size: 18px;
    }
    .bgBtn__content{
      font-size: 18px;
    }
  }
  ${styleData.custom_css ? styleData.custom_css : ''}
   `;

   bgStyle.type = 'text/css';
 if (bgStyle.styleSheet){
   bgStyle.styleSheet.cssText = css;
 } else {
  bgStyle.appendChild(document.createTextNode(bgCss));
 }
 bgHead.appendChild(bgStyle);
 let bgModalContent = `
 <div class="bgModal__content">
<svg id="bgClose" class="bgClose" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
<path d="M13.9697 15.0303C14.2626 15.3232 14.7374 15.3232 15.0303 15.0303C15.3232 14.7374 15.3232 14.2626 15.0303 13.9697L11.0607 10L15.0303 6.03033C15.3232 5.73744 15.3232 5.26256 15.0303 4.96967C14.7374 4.67678 14.2626 4.67678 13.9697 4.96967L10 8.93934L6.03033 4.96967C5.73744 4.67678 5.26256 4.67678 4.96967 4.96967C4.67678 5.26256 4.67678 5.73744 4.96967 6.03033L8.93934 10L4.96967 13.9697C4.67678 14.2626 4.67678 14.7374 4.96967 15.0303C5.26256 15.3232 5.73744 15.3232 6.03033 15.0303L10 11.0607L13.9697 15.0303Z" fill="#4A4A4A"/>
</svg>
<div class="bgBody">
<div class="bgDescription">
${styleData.affiliate_avatar && styleData.show_affiliate_avatar == 1 ?`<img class="bgAvatar"  src="${styleData.affiliate_avatar}" alt="Avatar" />`:''} 
  <div class="bgHeading">${textData.headline}</div>
  <div id="bgShopNowContent" class="bgContent ${isDynamicCoupon?'bgDisplayNone':''}">${textData.shop_now_description}</div>
  <div id="bgRedeemContent" class="bgContent ${isDynamicCoupon?'':'bgDisplayNone'}"  >${textData.redeem_description}</div>
</div>
<div id="bgInputWrapper" class="bgInputWrapper ${isDynamicCoupon?'bgDisplayNone':''}">
<div id="bgInput" class="bgInput">${isDynamicCoupon?'':discountCode}</div>
<svg id="bgInputCopy" class="bgInputCopy" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<g clip-path="url(#clip0_4289_1305)">
<path d="M8.66671 13.3333C9.55044 13.3323 10.3977 12.9808 11.0226 12.3559C11.6475 11.731 11.999 10.8837 12 10V4.16201C12.0011 3.81158 11.9325 3.46444 11.7984 3.14069C11.6643 2.81694 11.4673 2.52304 11.2187 2.27601L9.72404 0.781345C9.47701 0.532794 9.18311 0.335747 8.85936 0.201625C8.53562 0.0675033 8.18847 -0.0010253 7.83804 1.15931e-05H4.66671C3.78298 0.00107016 2.93575 0.3526 2.31085 0.977492C1.68596 1.60238 1.33443 2.44961 1.33337 3.33334V10C1.33443 10.8837 1.68596 11.731 2.31085 12.3559C2.93575 12.9808 3.78298 13.3323 4.66671 13.3333H8.66671ZM2.66671 10V3.33334C2.66671 2.80291 2.87742 2.2942 3.25249 1.91913C3.62757 1.54406 4.13627 1.33334 4.66671 1.33334C4.66671 1.33334 7.94604 1.34268 8.00004 1.34934V2.66668C8.00004 3.0203 8.14052 3.35944 8.39057 3.60949C8.64061 3.85954 8.97975 4.00001 9.33337 4.00001H10.6507C10.6574 4.05401 10.6667 10 10.6667 10C10.6667 10.5304 10.456 11.0392 10.0809 11.4142C9.70585 11.7893 9.19714 12 8.66671 12H4.66671C4.13627 12 3.62757 11.7893 3.25249 11.4142C2.87742 11.0392 2.66671 10.5304 2.66671 10ZM14.6667 5.33334V12.6667C14.6656 13.5504 14.3141 14.3976 13.6892 15.0225C13.0643 15.6474 12.2171 15.999 11.3334 16H5.33337C5.15656 16 4.98699 15.9298 4.86197 15.8048C4.73695 15.6797 4.66671 15.5102 4.66671 15.3333C4.66671 15.1565 4.73695 14.987 4.86197 14.8619C4.98699 14.7369 5.15656 14.6667 5.33337 14.6667H11.3334C11.8638 14.6667 12.3725 14.456 12.7476 14.0809C13.1227 13.7058 13.3334 13.1971 13.3334 12.6667V5.33334C13.3334 5.15653 13.4036 4.98696 13.5286 4.86194C13.6537 4.73692 13.8232 4.66668 14 4.66668C14.1769 4.66668 14.3464 4.73692 14.4714 4.86194C14.5965 4.98696 14.6667 5.15653 14.6667 5.33334Z" fill="${styleData.discount_code_color || '#000'}"/>
</g>
<defs>
<clipPath id="clip0_4289_1305">
<rect width="16" height="16" fill="white"/>
</clipPath>
</defs>
</svg>
</div>
<div class="bgButtonWrapper ${isDynamicCoupon?'':'bgDisplayNone'}" id="bgBtnRedeemCoupon"><button type="button" class="bgBtn bgBtn--primary">
<span id="redeemContent" class="bgBtn__content" >
${textData.redeem_button || 'Redeem coupon'}
</span>
<span class="bixgrow-spinner"></span>
</button></div>
<div id="bgBtnShopNow"  class="${isDynamicCoupon?'bgDisplayNone':''}"><button type="button" class="bgBtn bgBtn--primary ">
<span class="bgBtn__content" >
${textData.shop_now_button || 'Shop now'}
</span>
</button></div>
  </div>
  </div>`;
referralDiv.insertAdjacentHTML('beforeend',bgModalContent);
let bgClose = document.getElementById('bgClose');
bgClose.addEventListener('click',function($event){
  referralDiv.classList.remove("bgModal--open");
})
let bgInputWrapper = document.getElementById('bgInputWrapper');
let inputContent = '';
let timeoutId;
let bgInput = document.getElementById('bgInput');
bgInputWrapper.addEventListener('click',function($event){
  if(!inputContent){
    inputContent = bgInput.textContent;
  }
  let tempInput = document.createElement('input');
tempInput.value = inputContent;
document.body.appendChild(tempInput);
tempInput.select();
document.execCommand('copy');
document.body.removeChild(tempInput);
if(timeoutId){
  clearTimeout(timeoutId);
}
  bgInput.textContent = textData.after_copy_text || 'Copied';
  timeoutId = setTimeout(() => {
    bgInput.textContent = inputContent;
    inputContent = '';
    timeoutId = null;
  }, 1500);
})
let shopNowBtn = document.getElementById('bgBtnShopNow');
shopNowBtn.addEventListener('click',function(){
  referralDiv.classList.remove("bgModal--open");
});
let redeemBtn = document.getElementById('bgBtnRedeemCoupon');
redeemBtn.addEventListener('click', async function(event){
  // const redeemContent = document.getElementById("redeemContent");
  redeemBtn.classList.add('bgDisabled','bixgrow-loading');
  // redeemContent.textContent = "Loading...";
  const payload = {
    shop: Shopify.shop,
    affiliate_id: bgRefHashCode,
    referral_site: document.referrer 
  }
  try{
    const responseData = await bgUseFetch(`${bixgrowUrl}/api/v2/automatic-coupon-customer`,'POST',payload,{ "Content-Type": "application/json","Accept": "application/json"});
      if(responseData && responseData?.discount_code){  
        redeemBtn.classList.add("bgDisplayNone");
        redeemBtn.classList.remove('bgDisabled','bixgrow-loading');
        shopNowBtn.classList.remove("bgDisplayNone");
        bgInput.innerHTML = responseData?.discount_code;
        autoAppliedCoupon(responseData?.discount_code);
        bgInputWrapper.classList.remove("bgDisplayNone");
        document.getElementById('bgShopNowContent').classList.remove("bgDisplayNone");
        document.getElementById('bgRedeemContent').classList.add("bgDisplayNone");
        if(isDynamicCoupon){
          bgSetCookie('bixgrow_affiliate_referral', bgRefHashCode, 30);
        }
      }else{
        document.getElementById('bgModal').remove();
      }
  }catch(error){

  }
});

window.onclick = function (event) {
  if (event.target == referralDiv) {
    referralDiv.classList.remove("bgModal--open");
  }
};
referralDiv.classList.add("bgModal--open");
}

function bgGetCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function bgSetCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function bgGetParameterByName(name, url = window.location.href) {
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
  console.log(`%c ► Bixgrow: toolbar`, "background-color: #f90; color: #fff; padding: 5px;")

  