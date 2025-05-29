console.log('extension loaded .');

//agar Shopify.shop se shop na mile toh url se domain nikal lo
function preorder_panda(){
	let preorder_js = document.createElement("script");

	let shopDomain  = Shopify.shop;
	if(shopDomain){
		preorder_js.setAttribute("src", `https://pre.bossapps.co/js/script?shop=${shopDomain}`);
	}
	else{
		let domain = location.hostname
		preorder_js.setAttribute("src", `https://pre.bossapps.co/js/script?domain=${domain}`);
	}

	document.head.appendChild(preorder_js);
}

preorder_panda();
