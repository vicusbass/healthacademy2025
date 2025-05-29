/**
*	Bundler script loader.
*	version number: 1.0
*/
(function(){	
	var loadScript=function(a,b){var c=document.createElement("script");c.type="text/javascript",c.readyState?c.onreadystatechange=function(){("loaded"==c.readyState||"complete"==c.readyState)&&(c.onreadystatechange=null,b())}:c.onload=function(){b()},c.src=a,document.getElementsByTagName("head")[0].appendChild(c)};
	
	if (typeof window.BndlrScriptAppended === 'undefined' || window.BndlrScriptAppended === false) {
		appendScriptUrl('motion-guidance.myshopify.com');
	}
	
	// get script url and append timestamp of last change
	function appendScriptUrl(shop) {

		var timeStamp = Math.floor(Date.now() / (1000*1*1));
		var timestampUrl = 'https://bundler.nice-team.net/app/shop/status/'+shop+'.js?'+timeStamp;
		
				
					
				
		loadScript(timestampUrl, function() {
			// append app script
			if (typeof bundler_settings_updated == 'undefined') {
				console.log('settings are undefined');
				bundler_settings_updated = 'default-by-script';
			}
			
							var scriptUrl = "https://cdn-bundler.nice-team.net/app/js/bundler-script.js?shop="+shop+"&"+bundler_settings_updated;
			
			
			loadScript(scriptUrl, function(){});
		});
	}
})();