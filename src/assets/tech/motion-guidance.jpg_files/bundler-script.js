

/**
*	Bundler script
*	version number: 79.01
*	STANDALONE PRODUCT BUNDLES
*/
if (typeof window.bundlerLoaded2 === 'undefined' ||  document.getElementById("bndlr-loaded") === null) {
	// Check for element with ID bndlr-loaded.
	// This is here to know when instant click apps load site through ajax requests	
	(function() {		

		try {
			// Mark bundler as loaded
			window.bundlerLoaded2 = true;
			
			var elem = document.createElement('div');
			elem.id = 'bndlr-loaded';
			elem.style.cssText = 'display:none;';
			if (document.body !== null) {
				document.body.appendChild(elem);
			}
		} catch(e) {
			console.error(e); 
		}
		
		try {

		var loadScript = function(url, callback){
			var script = document.createElement("script")
			script.type = "text/javascript";
			script.async = true;
		 
			if (script.readyState){  //IE
				script.onreadystatechange = function(){
					if (script.readyState == "loaded" ||
							script.readyState == "complete"){
						script.onreadystatechange = null;
						callback();
					}
				};
			} else {  //Others
				script.onload = function(){
					callback();
				};
			}
		 
			script.src = url;
			
			/*
			var x = document.getElementsByTagName('script')[0];
			x.parentNode.insertBefore(script, x);
			*/
			document.getElementsByTagName("head")[0].appendChild(script);
		};
		
		var idleCallback = function(callback) {
			
						
								
					if (typeof window.requestIdleCallback === 'function') {
						window.requestIdleCallback(callback);
					} else {
						callback();
					}
					
								
					}
		
		var debouncers = [];
		var debounce = function(key, callback, delay) {
			if (typeof debouncers[key] !== 'undefined') {
				clearTimeout(debouncers[key]);
			}
			debouncers[key] = setTimeout(callback, delay);			
		}
		
		// This variable will contain internal functions which can be shared between different modules
		// E.g.: a function which removes items from the cart which are already in a full bundle, so the funnel module can use only the other products
		var _internalFunctionCollection = {};
		
		// Main Bundler script
		var bundler = function($) {
			
				var bundlerConsole = {
					_canUseConsole: function() {
													return true;
											},
					log: function() {
						if (this._canUseConsole()) {
							window.console.log.apply(null, arguments);
						}
					},
					warn: function() {
						if (this._canUseConsole()) {
							window.console.warn.apply(null, arguments);
						}
					},
					info: function() {
						if (this._canUseConsole()) {
							window.console.info.apply(null, arguments);
						}
					},
					error: function() {
						if (this._canUseConsole()) {
							window.console.error.apply(null, arguments);
						}
					}
				};			
			
			// Object for accessing products from local storage
			var local = {
									maxAge: 60*1000*5, // Save product data for 5 minutes
								key : 'bndlr_data_',
				cache: {},
				save: function(key, data) {
					try {
						var ld = {};

						try {
							var localData = localStorage.getItem(this.getKey());
							localData = JSON.parse(localData);
						} catch(e) {
							console.log('no data yet');
						}
						
						if (typeof localData === 'object' && localData !== null) {
							ld = localData;
						}
						
						ld[key] = {
							data: data,
							time: (new Date().getTime())
						}

						ld = JSON.stringify(ld);
						localStorage.setItem(this.getKey(), ld);
						
						this.cache[key] = ld[key];

					} catch(e) {
						console.log('Error when saving data', e);
					}
				},
				get: function(key, age) {
					if (typeof age === 'undefined') {
						age = this.maxAge;
					}
					try {
						
						if (typeof this.cache[key] !== 'undefined') {
							var ld = this.cache[key];
						} else {
							var ld = localStorage.getItem(this.getKey());
							ld = JSON.parse(ld);
						}

						if (typeof ld[key] === 'undefined' ||  ld[key].time === 'undefined') {
							return false;
						}

						if (ld[key].time < (new Date().getTime() - this.maxAge)) {
							// data is too old
							return false;
						}
						
						return JSON.parse(JSON.stringify(ld[key].data));
					} catch(e) {
						return false;
					}
					return false;
				},
				getKey: function() {
					var localKey = this.key;
					var currency = '';
					if (typeof Shopify !== 'undefined' && Shopify.hasOwnProperty('currency') && Shopify.currency.hasOwnProperty('active')) {
						currency = Shopify.currency.active;
					}
					localKey += currency;
					
					var country = '';
					if (typeof Shopify !== 'undefined' && Shopify.hasOwnProperty('country') && typeof Shopify.country === 'string') {
						country = Shopify.country;
					}
					localKey += country;
					
					var locale = '';
					if (typeof Shopify !== 'undefined' && Shopify.hasOwnProperty('locale') && typeof Shopify.locale === 'string') {
						locale = Shopify.locale;
					}
					localKey += locale;
					return localKey;
				}
			};
			
			var customer = {
				cache: {},
				promises: {},
				getCustomerTags: function(init) {
					if (typeof init === 'undefined') {
						init = false;
					}
					
					var customerTags = null;
					if (typeof BndlrScriptAppended !== 'undefined' && BndlrScriptAppended === true) {
						// Script is appended, so tags should be available
						if (typeof BndlrCustomerTags !== 'undefined' && BndlrCustomerTags.length > 0) {
							customerTags = BndlrCustomerTags;
						} else {
							// Customer tags don't exist (customer is most likely not logged in).
							customerTags = [];
						}
					}
					
					if (customerTags === null) {
						// Retrieve them from storage
						tagsFromStorage = local.get('customer_tags', 60*1000*30); // 30 min
						if (tagsFromStorage !== false) {
							customerTags = tagsFromStorage;
						}
					}
					
					local.save('customer_tags', customerTags);
					
					if (customerTags === null && init === true) {
						// This request should be made only on script load
						var tagsFromEndpoint = customer.getCustomerTagsFromEndpoint().done(function(data) {
							if (typeof data.tags !== 'undefined' && data.tags !== null) {
								customerTags = data.tags;
							} else {
								customerTags = [];
							}
							local.save('customer_tags', customerTags);
						});
					}
					
					return customerTags;
				},
				getCustomerTagsFromEndpoint: function() {
					// Returns customer tags (Array), or Null if the tags couldn't be retrieved.
					var endpoint = 'a/bundles/customer.json';
					
					var url = nav.getRootUrl(true) + endpoint;
					
					// Check if there is a response in the cache
					if (typeof customer.cache[url] !== 'undefined' && typeof customer.cache[url] !== 'undefined') {
						// Return the response
						var deferred = $.Deferred().resolve(JSON.parse(JSON.stringify(cart.cache[url])));
						return deferred.promise();
					}
					
					if (typeof customer.promises[url] !== 'undefined' && typeof customer.promises[url].readyState !== 'undefined' && customer.promises[url].readyState < 4) {
						// This logic here will return the pending promise if we request the same url multiple times before the first promise returns a response.
						// TODO we could add the timestamp to promises and use them as caching mecahnism, as if you add the .done() callback to an executed promise (readyState === 4), the callback gets executed immediately.
						// The only problem could be if the returned object gets modified in one of the callbacks
						return customer.promises[url];
					} else {
					
						var promise = $.ajax({
							url: url,
							dataType: 'json'
						}).done(function(cartData) {							
							customer.cache[url] = JSON.parse(JSON.stringify(cartData));
						});
						
						// Add promise to the promises object
						customer.promises[url] = promise;
						
						return promise;
					}
				},
			};
			
			var cart = {
				cartCache: {},
				promises: {},
				updateNote: function(note) {
					var promise = $.ajax({
						url: nav.getRootUrl(true) + 'cart/update.js',
						dataType: 'json',
						data: {
							note: note
						}
					});
					return promise;
				},
				get: function(whichEndpoint, checkCache) {
					
					// We are displaying the bundle via preview, so the cart.js does not need to be called
					if (displayBundleViaPreview) {
						return;
					}
					
					if (typeof checkCache === 'undefined') {
						checkCache = true;
					}
					
										
					if (typeof whichEndpoint === 'undefined') {
						whichEndpoint = 'default';
					}
											var endpoint = 'cart.js';
										if (whichEndpoint == 'proxy') {
													var endpoint = 'cart.js';
											}
					
					//  Shopify.routes.root 
					
					// Don't pass the currency parameter if the Shopify's cart cart change request returns null as the value for "sections" in the request. This is most likely a bug in Shopify. 
											var url = nav.getRootUrl(true) + endpoint + '?currency='+bndlr.getDefaultCurrency()+'&bundler-cart-call'; // Changed the order of parameters on 2023-06-14 globalmountainbikenetwork
										
					if (checkCache) {
						// Check if there is a response in the cache which isn't older than 1.5 seconds
						var timestamp = Date.now();
							timestamp = Math.round(timestamp / 1500);
						if (typeof cart.cartCache[url] !== 'undefined' && typeof cart.cartCache[url][timestamp] !== 'undefined') {
							// Return the response
							var deferred = $.Deferred().resolve(JSON.parse(JSON.stringify(cart.cartCache[url][timestamp])));
							return deferred.promise();
						}
					}
					
					if (checkCache && typeof cart.promises[url] !== 'undefined' && typeof cart.promises[url].readyState !== 'undefined' && cart.promises[url].readyState < 4) {
						// This logic here will return the pending promise if we request the same url multiple times before the first promise returns a response.
						// TODO we could add the timestamp to promises and use them as caching mecahnism, as if you add the .done() callback to an executed promise (readyState === 4), the callback gets executed immediately.
						// The only problem could be if the returned object gets modified in one of the callbacks
						return cart.promises[url];
					} else {
					
						var promise = $.ajax({
							url: url,
							dataType: 'json'
						}).done(function(cartData) {
							// Save response to cache for 1.5 seconds
							var timestamp = Date.now();
								timestamp = Math.round(timestamp / 1500);
								
							if (typeof cart.cartCache[url] === 'undefined') {
								cart.cartCache[url] = {};
							}
							
							cart.cartCache[url][timestamp] = JSON.parse(JSON.stringify(cartData));
							
						}).done(function(cartData) {
							cart.modifyCartData(cartData);
						});
						
						// Add promise to the promises object
						cart.promises[url] = promise;
						
						return promise;
					}
				},
				modifyCartData: function(cartData) {
					if (typeof clientSpecifics['modify_cart_data'] !== 'undefined') {
						clientSpecifics['modify_cart_data'].trigger(cartData);
					}
				},
				removeUnusedProductProperties: function(product) {
					var unusedProperties = [
						'description',
						'published_at',
						'created_at',
						'compare_at_price',
						'compare_at_price_max',
						'compare_at_price_min',
						'compare_at_price_varies',
						'price',
						'price_max',
						'price_min',
						'price_varies',
						'tags',
						'type',
						'url',
						'vendor',
						//'selling_plan_groups' // We need this to pass to Seal so the Seal can get Shopify Markets prices
					];
					
					var unusedVariantProperties = [
						'barcode',
						'requires_shipping',
						'sku',
						'taxable',
						'weight',
						//'selling_plan_allocations' // We need this to pass to Seal so the Seal can get Shopify Markets prices
					];

					for(var i = 0; i< unusedProperties.length; i++) {
						if (typeof product[unusedProperties[i]] !== 'undefined') {
							delete product[unusedProperties[i]];
						}
					}
					
					for(var i = 0; i < product.variants.length; i++) {
						for(var j = 0; j < unusedVariantProperties.length; j++) {
							if (typeof product.variants[i][unusedVariantProperties[j]] !== 'undefined') {
								delete product.variants[i][unusedVariantProperties[j]];
							}
						}
					}
					
					return product;
				},
				modifyProductStructure: function(product) {
					if (typeof clientSpecifics['modify_product_structure'] !== 'undefined') {
						product = clientSpecifics['modify_product_structure'].trigger(product);
					}

					return product;
				},
				getProductData: function(rootUrl, productHandle) {

					var localProduct = local.get(productHandle);
					
					if (displayBundleViaPreview) {
						var bundlePreviewProducts = window.preview_bundle.products;
						for(var key in bundlePreviewProducts) {
							
							if (bundlePreviewProducts.hasOwnProperty(key)) {
								var previewProduct = bundlePreviewProducts[key];
							
								if (previewProduct.handle === productHandle) {
									localProduct = previewProduct;
								}
							}
						}
					}					
					
					if (localProduct === false) {
						// Product is not in local storage or it's time has expired
						//var productUrl = rootUrl+'products/'+productHandle+'.js';
						
												
							var country = '';
							if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.country === 'string') {
								country = window.Shopify.country;
							}

							var productUrl = rootUrl+'products/'+productHandle+'.js?currency='+bndlr.getDefaultCurrency()+'&country='+country;
												
						//console.log('productUrl', productUrl);
						
						var ajax = $.ajax({
							url: productUrl,
							dataType: 'json'
						})
						
						ajax.done(function(data) {
							//console.log('data', JSON.parse(JSON.stringify(data)));
							
							data = cart.removeUnusedProductProperties(data);
							
							data = cart.modifyProductStructure(data);
							
							local.save(productHandle, data);
						});
						/*
						ajax.fail(function() {
							console.log('error');
						});
						
						ajax.done(function() {
							console.log('done');
						});*/
						
						return ajax;
					} else {
						// Product was retrieved from local storage
						var deferred = $.Deferred().resolve(localProduct);
						return deferred.promise();
					}
				},
				getProductDataJSON: function(rootUrl, productHandle) {
					var productUrl = rootUrl+'products/'+productHandle;
					return $.ajax({
						url: productUrl,
						contentType: 'application/json',
						dataType: 'json'
					});
				},
				getProductDataViaProxy: function(rootUrl, productId, handle, errorCallback) { // Handle is here just to be used in the error message
					var locale = '';
					
					if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.locale === 'string') {
						locale = window.Shopify.locale;
					}
					
					var productUrl = rootUrl+'a/bundles/products/product.js?id='+productId+'&cur='+bndlr.getDefaultCurrency()+'&locale='+locale;
					
										
					return $.ajax({
						url			: productUrl,
						contentType	: 'application/json',
						dataType	: 'json'
					}).done(function(data) {
						if (typeof data === 'undefined' || data.length === 0) {
							// Couldn't retrieve product data 
							// Return error
							
							var errorMessage = 'Bundler: Can\'t get product data: ' + nav.getRootUrl(true) + 'products/' + handle +'.<br />To show the bundle widget, just make sure that the product is active in your online shop.';
							console.warn(errorMessage);
							
							if (typeof errorCallback === 'function') {
								errorCallback();
							}

						} else {
						
							data = cart.removeUnusedProductProperties(data);
							
							data = cart.modifyProductStructure(data);
							
							local.save(data.handle, data);
						}
					});
				},
				addToCart: function(rootUrl, id, quantity, properties) {
					var url = rootUrl+'cart/add.js?bundler-cart-call';
					
					return $.ajax({
						url: url,
						data: {
							id: id,
							quantity: quantity,
							properties: properties
						},
						type: 'POST',
						dataType: 'json'
					});
				},
				addMultipleItemsToCart: function(rootUrl, items) {
					// This is a non-standard way of adding the items to the cart
					var url = rootUrl+'cart/add.js?bundler-cart-call';
					
					// Merge items with the same variant ids and properties to one element.
					// If you don't merge them, an issue can occur where the cart doesn't get properly updated. It only hapens if you add the same producs to the cart in the same request.
					var totalQuantityCount = {};
					for(var i = 0; i<items.length; i++) {
						var key = JSON.stringify(items[i]);
						if (typeof totalQuantityCount[key] === 'undefined') {
							totalQuantityCount[key] = JSON.parse(JSON.stringify(items[i]));
							totalQuantityCount[key]['quantity'] = totalQuantityCount[key]['quantity']*1;
						} else {
							totalQuantityCount[key]['quantity'] += items[i]['quantity']*1;
						}
					}
					
					var items = [];
					for(var key in totalQuantityCount) {
						if (totalQuantityCount.hasOwnProperty(key)) {
							items.push(totalQuantityCount[key]);
						}
					}
					
					return $.ajax({
						url: url,
						data: {
							items: items
						},
						type: 'POST',
						dataType: 'json'
					});
				},
				updateCart: function() {
					
					this.get().done(function(data) {
						try {
							var itemCount = data.item_count;
							$('[data-cart-item-count]').html(itemCount);
							$('.header__cart-count').html(itemCount);
							$('.site-header__cart-count span[data-cart-count]').html(itemCount);
							
							if ($('#CartCount [data-cart-count]').length > 0) {
								$('#CartCount [data-cart-count]').html(itemCount);
							} else if ($('#CartCount').length > 0) {
								$('#CartCount').html($('#CartCount').html().replace(/(\d+)/, data.item_count));
								//$('#CartCount').html(itemCount);
							}
							
							if ($('#CartCount.hide').length>0) {
								$('#CartCount.hide').removeClass('hide');
							}

							if ($('#site-cart-handle .count-holder .count').length > 0) {
								$('#site-cart-handle .count-holder .count').html($('#site-cart-handle .count-holder .count').html().replace(/(\d+)/, data.item_count));
							}
							if ($('#minicart .count.cart-target').length > 0) {
								$('#minicart .count.cart-target').html($('#minicart .count.cart-target').html().replace(/(\d+)/, data.item_count));
							}
							if ($('#sidebar #meta .count').length > 0) {
								$('#sidebar #meta .count').html($('#sidebar #meta .count').html().replace(/(\d+)/, data.item_count));
							}
							
							if ($('.site-header__cart .site-header__cart-indicator').length > 0) {
								$('.site-header__cart .site-header__cart-indicator').html($('.site-header__cart .site-header__cart-indicator').html().replace(/(\d+)/, data.item_count));
								
								if (data.item_count>0) {
									$('.site-header__cart .site-header__cart-indicator').removeClass('hide');
								}
							}
							
							if ($('.cart-count').length > 0) {
								$('.cart-count').html($('.cart-count').html().replace(/(\d+)/, data.item_count));
							}
							
							if ($('.cartCount[data-cart-count]').length > 0) {
								$('.cartCount[data-cart-count]').html($('.cartCount[data-cart-count]').html().replace(/(\d+)/, data.item_count));
							}
							if ($('[data-js-cart-count-desktop]').length > 0) {
								$('[data-js-cart-count-desktop]').html(data.item_count);
								$('[data-js-cart-count-desktop]').attr('data-js-cart-count-desktop', data.item_count);
							}
							
							
							if ($('[data-cart-count]').length > 0) {
								$('[data-cart-count]').attr('data-cart-count', data.item_count);
							}
							if ($('[data-header-cart-count]').length > 0) {
								$('[data-header-cart-count]').attr('data-header-cart-count', data.item_count).addClass('visible');
							}
							
							if ($('.site-header__cart-toggle .site-header__cart-indicator').length > 0) {
								$('.site-header__cart-toggle .site-header__cart-indicator').html(data.item_count);
							}
							
							if ($('.cart-item-count-header').length > 0) {
								var $itemCountHeader = $('.cart-item-count-header').first();
								if ($itemCountHeader.hasClass('cart-item-count-header--total') === true) {
									// Set rpice, as this theme shows price there
									if ($itemCountHeader.find('.money').length) {
										$itemCountHeader = $itemCountHeader.find('.money').first();
										$itemCountHeader.html(bndlr.formatPrice(data.items_subtotal_price));
									}
									
								} else {
									// Set item count as this theme uses item count there
									$itemCountHeader.html($itemCountHeader.html().replace(/(\d+)/, data.item_count));
								}
							}
							
															if ($('#CartCost').length > 0 && typeof theme !== 'undefined' && typeof theme.moneyFormat !== 'undefined') {
									var totalCartValue = utils.formatMoney(data.items_subtotal_price, theme.moneyFormat);
									$('#CartCost').html(totalCartValue);
								}
														
							if (typeof refreshCart == 'function') {
								refreshCart(data);
							}
							if (typeof slate !== 'undefined' && typeof slate.cart !== 'undefined' && typeof slate.cart.updateCart == 'function') {
								slate.cart.updateCart();
							}
							
							if (typeof ajaxCart !== 'undefined' && typeof ajaxCart.load === 'function') {
								ajaxCart.load();
							}
							
							if ($('.mega-nav-count.nav-main-cart-amount.count-items').length > 0) {
								$('.mega-nav-count.nav-main-cart-amount.count-items').html($('.mega-nav-count.nav-main-cart-amount.count-items').html().replace(/(\d+)/, data.item_count));
								$('.mega-nav-count.nav-main-cart-amount.count-items.hidden').removeClass('hidden');
							}
							
							if ($('#cart-icon-bubble').length > 0) {
								var cntSelector = '#cart-icon-bubble .cart-count-bubble span[aria-hidden="true"]';
								if ($(cntSelector).length > 0) {
									$(cntSelector).html($(cntSelector).html().replace(/(\d+)/, data.item_count));
								} else {
																			$('#cart-icon-bubble').append('<div class="cart-count-bubble"><span aria-hidden="true">'+data.item_count+'</span></div>');
																	}
							} 
							
							
							if (typeof Shopify !== 'undefined' && typeof Shopify.updateQuickCart !== 'undefined') {
								Shopify.updateQuickCart(data);
							}
							
							if (typeof bcActionList !== 'undefined' && typeof bcActionList.atcBuildMiniCartSlideTemplate === 'function') {
								bcActionList.atcBuildMiniCartSlideTemplate(data);
								
								if (typeof openMiniCart === 'function') {
									openMiniCart();
								}
							}
							
							if ($('.custom-cart-eye-txt').length > 0) {
								$('.custom-cart-eye-txt').html($('.custom-cart-eye-txt').html().replace(/(\d+)/, data.item_count));
							}
							
							if ($('.cart_count').length > 0) {
								$('.cart_count').each(function(k, e) {
									$(e).html($(e).html().replace(/(\d+)/, data.item_count));
								});
							}
							
							if ($('.cart-count-bubble [data-cart-count]').length > 0) {
								$('.cart-count-bubble [data-cart-count]').html($('.cart-count-bubble [data-cart-count]').html().replace(/(\d+)/, data.item_count));
							}
							if ($('.cart-count-bubble span.visually-hidden').length > 0) {
								$('.cart-count-bubble span.visually-hidden').html($('.cart-count-bubble span.visually-hidden').html().replace(/(\d+)/, data.item_count));
							}
							
							if ($('.header-cart-count .cart_count_val').length > 0) {
								$('.header-cart-count .cart_count_val').html(data.item_count);
								$('.header-cart-count').removeClass('empty_cart_count');
							}
							
							if (typeof Shopify !== 'undefined' && 
								typeof Shopify.updateCartInfo !== 'undefined' && 
								$('.top-cart-holder .cart-target form .cart-info .cart-content').length > 0) {

								Shopify.updateCartInfo(data, '.top-cart-holder .cart-target form .cart-info .cart-content');
							}
							
							if ($('#CartCount').length > 0) {
								if (data.item_count>0) {
									$('#CartCount').removeClass('hidden');
								}
							}
							
														
															var event = new CustomEvent("wetheme-toggle-right-drawer", {
									detail: {
										type: 'cart',
										forceOpen: undefined,
										params: { cart: data },
									},
								});
								document.documentElement.dispatchEvent(event);
														
							if (typeof window.vndHlp !== 'undefined' && typeof window.vndHlp.refreshCart === 'function') {
								window.vndHlp.refreshCart(data);
							}
							
							try {
								if (typeof window.renderCart === 'function') {
									window.renderCart(data);
									
									if (data.items.length > 0) {
										var $cart = $('.mini-cart.is-empty');
										$cart.removeClass('is-empty');
									}
									
																	}
							} catch(e) {
								
							}
							
							try {
								/*
								if (typeof window.SATCB !== 'undefined' && typeof window.SATCB.Helpers !== 'undefined' && typeof window.SATCB.Helpers.postATCCallback === 'function') {
									window.SATCB.Helpers.postATCCallback();
								}
								*/
								
								if (typeof window.SATCB !== 'undefined' && typeof window.SATCB.Helpers !== 'undefined' && typeof window.SATCB.Helpers.openCartSlider === 'function') {
									window.SATCB.Helpers.openCartSlider();
								}
							} catch(e) {
								
							}
							try {
								//document.dispatchEvent(new CustomEvent('theme:cart:reload'));
								document.dispatchEvent(new CustomEvent('theme:cart:change', {
									detail: {
										cart: data,
										cartCount: data.item_count
									},
									bubbles: true
								}))
							} catch(e) {
								
							}
							
							if (typeof window.cartStore !== 'undefined' && typeof window.cartStore.setState === 'function') {
								// vittoriacoffee
								window.cartStore.setState({justAdded: {}, popupActive: true, item_count: data.item_count, items: data.items, cart: data});
							}
							
															if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.onCartUpdate === 'function') {
									
									if (Shopify.onCartUpdate.toString().indexOf('There are now') === -1) {
										window.Shopify.onCartUpdate(data, true);
									}
								}
														
							if (typeof theme !== 'undefined' && typeof theme.Cart !== 'undefined' && typeof theme.Cart.setCurrentData === 'function') {
								theme.Cart.setCurrentData(data);
							}
							
							if (typeof window.halo !== 'undefined' && typeof window.halo.updateSidebarCart === 'function') {
								window.halo.updateSidebarCart(data);

								var $sideBarCartIcon = $('[data-cart-sidebar]');
								
								if ($sideBarCartIcon.length > 0) {
									$sideBarCartIcon[0].click();
								}
							}
							
							if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.theme !== 'undefined' && typeof window.Shopify.theme.ajaxCart !== 'undefined' && typeof window.Shopify.theme.ajaxCart.updateView === 'function') {
								Shopify.theme.ajaxCart.updateView({cart_url: '/cart'}, data);
							}
							
															if (typeof window.theme !== 'undefined' && typeof window.theme.cart !== 'undefined' && typeof window.theme.cart.updateAllHtml === 'function') {
									try {
										window.theme.cart.updateAllHtml();
										window.theme.cart.updateTotals(data.items.length);
										document.querySelector('.header--cart-toggle').click();
									} catch(e) {}
								}
														
							if (typeof monster_setCartItems === 'function') {
								try {
									monster_setCartItems(data.items);
								} catch(e) {
									console.error(e);
								}
							}
							
							
							try {
								if (typeof window.refreshCartContents !== 'undefined') {
									window.refreshCartContents(data);
								}
							} catch(e) {
								
							}
							
							/*
							if ($('.header-actions [data-header-cart-total]').length > 0) {
								$('.header-actions [data-header-cart-total]').html(bndlr.formatPrice(data.items_subtotal_price));
							}*/
							
							if ($('.header-actions [data-header-cart-count]').length > 0) {
								$('.header-actions [data-header-cart-count]').html(data.item_count);
							}
							
							/*
							try {
								window.dispatchEvent(
								  new CustomEvent('boost-sd-set-cart-data', {
									detail: {
									  cartData: data,
									},
								  })
								);
							} catch(e) {
								
							}*/
							/*
							try {
								document.body.dispatchEvent(
									new CustomEvent('shapes:modalcart:afteradditem', {
										bubbles: true,
										detail: { response: data },
									})
								);
							} catch(e) {
								
							}*/
							
							try {
								if (typeof renderProduct === 'function') {
									renderProduct(data.items);
								}
							} catch(e) {
							}
							
						

							var $cartIcon = $('.header__icon-list [aria-controls="cart-drawer"][href*="/cart"]');
							if ($cartIcon.length > 0) {
								$cartIcon[0].click();
							}
							var $cartIcon = $('a#headerCartStatus');
							if ($cartIcon.length > 0) {
								$cartIcon[0].click();
							}
							
																					
							
							window.dispatchEvent(new Event('update_cart'));
							
							if (typeof clientSpecifics['update_cart'] !== 'undefined') {
								clientSpecifics['update_cart'].trigger(data);
							}
						} catch(e) {
							bundlerConsole.log(e);
						}
						
						try {
							if (typeof window.theme !== 'undefined' && typeof window.theme.cart !== 'undefined' && typeof window.theme.cart.store !== 'undefined' && typeof window.theme.cart.store.getState === 'function') {
								var cartState = window.theme.cart.store.getState();
								
								if (typeof cartState.updateNote === 'function') {
									// Update note to the same value as this triggers a cart drawer update XD
									cartState.updateNote(cart.note);
								}
							}
						} catch(e) {
							console.log(e);
						}
						
						
						try {

							var miniCartOuterbox = document.querySelector('.minicart__outerbox');
							if (miniCartOuterbox !== null && typeof window.cartContentUpdate === 'function') {
								sectionsToRender = miniCartOuterbox.dataset.section;
								var promise = fetch(nav.getRootUrl(true) + 'cart?sections='+sectionsToRender, {
									method: 'GET',
									cache: 'no-cache',
									credentials: 'same-origin',
									headers: {
										'Content-Type': 'application/json'
									}
								}).then(function(sectionsData) {
									
									try {
										return sectionsData.clone().json().then(function(p) {
											// Also retrieve the cart because this method also needs the full cart data
											
											data.sections = p;												
											window.cartContentUpdate(data, miniCartOuterbox, sectionsToRender);
											
											
										});
									} catch(e) {
										console.error(e);
									}
								});
							}
							
						} catch(e) {
							console.error(e);
						}
						
						/*
						try {
							document.body.dispatchEvent(
								new CustomEvent('shapes:modalcart:afteradditem', {
									bubbles: true,
									detail: { response: data }
								})
							);
						} catch(e) {
							console.error(e);
						}*/
						
						/*
						try {
							if (typeof window.updateCartContents === 'function') {
								//window.updateCartContents(data);
								var tmpData = {
									json: () => Promise.resolve(data)
								};
								window.updateCartContents(tmpData);
							}
						} catch(e) {
							console.error(e);
						}*/
						
					});
					
					if (typeof window.SLIDECART_UPDATE !== 'undefined') {
						try {
							// #slidecarthq
							window.SLIDECART_UPDATE();
						} catch(e) {
							bundlerConsole.log(e);
						}
					}
					if (typeof window.SLIDECART_OPEN !== 'undefined') {
						setTimeout(function() {
							try {
								// meina-naturkosmetik-de
								// #slidecarthq
								window.SLIDECART_OPEN();
							} catch(e) {
								bundlerConsole.log(e);
							}
						}, 500);
					}
					
					if (typeof Shopify !== 'undefined' && typeof Shopify.theme !== 'undefined' && typeof Shopify.theme.jsAjaxCart !== 'undefined' && typeof Shopify.theme.jsAjaxCart.updateView === 'function') {
						Shopify.theme.jsAjaxCart.updateView();
					}
					
					if (typeof CartJS !== 'undefined' && typeof CartJS.getCart === 'function') {
						try {
							// Avone theme
							CartJS.getCart();
						} catch(e) {
							bundlerConsole.log(e);
						}
						
											}
					
					if ($('.sp-cart .sp-dropdown-toggle').length && typeof Shopify !== 'undefined' && typeof Shopify.getCart === 'function') {
						Shopify.getCart();
					}
				
					
					
					if ($('form.cart-drawer').length > 0) {
						// Trigger update of cart drawer in Narrative theme
						// Simulate edit on the template or actual input of one of the products in the cart
						$('.cart-drawer input').first().trigger('blur');
						setTimeout(function(){ 
							$('.cart-drawer input').first().trigger('input');
						}, 350);
					}
					
					
											try {

							var cartDrawer = document.querySelector('m-cart-drawer');
							if (cartDrawer !== null && typeof cartDrawer.onCartDrawerUpdate === 'function') {
								cartDrawer.onCartDrawerUpdate();
								
								if (typeof cartDrawer.open === 'function') {
									cartDrawer.open()
								}
							}
						} catch(e) {
							bundlerConsole.log(e);
						}
										
					try {
						// Added for faun-walk
						if (typeof window.opusOpen === 'function') {
							window.opusOpen();
						}

					} catch(e) {
						bundlerConsole.log(e);
					}

                    try {

                        var cartDrawer = document.querySelector('#CartDrawer');
						if (cartDrawer !== null && typeof cartDrawer.update === 'function') {
							cartDrawer.update();
						}
                    } catch(e) {
                        bundlerConsole.log(e);
                    }

                    try {
						// Trigger cart update
						document.dispatchEvent(new CustomEvent('theme:update:cart'));
						
						setTimeout(function() {
							document.dispatchEvent(new CustomEvent('theme:open:cart-drawer'));
						}, 500);

                    } catch(e) {
                        bundlerConsole.log(e);
                    }
					
                    try {
						
						if (typeof window.updateCartDrawer === 'function') {
							window.updateCartDrawer();
						}

                    } catch(e) {
                        bundlerConsole.log(e);
                    }
					
										
										
										
										
										
					
											try {
							document.dispatchEvent(new CustomEvent('cart:refresh'));
						} catch(e) {}
						
						try {
							document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', {
								bubbles: true
							}));
						} catch(e) {}
										
					if (typeof window.HsCartDrawer !== 'undefined' && typeof window.HsCartDrawer.updateSlideCart === 'function') {
						// You could also use the window.HS_SLIDE_CART_UPDATE() method
						debounce('hscartdrawer', function() {
							try {
								// tesbros
								HsCartDrawer.updateSlideCart();
							} catch(e) {
								bundlerConsole.log(e);
							}
						}, 100);
					}
					
					
					if (typeof window.HS_SLIDE_CART_UPDATE === 'function') {
						// You could also use the window.HS_SLIDE_CART_UPDATE() method
						debounce('hscartdrawer2', function() {
							try {
								window.HS_SLIDE_CART_UPDATE();
							} catch(e) {
								bundlerConsole.log(e);
							}
						}, 100);
					}
					
					if (typeof window.HS_SLIDE_CART_OPEN !== 'undefined' && typeof window.HS_SLIDE_CART_OPEN === 'function') {
						debounce('hscartdraweropen', function() {
							try {
								// adultluxe
								window.HS_SLIDE_CART_OPEN()
							} catch(e) {
								bundlerConsole.log(e);
							}
						}, 100);
					}
					
					
					
					
					if (typeof theme !== 'undefined' && typeof theme.Cart !== 'undefined' && typeof theme.Cart.updateCart === 'function') {
						theme.Cart.updateCart();
					}
					
					if (typeof window.cart !== 'undefined' && typeof window.cart.getCart === 'function') {
						window.cart.getCart();
					}
					
					if (typeof window.updateMiniCartContents === 'function') {
						try {
							window.updateMiniCartContents();
						} catch(e) {}
					}
					
					if (typeof window.loadEgCartDrawer === 'function') {
						try {
							window.loadEgCartDrawer();
						} catch(e) {}
					}
					
										
					try {
						document.dispatchEvent(new CustomEvent('cart:build'));
					} catch(e) {}
	
					try {
						document.dispatchEvent(
							new CustomEvent('obsidian:upsell:refresh')
						);
						document.dispatchEvent(
							new CustomEvent('obsidian:upsell:open')
						);
					} catch(e) {}
					
					var siteCart = document.getElementById('site-cart');
					if (siteCart !== null) {
						try {
							siteCart.show();
						} catch(e) {}
					}
					
					if (typeof window.theme !== 'undefined' && typeof window.theme.updateCartSummaries === 'function') {
						try {
							window.theme.updateCartSummaries();
						} catch(e) {}
					}
					
					if (typeof window.CD_REFRESHCART !== 'undefined') {
						try {
							// #506.io
							window.CD_REFRESHCART();
						} catch(e) {
							bundlerConsole.log(e);
						}
					}
					if (typeof window.CD_OPENCART !== 'undefined') {
						setTimeout(function() {
							try {
								// pengems
								// #506.io
								window.CD_OPENCART();
							} catch(e) {
								bundlerConsole.log(e);
							}
						}, 500);
					}
					
					if (typeof window.buildCart === 'function') {
						try {
							window.buildCart();
						} catch(e) {
							bundlerConsole.log(e);
						}
					}
					
					if (typeof window.PXUTheme !== 'undefined' && typeof window.PXUTheme.jsAjaxCart !== 'undefined' && typeof window.PXUTheme.jsAjaxCart.updateView === 'function') {
						try {
							window.PXUTheme.jsAjaxCart.updateView();
						} catch(e) {}
					}
					if (typeof window.theme !== 'undefined' && typeof window.theme.addedToCartHandler === 'function') {
						try {
							window.theme.addedToCartHandler({});
						} catch(e) {}
					}
					
					// Rebuy.Cart.fetchCart()
					if (typeof window.Rebuy !== 'undefined' && typeof window.Rebuy.Cart !== 'undefined' && typeof window.Rebuy.Cart.fetchCart === 'function') {
						try {
							// Triggering Rebuy's fetch cart
							window.Rebuy.Cart.fetchCart();
						} catch(e) {}
					}						
					
					/*
						Alpine.store('xMiniCart').reLoad();
						Alpine.store('xMiniCart').openCart();
					*/
					if (typeof window.Alpine !== 'undefined' && typeof Alpine.store !== 'undefined') {
						try {
							Alpine.store('xMiniCart').reLoad();
							Alpine.store('xMiniCart').openCart();
							
							setTimeout(function() {
								// Refresh cart 
								DiscountEstimator.calculateDiscounts();
							}, 1000);
						} catch(e) {}
					}
					
					if (typeof window.cart_calling !== 'undefined' && typeof window.cart_calling.updateCart === 'function') {
						try {
							window.cart_calling.updateCart();
						} catch(e) {}
					}
					
					/*
					if (typeof window.app === 'function') {
						try {
							console.log('creating app');
							
							var tmpApp = window.app();
							if (typeof tmpApp.updateCart === 'function') {
								console.log('updating cart');
								
								tmpApp.updateCart();
							}
						} catch(e) {}
					}*/
					
					
					
					try {
						var event = new Event('tcustomizer-event-cart-change');
						document.dispatchEvent(event);
					} catch(e) {}
					
					try {
						document.body.dispatchEvent(new CustomEvent("label:modalcart:afteradditem"));
					} catch(e) {}
					
					try {
						// Dispatch cart drawer refresh event
						document.dispatchEvent(new CustomEvent('dispatch:cart-drawer:refresh', {
							bubbles: true
						}));
						
						setTimeout(function() {
							document.dispatchEvent(new CustomEvent('dispatch:cart-drawer:open'));
						}, 500);
						
					} catch(e) {}
					
					try {
						if (typeof  window.upcartRefreshCart !== 'undefined') {
							window.upcartRefreshCart();
						}
					} catch(e) {
						
					}
					
					try {
						if (typeof window.SHTHelper !== 'undefined' && typeof window.SHTHelper.forceUpdateCartStatus === 'function') {
							window.SHTHelper.forceUpdateCartStatus();
						}
					} catch(e) {
						
					} 
					
					
					try {
						// Update cart in Dawn theme (clever-eingespart)
						var cartEl1 = document.querySelector('cart-drawer') || document.querySelector('cart-notification')  || document.querySelector('sht-cart-drwr-frm');

						if (cartEl1 !== null && typeof cartEl1.renderContents === 'function') {
							
							var sections = cartEl1.getSectionsToRender().map((section) => section.id);
							
							var promise = fetch(nav.getRootUrl(true) + 'cart?sections='+sections.toString(), {
								method: 'GET',
								cache: 'no-cache',
								credentials: 'same-origin',
								headers: {
									'Content-Type': 'application/json'
								}
							}).then(function(data) {
								
								var cartDrawer = document.querySelector('cart-drawer.drawer.is-empty');
								if (cartDrawer !== null) {
									cartDrawer.classList.remove('is-empty');
								}
								try {
									return data.clone().json().then(function(p) {

										try {
											var newData = {
												sections: p
											};
											
											cartEl1.renderContents(newData);
											
											// Trigger the event to trigger the recalculation fo total cart values
											var cartDrawerMutationEvent = new CustomEvent('bndlr:cart_drawer_mutation', {
												detail: {
													message: 'Cart drawer mutation occurred'
												}
											});

											// Step 2: Dispatch the event on the window object
											window.dispatchEvent(cartDrawerMutationEvent);
										} catch(e) {
											console.error(e);
										}
										
									});
								} catch(e) {
									console.error(e);
								}
							});
							
						}
					} catch(e) {
						console.error(e);
					}
					
					try {
						// Update cart in Dawn theme (clever-eingespart)
						var cartEl = document.querySelector('mini-cart') || document.querySelector('cart-drawer') || document.querySelector('product-form');
						
						if (cartEl !== null && typeof cartEl.renderContents === 'function') {
							
							var sections = cartEl.getSectionsToRender().map((section) => section.id);
							
							var promise = fetch(nav.getRootUrl(true) + 'cart?sections='+sections.toString(), {
								method: 'GET',
								cache: 'no-cache',
								credentials: 'same-origin',
								headers: {
									'Content-Type': 'application/json'
								}
							}).then(function(data) {
								
								try {
									return data.clone().json().then(function(p) {

										try {
											var newData = {
												sections: p
											};
											
											cartEl.renderContents(newData);
										} catch(e) {
											console.error(e);
										}
										
									});
								} catch(e) {
									console.error(e);
								}
							});
							
						}
					} catch(e) {
						console.error(e);
					}
					
										
										
										
									}
			};
			
			var nav = {
				getRootUrl: function(withLocale) {
					if (typeof withLocale === 'undefined') {
						withLocale = false;
					}
					
					var locale = '';
					if (withLocale) {
						locale = this.getUrlLocale();
					}
					
					if (this.isShopPage() === false) {
						// Return Shopify URL on third party pages
						return 'https://motion-guidance.myshopify.com/';
					} else {
						var url = window.location.origin?window.location.origin+'/':window.location.protocol+'//'+window.location.host+'/';
						if (locale.length > 0) {
							// Locale is set in the current URL, add it to the root URL
							url += locale+'/';
						}
						return url;
					}
				},
				isShopPage: function() {
					if (typeof Shopify !== 'undefined' && Shopify.shop === 'motion-guidance.myshopify.com') {
						return true;
					}
					
					return false;
				},
				getInvoiceEndpoint: function(withExtraInfo, additionalGetParams) {
					if (typeof withExtraInfo === 'undefined') {
						withExtraInfo = false;
					}
					
					if (typeof additionalGetParams === 'undefined') {
						additionalGetParams = '';
					}
					
					var ssad = false; // Seal Subscriptions apply discount
					if (typeof window.SealSubs !== 'undefined' && typeof window.SealSubs.discounts_apply_on_initial_order === 'boolean') {
						ssad = SealSubs.discounts_apply_on_initial_order;
					}
					
					// Extra info contains details about discounts, separated discount code, etc.
					var extraParam = '';
					if (withExtraInfo) {
						extraParam = '&extra=true';
					}
					
					// Check if at least one bundle has tags limitation cofigured
										
					// Try to get the customer ID so that we can apply the taxable property 
					var customerId = '';
					if (typeof window.meta !== 'undefined' && typeof window.meta.page !== 'undefined' && typeof window.meta.page.customerId !== 'undefined') {
						customerId = window.meta.page.customerId; 
					}
					
					if (typeof window.ShopifyAnalytics  !== 'undefined'&& typeof window.ShopifyAnalytics.meta  !== 'undefined'&& typeof window.ShopifyAnalytics.meta.page  !== 'undefined' && typeof window.ShopifyAnalytics.meta.page.customerId  !== 'undefined') {
						customerId = window.ShopifyAnalytics.meta.page.customerId ; 
					}
					
					if (customerId !== '') {
						extraParam += '&customer_id='+encodeURIComponent(customerId);
					}
					
										
					return this.getAppUrl() + 'cdo.php?v31&shop=motion-guidance.myshopify.com&ssad='+ssad.toString()+extraParam+additionalGetParams;
				},
				getAppUrl: function() {
					return 'https://bundler.nice-team.net/app/api/';
				},
				isCartPage: function() {
					if (/\/cart\/?/.test(window.location.href)) {
						return true;
					}
					return false;
				},
				isProductPage: function() {
					if (/\/products\/([^\?\/\n]+)/.test(window.location.href)) {
						return true;
					}
					return false;
				},
				getProductHandle: function() {
					var href = window.location.href;
					href = href.replace('/products/products/', '/products/');
					
					if (/\/products\/([^\?#\/\n]+)/i.test(href)) {
						var found = href.match(/\/products\/([^\?#\/\n]+)/i);
						if (typeof found[1] !== 'undefined') {
							return found[1];
						}
					}
					return false;
				},
				getVariantId: function() {
					var qp = this.getQueryParams(window.location.search);
					if (typeof qp['variant'] !== 'undefined') {
						return qp['variant'];
					}
					
					return '';
				},
				getQueryParams: function(qs) {
					qs = qs.split('+').join(' ');

					var params = {},
						tokens,
						re = /[?&]?([^=]+)=([^&]*)/g;

					while (tokens = re.exec(qs)) {
						params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
					}

					return params;
				},
				getQuickCheckoutUrl: function(name, id) {
					return 'https://motion-guidance.myshopify.com/a/bundles/checkout/'+utils.encodeName(name)+'-'+utils.encodeId(id);
				},
				getLandingPageUrl: function(name, id) {
					var url = 'a/bundles/'+utils.encodeName(name)+'-'+utils.encodeId(id);

					var rootUrl = this.getRootUrl(true);
					return rootUrl+url;
				},
				getLocale: function() {
					// Don't use Weglot here (probably, as it usually doesn't use the /locale/ in URL)
					if (typeof Shopify !== 'undefined' && typeof Shopify.locale === 'string') {
						return Shopify.locale
					}
					
					return '';
				},
				getUrlLocale: function() {
					var baseUrl = this.getRootUrl();
					var locale 	= this.getLocale();

					if (typeof window.Shopify !== 'undefined' && typeof Shopify.routes !== 'undefined' && typeof Shopify.routes.root === 'string') {
						// Get locale which is in URL, but is also saved in routes
						locale = Shopify.routes.root.replace(/\//g, '');						
					}
					
					if (locale !== '') {
						// Check if the baseurl + locale is present in the url
						if (window.location.href.indexOf(baseUrl+locale+'/') === 0) {
							return locale;
						}
					}

					return '';
				}
			};
			
			// Collection of dumb functions
			var utils = {
				getRandomString: function(length) {
					if (typeof length === 'undefined') {
						length = 14;
					}
					var result           = '';
					var characters       = 'abcdefghijklmnopqrstuvwxyz0123456789';
					var charactersLength = characters.length;
					var a = [];
					for ( var i = 0; i < (length); i++) {
					a.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
					}
					return a.join('');
				},
				encodeId: function(num) {
					var chrs = '0123456789abcdefghijklmnopqrstuvwxyz';

					var result = '';
					var l = chrs.length;
					while (num) {
						result = chrs.charAt(num%l) + result;
						num = parseInt(num/l);
					}

					return result;
				},
				reverseEncodeId: function(num) {
					var chrs = 'abcdefghijklmnopqrstuvwxyz0123456789';

					var result = '';
					var l = chrs.length;
					while (num) {
						result = chrs.charAt(num%l) + result;
						num = parseInt(num/l);
					}

					return result;
				},
				deCompress: function(code) {
					var chrs = '0123456789abcdefghijklmnopqrstuvwxyz';
					var result = 0;
				   
					var cl = code.length;
					for (var i = 0; i < cl; i++) {       
						result = (result * chrs.length + chrs.indexOf(code.charAt(i)));       
					}
				   
					return result;
				},
				encodeName: function(name) {
					name = name.toLowerCase();
					name = name.replace(/\s/g, '-');
					name = name.replace(/[/$\\?%#]/g, '');

					return name;
				},
				formatMoney: function(cents, format, fallbackCurrency, directionFor50) {
					
					// The directionFor50 is used to let the function know how to round numbers if the decimals equal 50.
					// We are using this direction for discounted value if the user chooses the amount_no_decimals format, because we calculate the discounted value in here by 
					// subtracting original - discount. 
					// E.g. 
					// original = 100
					// discount = 0.5
					// discounted value = 99.5
					// Rounded discounted value would be 100 and the rounded discount would be 1.
					if (typeof directionFor50 === 'undefined') {
						var directionFor50 = 'up';
					}
					
					try {
						if (typeof cents == 'string') {
							cents = cents.replace('.','');
						}

						var value = '';
						var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
						var formatString = format;

						function defaultOption(opt, def) {
							return (typeof opt == 'undefined' ? def : opt);
						}

						function formatWithDelimiters(number, precision, thousands, decimal, directionFor50) {

							precision 		= defaultOption(precision, 2);
							thousands 		= defaultOption(thousands, ',');
							decimal   		= defaultOption(decimal, '.');
							directionFor50  = defaultOption(directionFor50, 'up');

							if (isNaN(number) || number == null) {
								return 0;
							}

							var originalNumber = number;
							number = (number/100.0).toFixed(precision);
							
							if (directionFor50 === 'down') {
								if (((originalNumber/100) - number) === -0.5) {
									// We have rounded in the wrong direction
									// Subtract 1 to fix this
									number -= 1;
									number = number.toString();
								}
							}

							var parts 	= number.split('.'),
							dollars 	= parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
							cents   	= parts[1] ? (decimal + parts[1]) : '';

							return dollars + cents;
						}

						switch(formatString.match(placeholderRegex)[1]) {
							case 'amount':
							value = formatWithDelimiters(cents, 2);
							break;
							case 'amount_no_decimals':
							value = formatWithDelimiters(cents, 0, ',', '.', directionFor50);
							break;
							case 'amount_with_comma_separator':
							value = formatWithDelimiters(cents, 2, '.', ',');
							break;
							case 'amount_no_decimals_with_comma_separator':
							value = formatWithDelimiters(cents, 0, '.', ',', directionFor50);
							break;
							case 'amount_no_decimals_with_space_separator':
							value = formatWithDelimiters(cents, 0, ' ', ',', directionFor50);
							break;
							case 'amount_with_apostrophe_separator':
							value = formatWithDelimiters(cents, 2, "'", '.');
							break;
						}
					

						return formatString.replace(placeholderRegex, value);
						
					} catch(e) {
						bundlerConsole.log(e.message);
						
						price = cents/100;
						
						return price.toLocaleString(undefined, { style: 'currency', currency: fallbackCurrency });
					}
				},
				convertMoney: function(value, rate, currency, useRounding) {
					// Converts money and rounds up based on the defined policy
					if (value <= 0) {
						return 0;
					}
					
					if (typeof useRounding === 'undefined') {
						useRounding = true;
					}
					
										
										
					value *= rate;
					
					var roundUp = [
						'USD', 'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'GBP'
					];
					
					var roundTo100 = [
						'JPY',
						'KRW'
					];
					
					var roundTo95 = [
						'EUR'
					];
					
					if (useRounding) {
						if (roundUp.indexOf(currency) !== -1) {
							// Round up
							value = Math.ceil(value);						
						} else if(roundTo100.indexOf(currency) !== -1) {
							// Round to nearest 100
							value = Math.ceil(value/100)*100
						} else if(roundTo95.indexOf(currency) !== -1) {
							// Round up to 0.95
							value = Math.ceil(value) - 0.05;
						} else {
							// Basic rounding logic for other currencies
							value = Math.round(value);
						}
					} else {
						
						// We will round this in the reverse so that we match the rounding logic on server, where we change the price of the items and not the discounts :D XD 
						// This was created for postix-sticker-club
						var lessThanDecimals = value - Math.floor(value*100)/100;
						
						if (lessThanDecimals > 0.005) {
							// Round down 
							value = Math.floor(value*100)/100;
						} else {
							//value = Math.ceil(value*100)/100;
							value = Math.round(value*100)/100; // To revole the issue at stylish-hound-com where value of 110.00000000000001 was ceiled to 110.01
						}
					}
					
					return value;
				},
				// Loops through object and returns a comma separated list of desired values (1st level only).
				getListOfValues: function(object, key) {
					var list = '';
					for(var k in object) {
						if (object.hasOwnProperty(k)) {
							if (typeof object[k][key] !== 'undefined') {
								list += object[k][key]+',';
							}
						}
					}
					
					// Remove last comma
					list = list.replace(/,+$/, '');
					
					return list;
				},
				getCurrencySymbol: function(currency) {
					var symbol = '';
					try {
						symbol = (0).toLocaleString(
							undefined,
							{
							  style: 'currency',
							  currency: currency,
							  minimumFractionDigits: 0,
							  maximumFractionDigits: 0
							}
						  ).replace(/\d/g, '').trim();
					} catch(e) {
						
					}
				  
					if (symbol !== '') {
						return symbol;
					}
					
					return currency;
				},
				getPredefinedCurrencySymbol: function(currency) {
					var currencySymbols = {
						'USD': '$', // Dollar
						'AUD': '$', // Dollar
						'NZD': '$', // Dollar
						'EUR': '€', // Euro
						'CRC': '₡', // Costa Rican Colón
						'GBP': '£', // British Pound Sterling
						'ILS': '₪', // Israeli New Sheqel
						'INR': '₹', // Indian Rupee
						'JPY': '¥', // Japanese Yen
						'KRW': '₩', // South Korean Won
						'NGN': '₦', // Nigerian Naira
						'PHP': '₱', // Philippine Peso
						'PLN': 'zł', // Polish Zloty
						'PYG': '₲', // Paraguayan Guarani
						'THB': '฿', // Thai Baht
						'UAH': '₴', // Ukrainian Hryvnia
						'VND': '₫', // Vietnamese Dong
						'BRL': 'R$',
						'SEK': 'kr'
					};
					
					var symbol = '';
					
					if (typeof currencySymbols[currency] === 'string') {
						symbol = currencySymbols[currency];
					}
					
					return symbol;
				}
			};
			
			// This library contains basic get and set methods, so you can easily add products and get products from specific collection/library
function ProductsLib() {
	this._library = {};
};

ProductsLib.prototype.get = function(key) {
	if (typeof key === 'undefined') {
		return JSON.parse(JSON.stringify(this._library));		// Changed on 2023-11-14 otherwise the prepaid subscirption prices were updated and shown in the Mix & Match widget.
	} else if(typeof this._library[key] !== 'undefined') {
		return JSON.parse(JSON.stringify(this._library[key]));	// Changed on 2023-11-14 otherwise the prepaid subscirption prices were updated and shown in the Mix & Match widget.
	} else {
		return {};
	}
};

ProductsLib.prototype.isEmpty = function(key) {
	if (typeof key === 'undefined') {
		return true;
	} else if(typeof this._library[key] !== 'undefined') {
		return (Object.keys(this._library[key]).length == 0);
	} else {
		return true;
	}
};

ProductsLib.prototype.set = function(key, products) {
	this._library[key] = JSON.parse(JSON.stringify(products));
};

// This library contains original product information, discounted products and required products
// All changes to the products are directly reflected in these collections and methods should get products directly from the library.
// Products library contains data about products by id or by variant id (it depends). 
// Reqired products contains data about required products for bundles
// Discounted products contains data about actually discounted products in the bundles
var Library = {
	Products							: new ProductsLib(),
	RequiredProducts					: new ProductsLib(),
	DiscountedProducts					: new ProductsLib(),
	MixAndMatchBundles					: new ProductsLib(),
	SectionedBundlesProducts			: new ProductsLib(),
	SectionedBundlesProductsSelected	: new ProductsLib()
};			function ProductsTools() {};

// Fills the discountedProducts library and requiredProducts library with actual product data
ProductsTools.prototype.setLibraries = function(Library, bundleId) {

	// Set values for discounted products
	var discountedProducts = Library.DiscountedProducts.get();
	if (discountedProducts.hasOwnProperty(bundleId)) {
		var products = {};
		for (var productId in discountedProducts[bundleId]) {
			if (discountedProducts[bundleId].hasOwnProperty(productId)) {
				products[productId] = Library.Products.get(productId);
			}
		}
		Library.DiscountedProducts.set(bundleId, products);
	}
	
	// Set values for required products
	var requiredProducts = Library.RequiredProducts.get();
	if (requiredProducts.hasOwnProperty(bundleId)) {
		var products = {};
		for (var productId in requiredProducts[bundleId]) {
			if (requiredProducts[bundleId].hasOwnProperty(productId)) {
				products[productId] = Library.Products.get(productId);
			}
		}

		Library.RequiredProducts.set(bundleId, products);
	}


	// Set values for sectioned bundles
	var sectionedBundlesProducts = Library.SectionedBundlesProducts.get();
	if (sectionedBundlesProducts.hasOwnProperty(bundleId)) {
		var sections = [];
		for (var sectionId in sectionedBundlesProducts[bundleId]) {
			
			if (sectionedBundlesProducts[bundleId].hasOwnProperty(sectionId)) {
				var section = sectionedBundlesProducts[bundleId][sectionId];
				var sectionProducts = {};
				for (var productId in section) {
					if (section.hasOwnProperty(productId)) {
						sectionProducts[productId] = Library.Products.get(productId);
					}
				}
				
				sections.push(sectionProducts);
			}
		}

		Library.SectionedBundlesProducts.set(bundleId, sections);
	}
};

// Sets the linePrice and compareAtLinePrice to Required Products library
ProductsTools.prototype.setRequiredVariantLinePrices = function(Library, bundle) {	
	var requiredProducts = Library.RequiredProducts.get(bundle.id);
	
	for(var key in requiredProducts) {
		if (requiredProducts.hasOwnProperty(key)) {
			var productId = requiredProducts[key].product_id;

			if (typeof bundle.required_products[productId] !== 'undefined') {
				var quantity = bundle.required_products[productId].quantity;

				/*
				if (fromPOS) {
					quantity = requiredProducts[key].quantity;
				}
				*/
				
				for (var i = 0; i < requiredProducts[key].variants.length; i++) {
					var price 				= Tools.Price.getPrice(requiredProducts[key].variants[i].price)*quantity;
					var compareAtLinePrice 	= Tools.Price.priceOrZero(requiredProducts[key].variants[i].compare_at_price)*quantity;
					
					// Assign total original price with quantity
					requiredProducts[key].variants[i].linePrice		 			= price;
					requiredProducts[key].variants[i].compareAtLinePrice		= compareAtLinePrice;
					// Quantity which was used when calculating the discounted price
					requiredProducts[key].variants[i].discountedPriceQuantity	= quantity;
				}
			}
		}
	}
	
	Library.RequiredProducts.set(bundle.id, requiredProducts);
}


function PriceTools() {};
PriceTools.prototype.getPrice = function(price) {
	if (typeof price.indexOf === 'function' && price.indexOf('.') !== -1) {
		// Price has decimals in it
		// Multiply to get without decimals
		price = price * 100;
	}
	
	return price;
};

// This method will price or 0 if the price was undefined, null or ''
PriceTools.prototype.priceOrZero = function(price) {
	if (typeof price === 'undefined' || price === '' || price === null) {
		return 0;
	}
	
	return this.getPrice(price);
};

var Tools = {
	Products: new ProductsTools(),
	Price	: new PriceTools()
};			/*
function ProductRetrievalStatus() {
	this._products = {};
};

ProductRetrievalStatus.prototype.get = function(key) {
	if(typeof this._products[key] !== 'undefined') {
		return this._products[key];
	} else {
		return false;
	}
};

ProductRetrievalStatus.prototype.addCallback = function(key, callback) {
	if (typeof this._products[key] === 'undefined') {
		this._products[key] = {
			retrieved: false,
			callbacks: []
		};
	}
	
	this._products[key].callbacks.push(callback);
};

ProductRetrievalStatus.prototype.productWasRetrieved = function(key, id) {
	if (typeof this._products[key] === 'undefined') {
		this._products[key] = {
			retrieved: true,
			product_id: id,
			callbacks: []
		};
	}
	
	this._products[key]['product_id'] = id;
	
	for(var i = 0; i<this._products[key].callbacks.length; i++) {
		this._products[key].callbacks[i](id);
	}
};

var ProductRetrievalStatus = new ProductRetrievalStatus();
*/


var ProductRetrievalRequests 	= {};
var ProductRetrievalStatus 		= {};			
			var BndlrAnalytics = {
	init: function() {

				
		
			},
	// Track events
	track: function(what, productId, variantId, quantity) {

		if (what === 'addtocart') {
							if (typeof fbq === 'function') {
					try {
						var eventId = 'id_'+Date.now();
						fbq('track', 'AddToCart', {
							content_ids: [productId],
							content_type: 'product',
							contents: [{id: productId, quantity: parseInt(quantity, 10)}]
						}, {eventID: eventId});
					} catch(e) {
						console.log(e);
						// Something went wrong
					}
				}
						
						
			
					}
		
		if (what === 'initiateCheckout') {
			
					}
	}
};

BndlrAnalytics.init();

			
			var dbBundles = [{"id":449570,"name":"Distributor 5-Pack","title":"Buy in bulk and get a discount!","description":"Offer your clients Home Exercise Kits from your training space, save on bulk orders","button_text":"Add to cart","discount_warning":"Discounts will be applied at checkout.","discount_type":"percentage","percentage_value":"10","fixed_amount_value":"","fixed_price_value":"","priority":5,"status":"enabled","product_level":"product","total_price_text":"Total: {original_price} {discounted_price}","minimum_requirements":"volume_discounts","minimum_requirements_num":1,"minimum_requirements_n_max_products":null,"show_bundle":"true","bundle_image":"","list_product_names":"true","mix_and_match_display":"false","free_shipping":"false","is_volume_bundle":"true","product_target_type":"specific_products","volume_bundle_combine_quantites":"false","limit_for_customer_tags":[],"use_date_condition":"false","date_from":null,"date_to":null,"tags_additional_options":"","is_standalone_product_bundle":"false","volume_bundle_cart_value_use_all_products":"false","version":1,"products":{"13097982283":{"id":"13097982283","title":"Patient Pack: Head or Trunk Laser Kit","quantity":1,"discount_amount":0,"image":"","selling_plan_name":"","selling_plan_id":"","sequence":1,"required":0,"status":"active","variants":{"40836064378962":{"id":"40836064378962","title":"","quantity":1,"discount_amount":0,"selling_plan_name":"","selling_plan_id":"","sequence":1,"required":0,"was_deleted":0}},"handle":"head-and-trunk-home-visual-feedback-exercise-kit"}},"required_products":[],"volume_discounts":[{"min_items":5,"max_items":null,"discount_type":"percentage","discount_value":"35","range_type":"fixed_quantity","description":"Buy {{quantity}} and get a discount!","savings_text":"Save {{discount_value}}{{discount_unit}}!","free_shipping":"false","min_cart_value":null,"free_shipping_use_value_before_discounts":"false","counter":1}],"sections":[]}];
			var bundles = [];
			
			// Check if bundle is active based on it's schedule
			var currentDateTime = (new Date()).getTime();
			
			for(var z = 0; z < dbBundles.length; z++) {
				
				var enabledBundle = true;

				if (typeof dbBundles[z].use_date_condition !== 'undefined' && dbBundles[z].use_date_condition === 'true') {
					if (typeof dbBundles[z].date_from !== 'undefined' && dbBundles[z].date_from !== null && dbBundles[z].date_from.trim() !== '') {
						// We have an actual date set up here
						var fromDate = new Date(dbBundles[z].date_from);
						
						if (fromDate.getTime() > currentDateTime) {
							enabledBundle = false;
						}
					}
					
					if (typeof dbBundles[z].date_to !== 'undefined' && dbBundles[z].date_to !== null && dbBundles[z].date_to.trim() !== '') {
						// We have an actual date set up here
						var toDate = new Date(dbBundles[z].date_to);
						
						if (toDate.getTime() < currentDateTime) {
							enabledBundle = false;
						}
					}
				}
				
								
				if (enabledBundle === true) {
					bundles.push(dbBundles[z]);
				}
			}
			
			// Checks if the bundle is being displayed via preview, so that we know which bundleHTML should we use
			var displayBundleViaPreview = false;

			
			// If we are displaying the bundle via preview, use the preview bundle formatted in JSON
			if (displayBundleViaPreview) {
				var previewBundle = window.preview_bundle.bundle;
				bundles = [previewBundle];
			}
			
			// Change discount based on current currency exchange rate
			// It would be good to also get the defined rounding policy
			if (typeof Shopify !== 'undefined' && Shopify.hasOwnProperty('currency') && Shopify.currency.hasOwnProperty('rate')) {
				var rate = Shopify.currency.rate;
				var currency = Shopify.currency.active;
                var useRounding = true;
				
				if (rate !== "1.0") {

					for(var i = 0; i < bundles.length; i++) {

                        // Since in the discount function we cannot access a currency, but only a presentmentCurrencyRate, we will not use rounding rules in the case we have any V2 bundles
						if (bundles[i].version === 2) {
							useRounding = false;
						}

						// There is actually no need for this if
						if (bundles[i].discount_type === 'products_discounts' || bundles[i].discount_type === 'fixed_amount') {

							bundles[i].fixed_amount_value = utils.convertMoney(bundles[i].fixed_amount_value, rate, currency, useRounding);
						
							for(var pkey in bundles[i].products) {
								var product = bundles[i].products[pkey];
								product.discount_amount = utils.convertMoney(product.discount_amount, rate, currency, useRounding);
								
								for(var vkey in product.variants) {
									var variant = product.variants[vkey];
									variant.discount_amount = utils.convertMoney(variant.discount_amount, rate, currency, useRounding);
								}
							}
						} else if (bundles[i].discount_type === 'fixed_price') {
							bundles[i].fixed_price_value = utils.convertMoney(bundles[i].fixed_price_value, rate, currency, false); // Don't round fixed price bundles
							// There was an issue where the converted value (in CAD) was 0.99 cents higher than the actual final price in the checkout (bands-of-honor)
						}
						
						if (bundles[i].minimum_requirements === 'volume_discounts' && typeof bundles[i].volume_discounts !== 'undefined' && bundles[i].volume_discounts.length > 0) {
							for (var z = 0; z < bundles[i].volume_discounts.length; z++) {
								if (bundles[i].volume_discounts[z].discount_type === 'fixed_amount') {
									bundles[i].volume_discounts[z].discount_value = utils.convertMoney(bundles[i].volume_discounts[z].discount_value, rate, currency, useRounding);
								}
								
								if (bundles[i].volume_discounts[z].discount_type === 'fixed_price') {
									bundles[i].volume_discounts[z].discount_value = utils.convertMoney(bundles[i].volume_discounts[z].discount_value, rate, currency, false); // Changed the last parameter so we don't round it for nubianskin.myshopify.com on 2024-05-29.
								}
								
								if (bundles[i].volume_discounts[z].min_cart_value !== null && bundles[i].volume_discounts[z].min_cart_value*1 > 0) {
									bundles[i].volume_discounts[z].min_cart_value = utils.convertMoney(bundles[i].volume_discounts[z].min_cart_value, rate, currency, useRounding);
								}
							}
						}
						
						if (bundles[i].discount_type === 'products_discounts' && typeof bundles[i].sections !== 'undefined' && bundles[i].sections.length > 0) {
							
							for (var z = 0; z < bundles[i].sections.length; z++) {
								var section = bundles[i].sections[z];
								
								if (typeof section.products !== 'undefined') {
									for (var pkey in section.products) {
										var product = section.products[pkey];
										
										bundles[i].sections[z].products[pkey].discount_amount = utils.convertMoney(product.discount_amount, rate, currency, useRounding);
										
										for(var vkey in product.variants) {
											var variant = product.variants[vkey];
											
											bundles[i].sections[z].products[pkey].variants[vkey].discount_amount = utils.convertMoney(variant.discount_amount, rate, currency, useRounding);
										}
									}
								}
							}
						}
					}
				}
			}
			
			// WidgetView contains functions for direct manipulation with the HTML of the bundle widget
			var widgetView = {
								addToCartButton: {
					showCheckmark: function($button) {
						var htmlContent = $button.html();
						
						$button.html(htmlUtils.svgCheckmark);
						
						if ($button.closest('[data-bndlr-keep-success-indicator]').length === 0) {
							var timeout = 4000;
														
														
														
														
							setTimeout(function() {
								
								$button.find('.bndlr-checkmark').first().fadeOut(450, function() {
									$button.html(htmlContent);
								});
							}, timeout);
						}
					}
				},
				getBundleTitle: function(title, name, id) {
					var tagName = 'h2';
					
										
					var titleHtml = '<'+tagName+' class="bndlr-bundle-title">' + title + '</'+tagName+'>';
					
										
					return titleHtml;					
				},
				getBundleImage: function(imageSrc, title, name, id) {
					var imageHtml = '<img class="bndlr-bundle-image" src="'+imageSrc+'" />';
					
										
					return imageHtml;					
				},
				drawSelectedProducts: function(bundleKey, products) {
					
					//console.log('drawSelectedProducts', products);
					
					var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
					bundleId = parseInt(bundleId);
					
					var bundle = bndlr.getBundleById(bundleId);
					var discountedProducts = Library.DiscountedProducts.get(bundle.id);
					
					var html = '';
					var statusBoxProductsHtml = '';
					
					for(var key in products) {
						if (products.hasOwnProperty(key)) {
							var productId = products[key].product_id;
							var variantId = products[key].variant_id;
							
							var productData;
							if (bundle.product_level == 'product') {
								productData = discountedProducts[productId];
							} else {
								productData = discountedProducts[variantId];
							}
							
							var selectedProductHtml = bndlr.getSelectedProductHtml(products[key], productData, bundle, key);
							html += selectedProductHtml;
							
							var statusBoxProductHtml = bndlr.getStatusBoxProductHtml(products[key], productData, bundle);
							statusBoxProductsHtml += statusBoxProductHtml;
						}
					}
					
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-mnm-selected-products').html(html);
					$('#bndlr-mnm-status-box[data-bndlr-bundle-key="'+bundleKey+'"] .bdnlr-mnm-status-box-products-container').html(statusBoxProductsHtml);
				},
				MixNMatch: {
					hideAddtoBundleButtons: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-to-bundle').addClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-to-bundle-container .quantity-input').addClass('bndlr-hidden');
					},
					showAddtoBundleButtons: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-to-bundle-container .quantity-input').removeClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-to-bundle').removeClass('bndlr-hidden');
					},
					hideAddtoBundleButton: function(bundleKey, productId) {
						$('[data-bndlr-key="'+bundleKey+'"] [data-product-id="'+productId+'"] .bndlr-add-to-bundle').addClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"] [data-product-id="'+productId+'"] .bndlr-add-to-bundle-container .quantity-input').addClass('bndlr-hidden');
					},
					showAddtoBundleButton: function(bundleKey, productId) {
						$('[data-bndlr-key="'+bundleKey+'"] [data-product-id="'+productId+'"] .bndlr-add-to-bundle').removeClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"] [data-product-id="'+productId+'"] .bndlr-add-to-bundle-container .quantity-input').removeClass('bndlr-hidden');
					},
					fadeInSelectedProducts: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-toggle.bndlr-hidden').removeClass('bndlr-hidden');
					},
					fadeOutSelectedProducts: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-toggle').addClass('bndlr-hidden');
					},
					fadeInAddToCartButton: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-to-cart-container.bndlr-hidden').removeClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-bundle-to-cart.bndlr-hidden').removeClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-mnm-total-price.bndlr-hidden').removeClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-bundle-checkout-warning.bndlr-hidden').removeClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.sealsubs-target-element-bundle').css({'display':'block'});
						
						$('#bndlr-mnm-status-box[data-bndlr-bundle-key="'+bundleKey+'"]').find('.bndlr-status-box-add-to-cart.bndlr-hidden').removeClass('bndlr-hidden');
						
					},
					fadeOutAddToCartButton: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-to-cart-container').addClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-bundle-to-cart').addClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-mnm-total-price').addClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-bundle-checkout-warning').addClass('bndlr-hidden');
						$('[data-bndlr-key="'+bundleKey+'"]').find('.sealsubs-target-element-bundle').css({'display':'none'});
						
						$('#bndlr-mnm-status-box[data-bndlr-bundle-key="'+bundleKey+'"]').find('.bndlr-status-box-add-to-cart').addClass('bndlr-hidden');
						
						
					},
					fadeInTieredMnMInstructions: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-tiered-mnm-instructions-text.bndlr-hidden').removeClass('bndlr-hidden');
					},
					fadeOutTieredMnMInstructions: function(bundleKey) {
						$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-tiered-mnm-instructions-text').addClass('bndlr-hidden');
					}
				},
				Sectioned: {
					drawSelectedProducts: function(bundleKey, sections) {
						
						var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
						bundleId = parseInt(bundleId);
						
						var bundle 						= bndlr.getBundleById(bundleId);
						var sectionsDiscountedProducts 	= Library.SectionedBundlesProducts.get(bundle.id);
	
						
						// Sections is an object, not an array.
						for (var x in sections) {
							if (sections.hasOwnProperty(x)) {
								var html = '';

								for(var key in sections[x]) {
									if (sections[x].hasOwnProperty(key)) {
										var productId = sections[x][key].product_id;
										var variantId = sections[x][key].variant_id;
										
										var productData;
										if (bundle.product_level == 'product') {
											productData = sectionsDiscountedProducts[x][productId];
										} else {
											productData = sectionsDiscountedProducts[x][variantId];
										}
										
										var selectedProductHtml = bndlr.getSectionedBundleSelectedProductHtml(sections[x][key], productData, bundle, key, x);
										html += selectedProductHtml;
									}
								}
								
								$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sectioned-section-status[data-bundler-section-status="'+x+'"] .bndlr-sectioned-section-products').html(html);
							}
						}
					},
				}
			};
			
			var htmlUtils = {
				moneySpan: function(value, currency, classes, customAttribute, numericValue, screenReaderText) {
					var valueNoHtml = value.replace(/(<([^>]+)>)/gi, "");
					if (typeof customAttribute !== 'string') {
						customAttribute = '';
					}
					
					if (typeof screenReaderText === 'undefined') {
						var screenReaderText= '';
					}
					
					valueNoHtml = valueNoHtml.replace(/\"/g, "&quot;").replace(/\'/g, "&apos;");
					
										
					var moneyClass = ' money ';
										
										
										
					var screenReaderSpan = '';
					if (screenReaderText !== '') {
						screenReaderSpan = '<span class="sr-only bndlr-sr-only">' + screenReaderText + '</span>';
					}
					
										
										if (typeof numericValue !== 'undefined') {
						return '<span class="'+classes+' bndlr-money conversion-bear-money notranslate ht-money '+moneyClass+' gt_currency gt_currency--'+currency+'" '+customAttribute+' data-money-convertible data-currency-'+currency+'="'+valueNoHtml+'" data-currentprice="'+numericValue+'">'+screenReaderSpan+value+'</span>';
					} else {
						return '<span class="'+classes+' bndlr-money conversion-bear-money notranslate ht-money '+moneyClass+'" '+customAttribute+' data-money-convertible data-currency-'+currency+'="'+valueNoHtml+'">'+screenReaderSpan+value+'</span>';
					}
					
				},
				svgCheckmark: '<svg class="bndlr-checkmark" role="img" aria-label="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="-5 -2 40 40"><path fill="none" d="M4.1 18.2 l7.1 7.2 l16.7-16.8" /></svg>',
				svgCheckmarkPreselected: '<svg class="bndlr-preselected-checkmark" role="img" aria-label="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="-5 -2 40 40"><path fill="none" d="M4.1 18.2 l7.1 7.2 l16.7-16.8" /></svg>'
			};
			
						
			if (typeof clientSpecifics === 'undefined') {
				// This will contain a list of all client specific functions
				var clientSpecifics = {};
			}
						// Observer mutations and trigger local event when a cart change is detected.
// A cart change can be:
// - something changes in the cart drawer dynamically

function cartChangeDetectorFunction() {
	this.mutationsInProgress 			= 0;
	this.dispatchCartDrawerEventTimeout = false;
};

cartChangeDetectorFunction.prototype.beforeMutation = function() {
	this.mutationsInProgress++;
}

cartChangeDetectorFunction.prototype.afterMutation = function() {
	var self = this;
	setTimeout(function() {
		// Delay the decrease of the counter to allow changes to propagate through mutation observers
		self.mutationsInProgress--;
	}, 100);
}

cartChangeDetectorFunction.prototype.getMutationsInProgress = function() {
	return this.mutationsInProgress;
}

cartChangeDetectorFunction.prototype.observeCart = function() {
	try {
		// Create observer for cart drawer
		var self = this;
		var callback = function(mutationsList, observer) {

			if (self.getMutationsInProgress() === 0) {

				if (typeof self.dispatchCartDrawerEventTimeout !== 'undefined') {
					clearTimeout(self.dispatchCartDrawerEventTimeout);
				}
				
				self.dispatchCartDrawerEventTimeout = setTimeout(function() {
					var event = new Event('bndlr:cart_drawer_mutation');
					// Dispatch the event.
					window.dispatchEvent(event);
				}, 90);
			}
		};

		var observer = new MutationObserver(callback);

		// list of cart drawer selectors (they are found with jQuery).
		// we could just watch the cart total values though
		var cartDrawersList = [
			'#ajaxifyMini',
			'#CartDrawer .drawer__inner', // if you observe the normal drawer, the fera countdown can cause the app to constantly check for discount
			'#ajaxifyModal #ajaxifyCart',
			'#qikify-stickycart-app',
			'.sp-cart .sp-dropdown-menu .sp-dropdown-inner .sp-cart-layout',
			'#CartDrawer #CartContainer',
			'#sidebar-cart',
			'#cartSlideoutWrapper',
			'div.right-drawer-vue',
			'#theme-ajax-cart .ajax-cart--mini-cart',
			'.off-canvas--container .cart--root',
			'#cartSidebar',
			'.top-cart-holder .cart-target',
			'.go-cart__drawer.js-go-cart-drawer .go-cart-drawer',
			'.cart-mini .cart-mini-sidebar',
			'#slidedown-cart',
			'#slideout-ajax-cart #mini-cart',
			'#shopify-section-mini-cart #mini-cart',
			'#cart-popup',
			'#cart-drawer',
			'.icart',
			'.cart-drawer[data-cart-drawer]',
			'#shopify-section-cartDrawer',
			'#preact-full-cart',
			'#mini-cart .mini-cart__footer',
			'#mini-cart footer',
			'#offcanvas-cart',
			'.sidebar-drawer-container[data-sidebar-drawer-container]',
			'cart-drawer#CartDrawer',
			'.hs-site-cart-popup-layout',
			'#CartPopup',
			'#Cart-Drawer',
			'#AjaxCartSubtotal',
			'#kaktusc-app',
			'aside#cart',
			'#qikify-stickycart-v2-app'
			//'#CartDrawer .drawer__footer'
			//'#monster-cart-wrapper'
			//'#monster-upsell-cart'
			//'#Cart.cart-container.open'
		];
		
				
				
				
				
				
		
				
				
		// loop through cart drawers and set the observers
		for(var i = 0; i<cartDrawersList.length; i++) {
			if ($(cartDrawersList[i]).length) {
				observer.observe($(cartDrawersList[i])[0], {attributes: true, childList: true, subtree: true});
			}
		}
		
	} catch(e) {
		console.log(e);
	}
}
	
var cartChangeDetector = new cartChangeDetectorFunction();
cartChangeDetector.observeCart();
cartChangeDetectorFunction.prototype.hookToAddToCartEvent = function() {

	(function(open) {
		XMLHttpRequest.prototype.open = function() {
			var rurl = '';
			if (typeof arguments[1] === 'string' && arguments[1].length > 0) {
				rurl = arguments[1];
				
				this.addEventListener('load', function() {
					try  {
						if (typeof rurl === 'string' && rurl.length > 0) {
							handleAddToCart(rurl, this.response);
						}
					} catch (t) {
						console && console.warn && console.warn('[Bundler cart event listener] Error in handleXhrDone:  ' + t.message)
					}
				})
			}
			return open.apply(this, arguments);
		}
		
		function handleAddToCart(url, data) {

			var types = [
				'/cart/update.js',
				'/cart/change.js',
				'/cart/change.json',
				'/cart/change',
				'/cart/add.js',
				'/cart/add.json',
				'/cart/add',
				'/cart?view=ajax',
				'/cart?view=json',
				'section_id=cart-drawer',
				'section_id=api-cart-items',
				'section_id=mini-cart'
			];
			
			
			
						
			

			for(var i = 0; i<types.length; i++) {
				if (url.indexOf(types[i]) !== -1 && url.indexOf('bundler-cart-call') === -1) {
					var event = new CustomEvent('bndlr:cart_was_modified');
					// Dispatch the event.
					document.dispatchEvent(event);
					// Stop the loop
					i = types.length;
				}
			}
			
			var exactMatch = [
				'/cart'
			];
			
			for(var i = 0; i<exactMatch.length; i++) {
				if (url == exactMatch[i] && url.indexOf('bundler-cart-call') === -1) {
					var event = new CustomEvent('bndlr:cart_was_modified');
					// Dispatch the event.
					document.dispatchEvent(event);
					// Stop the loop
					i = types.length;
				}
			}
		}
		
	})(XMLHttpRequest.prototype.open);

	(function(w) {
		if (typeof w.fetch === 'function') {
			try {
				// Override the fetch function to listen for cart refresh actions
				var oldFetch = w.fetch;  // must be on the global scope
				w.fetch = function() {
					var promise = oldFetch.apply(this, arguments);
					try  {

						if (typeof arguments[0] === 'string' && arguments[0].length > 0) {
							var rurl = arguments[0];
							promise.then(function(data) {
								try  {
									if (typeof rurl === 'string' && rurl.length > 0) {
										handleAddToCart(rurl, data);
									}
								} catch (t) {
									console && console.warn && console.warn('[Bundler cart event listener] Error in fetch:  ' + t.message)
								}
							});
						}
					} catch(e) {
						console.error(e);
					}
					// Return the promise
					return promise;
				}
			} catch(e) {
				console.log(e);
			}
		}
		
		function handleAddToCart(url, data) {

			var types = [
				'/cart/update.js',
				'/cart/change.js',
				'/cart/change.json',
				'/cart/change',
				'/cart/add.js',
				'/cart/add.json',
				'/cart/add',
				'/cart?view=ajax',
				'/cart?view=json',
				'section_id=cart-drawer',
				'section_id=api-cart-items',
				'section_id=cart-helper',
				'section_id=mini-cart'
			];
			
						
			

			for(var i = 0; i<types.length; i++) {
				if (url.indexOf(types[i]) !== -1 && url.indexOf('bundler-cart-call') === -1) {
					var event = new CustomEvent('bndlr:cart_was_modified');
					// Dispatch the event.
					document.dispatchEvent(event);
					
					// Stop the loop
					i = types.length;
				}
			}
			
			var regexMatch = [
				'/cart\\?t=\\d+&view=ajax'
			];
			
			for(var i = 0; i<regexMatch.length; i++) {
				try {
					var reg = new RegExp(regexMatch[i]);
					var found = url.match(reg);
					if (found !== null && found.length > 0 && url.indexOf('bundler-cart-call') === -1) {
						var event = new CustomEvent('bndlr:cart_was_modified');
						// Dispatch the event.
						document.dispatchEvent(event);
						
						// Stop the loop
						i = types.length;
					}
				} catch(e) {}
			}
			
			// paragraph.match(regex) // new RegExp(hide_on_urls[houi])
		}
		
	})(window);
};

if (typeof cartChangeDetector !== 'undefined') {
	cartChangeDetector.hookToAddToCartEvent();
}			
			var bndlr = {
				outputBundles: function() {
					bundlerConsole.log(JSON.parse(JSON.stringify(bundles)));
				},
				getBundles: function() {
					return JSON.parse(JSON.stringify(bundles));
				},
				outputProductUrls: function() {
					var urls = [];
					
					for(var i = 0; i<bundles.length; i++) {
						for (var key in bundles[i].products) {
							if (bundles[i].products.hasOwnProperty(key)) {
								urls.push(nav.getRootUrl(true)+'products/'+encodeURIComponent(bundles[i].products[key].handle));
							}
						}
						
						
						if (typeof bundles[i].sections !== 'undefined' && bundles[i].sections.length > 0) {
							for (var k in bundles[i].sections) {
								if (bundles[i].sections.hasOwnProperty(k)) {
									for (var key in bundles[i].sections[k].products) {
										if (bundles[i].sections[k].products.hasOwnProperty(key)) {
											urls.push(nav.getRootUrl(true)+'products/'+encodeURIComponent(bundles[i].sections[k].products[key].handle));
										}
									}
								}
							}
						}
					}
					
					bundlerConsole.log(JSON.parse(JSON.stringify(urls)));
				},
				getProductUrls: function() {
					var urls = [];
					
					for(var i = 0; i<bundles.length; i++) {
						for (var key in bundles[i].products) {
							if (bundles[i].products.hasOwnProperty(key)) {
								urls.push(nav.getRootUrl(true)+'products/'+bundles[i].products[key].handle);
							}
						}
					}
					return JSON.parse(JSON.stringify(urls));
				},
				fixCartPrices: function(cartData) {
		
					if (typeof cartData.currency !== 'undefined' && cartData.currency === 'JPY' && typeof cartData.currencyWasFixed === 'undefined') {
						// Fix cart data
						
						for(var z = 0; z < cartData.items.length; z++) {

							cartData.items[z].price 				= cartData.items[z].price*100;
							cartData.items[z].original_price 		= cartData.items[z].original_price*100;
							cartData.items[z].presentment_price 	= cartData.items[z].presentment_price*100;
							cartData.items[z].discounted_price 		= cartData.items[z].discounted_price*100;
							cartData.items[z].line_price 			= cartData.items[z].line_price*100;
							cartData.items[z].original_line_price 	= cartData.items[z].original_line_price*100;
							cartData.items[z].total_discount 		= cartData.items[z].total_discount*100;

							cartData.items[z].final_price 		= cartData.items[z].final_price*100;
							cartData.items[z].final_line_price 	= cartData.items[z].final_line_price*100;
							
						}
						
						cartData.items_subtotal_price 	= cartData.items_subtotal_price*100;
						cartData.original_total_price 	= cartData.original_total_price*100;
						cartData.total_price 			= cartData.total_price*100;
						cartData.total_discount 		= cartData.total_discount*100;
						
						cartData.currencyWasFixed = true;
					}
					
					return cartData;
				},
								// When set to false, the clicks on checkout buttons will go straight to normal checkout
				useBundlerCheckout: true,
				// Checkout params is an object with additional GET parameters which will be appended to the checkout URL to pre-fill the checkout form
				checkoutParams: {},
				// Public method, used for setting checkout parameters by other apps
				setCheckoutParams: function(params) {
					if (Object.keys(params).length > 0) {
						bndlr.checkoutParams = params;
					}
				},
				// Public method, used for preventing the Bundler from going to the checkout
				preventBundlerCheckout: function() {
					bndlr.externalAppPreventCheckout.prevent = true;
					bundlerConsole.log('Third party requested prevention of Bundler checkout');
				},
				enableBundlerCheckout: function() {
					bndlr.externalAppPreventCheckout.prevent = false;
					bundlerConsole.log('Third party enabled Bundler checkout');
				},
				// Object, used for storing configuration and logic for checkout prevention by external apps
				externalAppPreventCheckout: {
					prevent: false,
					counter: 0,
					canCheckout: function() {
						// If external app required a checkout prevention and the checkout was never prevented before, return false.
						// Otherwise, allow Bundler checkout logic to proceed
						/*
						if (this.prevent && this.counter < 30) {
							this.counter++;
							return false;
						}
						*/
												if (typeof clientSpecifics['can_checkout'] !== 'undefined') {
							var canCheckout = clientSpecifics['can_checkout'].get();
							if (canCheckout === false) {
								return false;
							}
						}
						
						try {
							if (typeof window.PARCELY_APP !== 'undefined' && typeof window.PARCELY_APP.readyForCheckout === 'boolean') {
								if (window.PARCELY_APP.readyForCheckout === false) {
									return false;
								}
							}
						} catch(e) {
							console.log(e.message);
						}
						
												
						
												
						if (this.prevent) {
							return false;
						}
						
						return true;
					}
				},
				addCheckoutParams: function(url, excludedKeys) {
					if (typeof excludedKeys === 'undefined') {
						excludedKeys = [];
					}
					
					var locale = this.getLocale();

					if (locale !== '' && typeof this.checkoutParams['locale'] === 'undefined') {
						this.checkoutParams['locale'] = locale;
					}
					
					/*
					var country = this.getCountry();
					if (country !== '' && typeof this.checkoutParams['checkout[shipping_address][country_code]'] === 'undefined') {
						this.checkoutParams['checkout[shipping_address][country_code]'] = country;
					}
					*/
					
					//console.log('checkoutParams', this.checkoutParams);
					
					
										
					if (Object.keys(this.checkoutParams).length > 0) {
						// Add checkout params
						if (url.indexOf('?') === -1) {
							url += '?';
						} else {
							url += '&';
						}
						
						for (var key in this.checkoutParams) {
							if (this.checkoutParams.hasOwnProperty(key) && excludedKeys.indexOf(key) === -1) {
								var param = this.checkoutParams[key];
								if (param !== null && param.indexOf('&') !== -1) {
									param = encodeURIComponent(param);
								}
								
								url += key + '=' + param + '&';
							}
						}
						url = url.replace(/\&$/, '');
					}
					
					return url;
				},
				getCountry: function() {
					var country = '';
					if (typeof Shopify !== 'undefined' && Shopify.hasOwnProperty('country') && typeof Shopify.country === 'string') {
						country = Shopify.country;
					}
					
					return country;
				},
				getLocale: function() {
																	try {
							if (typeof Weglot !== 'undefined' && typeof Weglot.getCurrentLang === 'function') {
								var lang = Weglot.getCurrentLang();
								if (typeof lang !== 'undefined' && lang !== null && lang !== '') {
									return lang;
								}
							}
						} catch(e) {}
					
										
					if (typeof Shopify !== 'undefined' && typeof Shopify.locale === 'string') {
						return Shopify.locale
					}
					
					return '';
				},
								init: function() {

											if (typeof window.bndlrPOS === 'undefined' && nav.isShopPage() === false) {
							console.warn('Bundler: You have to upgrade Bundler if you want to display widgets on third party pages');
							return false;
						}
										
					var self = this;
					// Checkout selectors
					var checkoutSelector = "input[type='submit'][name='checkout']:not(.productForm-submit), button[type='submit'][name='checkout']:not(.productForm-submit):not([disabled]), button.checkout-button[name='checkout'], form.cart-form a.btn-checkout, a[href='/checkout'], #dropdown-cart button.btn-checkout, .cart-popup-content a.btn-checkout, .cart__popup a.checkout-button, .widget_shopping_cart_content a[href='/checkout'], .jas_cart_page button.checkout-button, .mini-cart-info button.mini-cart-button, a.checkout-link, a.mini-cart-checkout-button, .shopping_cart_footer .actions button";
					checkoutSelector += ', #dropdown-cart button.btn[onclick="window.location=\'/checkout\'"], form[action="/cart"] button[name="checkout"], .bundler-checkout-button, input.action_button[type="submit"][value="Checkout"]';
					checkoutSelector += ', button.Cart__Checkout[type="submit"][name="checkout"] span';
					checkoutSelector += ', .popup-cart a[href^="/checkout"], #slidecarthq .footer button.button';
					checkoutSelector += ', button.cart__checkout-cta, button.sidecart__checkout-cta';
					checkoutSelector += ', button.bc-atc-slide-checkout-btn';
					checkoutSelector += ', #ajax-cart__content .ajax-cart__button.button--add-to-cart';
					checkoutSelector += ', .cart_container form.js-cart_content__form button.add_to_cart.action_button';
					checkoutSelector += ', .cart_container .js-cart_content__form input.action_button[type="submit"]';
					checkoutSelector += ', #checkout_shipping_continue_btn';
					checkoutSelector += ', .spurit-occ2-checkout a[name="checkout"][href="/checkout/"]';
					checkoutSelector += ', #checkout-button';
					checkoutSelector += ', button.btn-checkout';
					checkoutSelector += ', button.rebuy-cart__checkout-button'; // Changed from button.rebuy-button on 2022-11-09
					checkoutSelector += ', .go-cart__button[href*="/checkout/"],  .go-cart__button[href*="/checkout?"]';
					checkoutSelector += ', a[href*="/checkout/"]:not([href*="/a/bundles/checkout/"]):not([href*="/subscriptions/"]):not([href*="/tools/recurring/checkout_link"]), a[href*="/checkout?"]:not([href*="partial.ly"]):not([href*="/tools/recurring/checkout_link"])';
					checkoutSelector += ', input.cart--button-checkout, a.satcb-cs-checkout-btn';
					checkoutSelector += ', button#parcelySubmit[data-cart-submit]';
					checkoutSelector += ', #checkout[type="submit"][name="checkout"], #checkout[type="submit"][name="checkout"] .custom-cobutton';
					checkoutSelector += ', a[href*="/checkout"]:not([href*="/a/bundles/checkout/"]):not([href*="/subscriptions/"]):not([href*="partial.ly"]):not([href^="https://checkout"]):not([href*="/tools/recurring/checkout_link"])';
					checkoutSelector += ', .rebuy-cart__flyout-footer .rebuy-cart__flyout-subtotal + .rebuy-cart__flyout-actions > button.rebuy-button:first-child, .rebuy-cart__flyout-footer .rebuy-cart__flyout-subtotal + .rebuy-cart__flyout-actions > button.rebuy-button:first-child span';
					checkoutSelector += ', .rebuy-cart__checkout-button, .rebuy-cart__checkout-button span, rebuy-cart__checkout-button span i';
					checkoutSelector += ', .quick-cart__buy-now[data-buy-now-button], .icart-checkout-btn, .icartCheckoutBtn';
					checkoutSelector += ', button.cart__checkout, button[type="submit"][form="mini-cart-form"]';
					checkoutSelector += ', button[type="submit"][form="mini-cart-form"] span, button[type="submit"][form="mini-cart-form"] span svg';
					checkoutSelector += ', .SideCart__footer button[type="submit"]';
					checkoutSelector += ', div[onclick="clicktocheckoutnormal()"], div[onclick="clicktocheckout()"]';
					checkoutSelector += ', .mini-cart__actions .mini-cart__checkout, .mini-cart__actions .mini-cart__checkout *';
					checkoutSelector += ', button.checkout-button[onclick="window.location=\'/checkout\'"]';
					checkoutSelector += ', [data-ocu-checkout="true"]';
					checkoutSelector += ', input[type="submit"][name="checkout"].cart__submit';
					checkoutSelector += ', [data-ocu-checkout="true"], .btncheckout';
					checkoutSelector += ', form[action="/cart"][method="post"] button[type="submit"]:not([name*="update"]):not([name*="add"])';
					checkoutSelector += ', a.js-checkout, #mu-checkout-button';
					checkoutSelector += ', #cart-sidebar-checkout:not([disabled="disabled"]), .checkout-x-buy-now-btn, .checkout-x-buy-now-btn .hs-add--to--cart, .slider-cart-checkout-btn';
					checkoutSelector += ', button[onclick="window.location=\'/checkout\'"], .ymq-fake-checkout-btn, button.StickyCheckout__button';
					checkoutSelector += ', input[type="submit"][name="checkout"], a.checkout-button';
					checkoutSelector += ', .hs-content-checkout-button, .hs-content-checkout-button .hs-add--to--cart, .hs-content-checkout-button .hs-checkout-purchase';
					checkoutSelector += ', button.cart__checkout-button, button.cart__checkout-button .loader-button__text, button.cart__checkout-button .loader-button__loader, button.cart__checkout-button .loader-button__loader div, button.cart__checkout-button .loader-button__loader div svg';
					checkoutSelector += ', .cd-cart-checkout-button';
					checkoutSelector += ', .sezzle-checkout-button, .sezzle-checkout-button .sezzle-button-logo-img';
					checkoutSelector += ', .Cart__Footer .Cart__Checkout, .cart--checkout-button button, .cart--checkout-button button span, button.js-process-checkout';
					checkoutSelector += ', .j2t-checkout-link, .j2t-checkout-link span, #cart-checkout, #cart-notification-form button[name="checkout"]';
					checkoutSelector += ', .zecpe-btn-checkout, .zecpe-btn-checkout span, .mbcOverlayOnCheckout, #checkoutCustom, #wsg-checkout-one';
					checkoutSelector += ', .icart-chk-btn, .side-cart__checkout button#sideCartButton'; // glow-skinco
					checkoutSelector += ', .cart__checkout-button, #actionsArea button[onclick="startCheckoutEvent()"], button.cart--button-checkout, .kaktusc-cart__checkout, .cart__checkout';
					checkoutSelector += ', #cartform_bottom #actionsArea button, hh-button[href="/checkout"]';
					checkoutSelector += ', .cart-drawer--checkout-button button, .scd__checkout, button.scd__checkout span, #cart-summary button[data-cart-submit], .sf-cart__submit-controls button, .sf-cart__submit-controls button span';
					checkoutSelector += ', .upcart-checkout-button, .upcart-checkout-button span, .cart-button-checkout, .cart-button-checkout span';
					checkoutSelector += ', a.primary-button[href="/pages/pro-checkout-redirect"], #cart-summary button[name="checkout"], #AjaxCartSubtotal button[name="checkout"], #AjaxCartSubtotal button[name="checkout"] span';
					checkoutSelector += ', .cart-ajax__checkout-btn, div.button_checkout, .qsc2-checkout-button, .upcart-checkout-button, form[action="/checkout"] button[type="submit"].btn-order, #cart [onclick="submitAtc(event)"][type="button"]';
					checkoutSelector += ', #submitButton[name="checkout"], .Cart__Checkout, .Cart__Checkout span, .cart-checkout-btn, form[action="/checkout"] button[type="submit"]';
					checkoutSelector += ', .vanga-cart__proceed button, .vanga-cart__proceed button div, .vanga-cart__proceed button div span';
					checkoutSelector += ', button#checkout[name="checkout"], shopping-cart [name="checkout"][type="submit"], .opus-btn-checkout .cd-checkout-section-button *'; // solution for joshua-tree-au
					checkoutSelector += ', [data-target="checkout-buttons-container"] [data-target="coverage-button"] *, redo-shopify-toggle'; // solution for no-14-pittsburgh
					//checkoutSelector += ', .ocu-checkout-button, .ocu-checkout-button *'; // solution for24k9
										// .template-cart .alertify .ajs-button.positive
																				
										
										
										
										
										
										
										
										
										
										
					
										
					//$(document).ready(function() {
					// Commented that on 2020-12-09 because it created the bundler_bundle_widget_created event listener too late

					var $document = $(document);
					var $body = $('body');

					$(checkoutSelector).on('click', function (e) {

						if (bndlr.useBundlerCheckout && bndlr.externalAppPreventCheckout.canCheckout()) {
							
														
							e.preventDefault();
							e.stopPropagation();
							$(this).addClass('bndlr-checkout-button-clicked');
							self.prepareInvoice();
						}
					});
					
					$document.on('click', checkoutSelector, function (e) {

						if (bndlr.useBundlerCheckout && bndlr.externalAppPreventCheckout.canCheckout()) {
							
														
							e.preventDefault();
							e.stopPropagation();
							$(this).addClass('bndlr-checkout-button-clicked');
							self.prepareInvoice();
						}
					});
					
										
					$document.on('click', '.bndlr-message-yes', function() {
						$(this).addClass('bndlr-loading');
						self.prepareInvoice();
					});
					
										
					$document.on('bundler_trigger_normal_checkout', function() {
						
						bndlr.useBundlerCheckout = false;
						var cartSelector = 'form[action="/cart"][method="post"], form.cart[action="/cart"][method="post"], form.cart[method="post"], #cart form';
						var clickWasHandled = false;
						
						var tryToClickOnTheSameButton = true;
						if (typeof window.PARCELY_APP !== 'undefined') {
							// The Parcely app uses Vuejs for click handling, which only processes trusted events (e.isTrusted).
							tryToClickOnTheSameButton = false;
						}
						
						var canUseSealCheckout = false;
						if (typeof window.SealSubs !== 'undefined' && typeof window.SealSubs.discounts_apply_on_initial_order === 'boolean' && typeof window.SealSubs.checkout === 'function' && SealSubs.discounts_apply_on_initial_order) {
							canUseSealCheckout = true;
						}
						
						var pageIsUnloading = false;
													addEventListener('beforeunload', (event) => {
								pageIsUnloading = true;
							});
												
						
						
						if (tryToClickOnTheSameButton === true) {
							var $clickedButton = $('.bndlr-checkout-button-clicked');
							
							if ($clickedButton.length >= 1) {

								// Try to first trigger the click on the same element as the user previously clicked
								if ($clickedButton.prop('tagName') !== 'A') {
									// The problem is that the jQuery click event can't trigger the navigation on a elements.
									clickWasHandled = true;
									if ($clickedButton.is('[disabled]')) {
										// remove disabled attribute, otherwise the click won't get recognized (miasma-records)
										$clickedButton.removeAttr('disabled');
									}
									try {
										// Changed from $clickedButton.click() to $clickedButton[0].click() on 2024-03-12
										$clickedButton[0].click();
									} catch(e) {
										// Something went wrong. It could be that the script listening to the event wanted tohave the originalEvent passed in the click
										// Mark click as not handled, so that we go into the fallback logic.
										clickWasHandled = false;
										
										console.error(e);
									}
									
																												if (!canUseSealCheckout) {
																						setTimeout(function() {
												
												if (pageIsUnloading === false) {
													// Fallback to redirect if nothing happens in 1 second. 
																										//console.log('asdadasd', bndlr.addCheckoutParams('/checkout'));
													window.location.href = bndlr.addCheckoutParams('/checkout');
												} else {
													//console.log('page is already being unloaded 1');
												}
											}, 1000);
										}
																	} else {
																	}
							} else if ($(cartSelector).find(checkoutSelector).length) {
								clickWasHandled = true;
								$(cartSelector).find(checkoutSelector).first().click();
							}
						}
						
						if (clickWasHandled !== true) {
							if (canUseSealCheckout) {
								if (window.SealSubs.checkout()) {
									clickWasHandled = true;
								}
							}
						}
						
						if (clickWasHandled !== true) {
							window.location.href = bndlr.addCheckoutParams('/checkout');
						} else {

							if (!canUseSealCheckout) {
								// We aren't applying the discounts from sealsubs
							
																																		setTimeout(function() {
										if (pageIsUnloading === false) {
											// Fallback to redirect if nothing happens in 1 second
																						window.location.href = bndlr.addCheckoutParams('/checkout');
										} else {
											//console.log('page is already being unloaded 2');
										}
									}, 1000);
															}
						}
					});
					
					$document.on('click', '.bndlr-message-close', function() {
													bndlr.setCookie('bndlr_hide_discount_message', 'hide', 0.003472222); // Hide popup for 5 minutes
												self.closeMessage();
					});
					
					$document.on('click', '.bndlr-message-no', function() {
												self.closeMessage();
					});

					$document.on('click', '.bndlr-add-to-cart', function() {
						bndlr.addToCart($(this));
					});
					$document.on('keydown', '.bndlr-add-to-cart', function(e) {
						if(e.which == 13) { // Enter
							bndlr.addToCart($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.addToCart($(this));
						}
					});
					
					$document.on('change', '.bndlr-select-variant', function() {
						// Added an idleCallback because of slow performance in 11ice when the app separates the variant options in separate dropdowns
						var $this = $(this);
						idleCallback(function() {
							bndlr.updatePriceDisplay($this);
						});
						
						idleCallback(function() {
							bndlr.changeDisplayedImage($this);
						});
						
						idleCallback(function() {
							bndlr.convertCurrency();
						});
						
						//bndlr.updatePriceDisplay($(this));
						//bndlr.changeDisplayedImage($(this));
						//bndlr.convertCurrency();
					});
					
					$document.on('show_bundle', 'body', function (e, $el) {
						self.showBundleOnElementWithHandle($el);
											});
					
										
					// Start of MixNMatch listeners
					$document.on('click', '.bndlr-add-to-bundle', function() {
						bndlr.MixNMatch.addToBundle($(this));
					});
					$document.on('keydown', '.bndlr-add-to-bundle', function(e) {
						if(e.which == 13) { // Enter
							bndlr.MixNMatch.addToBundle($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.MixNMatch.addToBundle($(this));
						}
					});
					
					$document.on('click', '.bndlr-add-bundle-to-cart', function() {
						// Bundle add to cart button was clicked in the widget
						// Add bundle to the cart. The app knows which bundle to add to the cart based on the $(this) parameter.
						bndlr.MixNMatch.addMixAndMatchBundleToCart($(this));
					});
					$document.on('keydown', '.bndlr-add-bundle-to-cart', function(e) {
						if(e.which == 13) { // Enter
							bndlr.MixNMatch.addMixAndMatchBundleToCart($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.MixNMatch.addMixAndMatchBundleToCart($(this));
						}
					});

					
					$document.on('click', '.bndlr-mix-and-match .bndlr-close', function() {
						bndlr.MixNMatch.removeFromBundle($(this));
					});
					$document.on('keydown', '.bndlr-mix-and-match .bndlr-close', function(e) {
						if(e.which == 13) { // Enter
							bndlr.MixNMatch.removeFromBundle($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.MixNMatch.removeFromBundle($(this));
						}
					});
					
					
						if (this.canAttachMixnMatchAddToCartListeners()) {
							
							$document.on('click', '.bndlr-status-box-add-to-cart', function() {
								// Add bundle to cart has been click on the button outside of the bundle (on the floating button)
								// Get the actual button from the actual bundle and trigger the add to cart action.
								// This only works for mix&match bundles
								
								var bundleKey = $(this).closest('[data-bndlr-bundle-key]').attr('data-bndlr-bundle-key');
								bndlr.MixNMatch.addMixAndMatchBundleToCart($('[data-bndlr-key="'+bundleKey+'"] .bndlr-add-bundle-to-cart').first(), $(this));
							});
							
							$document.on('keydown', '.bndlr-status-box-add-to-cart', function(e) {
								if(e.which == 13 || e.which == 32) { // Enter OR Space
									if(e.which == 32) { // Space
										e.preventDefault();
									}
									var bundleKey = $(this).closest('[data-bndlr-bundle-key]').attr('data-bndlr-bundle-key');
									bndlr.MixNMatch.addMixAndMatchBundleToCart($('[data-bndlr-key="'+bundleKey+'"] .bndlr-add-bundle-to-cart').first(), $(this));
									
								}
							});
							
							var MixNMatchScrollTimeout = false;
							$(window).scroll(function() {
								if (MixNMatchScrollTimeout !== false) {
									clearTimeout(MixNMatchScrollTimeout);
								}

								MixNMatchScrollTimeout = setTimeout(bndlr.MixNMatch.showHideStatusBox, 200);
							});
						}
										// End of MixNMatch listeners
					
					// Start of sectioned bundles listeners
					$document.on('click', '.bndlr-add-to-sectioned-bundle', function() {
						bndlr.sectionedAddToBundle($(this));
					});
					$document.on('keydown', '.bndlr-add-to-sectioned-bundle', function(e) {
						if(e.which == 13) { // Enter
							bndlr.sectionedAddToBundle($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.sectionedAddToBundle($(this));
						}
					});
					
					$document.on('click', '.bndlr-sectioned-section-name', function() {
						bndlr.sectionedSelectSection($(this));
					});
					$document.on('keydown', '.bndlr-sectioned-section-name', function(e) {
						if(e.which == 13) { // Enter
							bndlr.sectionedSelectSection($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.sectionedSelectSection($(this));
						}
					});
					
					$document.on('click', '.bndlr-next-section', function() {
						bndlr.sectionedSelectNextSection($(this));
					});
					
					$document.on('click', '[data-bundler-section-status] .bndlr-close', function() {
						bndlr.sectionedRemoveFromBundle($(this));
					});
					$document.on('keydown', '[data-bundler-section-status] .bndlr-close', function(e) {
						if(e.which == 13) { // Enter
							bndlr.sectionedRemoveFromBundle($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.sectionedRemoveFromBundle($(this));
						}
					});
					
					$document.on('click', '.bndlr-add-sectioned-bundle-to-cart', function() {
						// Bundle add to cart button was clicked in the widget
						// Add bundle to the cart. The app knows which bundle to add to the cart based on the $(this) parameter.
						bndlr.sectionedAddBundleToCart($(this));
					});
					$document.on('keydown', '.bndlr-add-sectioned-bundle-to-cart', function(e) {
						if(e.which == 13) { // Enter
							bndlr.sectionedAddBundleToCart($(this));
						}
						
						if(e.which == 32) { // Space
							e.preventDefault();
							bndlr.sectionedAddBundleToCart($(this));
						}
					});
					
					// End of sectioned bundles listeners
					
															
										
				
						$document.on('click', 'button.add_to_cart, #cart_form .js-change-quantity, .product-quantity-box .js-change-quantity, .btn--add-to-cart, .cart-functions  button.button[name="add"], #product-add-to-cart', function (e) {
							// Trigger discount estimator when the user clicks the button
							debounce('check-for-discounts', function() {
								setTimeout(function() {
									DiscountEstimator.showPopup();
																	}, 1000);
							}, 100);
						});
						
						document.addEventListener('bndlr:cart_was_modified', function() {
							debounce('check-for-discounts', function() {
								DiscountEstimator.showPopup();
															}, 100);
						});
										
										
					
										
										
										
					
					
					var bundleWidgetCreatedTimeout = false;
					$document.on('bundler_bundle_widget_created', function() {
						
						if (bundleWidgetCreatedTimeout !== false) {
							clearTimeout(bundleWidgetCreatedTimeout);
						}
						bundleWidgetCreatedTimeout = setTimeout(function() {
							// trigger change on option element so the options will get disabled and enabled correctly
							$('.bndlr-product').each(function(i, el) {
								setTimeout(function() {
									$(el).find('.bndlr-select-option').first().trigger('change');
								}, 10*i); // Delay this refresh so if there is a lot of products, we don't use all CPU.
							});

							bndlr.convertCurrency();
							
							if (
								(
									$('.bndlr-container:not([data-available="false"]) .bndlr-product-title').first().height() === 0 
									&& $('.bndlr-container:not([data-available="false"]) .bndlr-product-title').first().text() !== ''
									&& $('.bndlr-container:not([data-available="false"]) .bndlr-bundle-image').length === 0
								) || (
									$('.bndlr-container:not([data-available="false"]) .bndlr-bundle-image').length > 0 
									&& $('.bndlr-container:not([data-available="false"]) .bndlr-bundle-image').first().height() === 0
								) || (
									$('.bndlr-container:not([data-available="false"]) .bndlr-add-to-cart').length > 0 
									&& $('.bndlr-container:not([data-available="false"]) .bndlr-add-to-cart').first().height() === 0
								)
							) {
								// Font size set by theme is probably 0. Set font size!
								$('.bundler-target-element').css({'font-size':'16px', 'line-height': '1.5'});
							}
							
															if (typeof window.SealSubs !== 'undefined' && typeof window.SealSubs.refresh !== 'undefined') {
									window.SealSubs.refresh();
									setTimeout(function() {
										// Recalculate sizes for element in the popup 
										bndlr.setProductWidth('.bundles-bundler-hop-bundle-container .bundler-target-element');
									}, 200);
								}
														
														
						}, 500);
					});
					
										
											document.addEventListener('bundler:mixnmatch_refreshed', function() {

							if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.theme !== 'undefined' && (window.Shopify.theme.theme_store_id == 871 || window.Shopify.theme.name.indexOf('Warehouse') !== -1)) {
								debounce('resize-box', function() {
									// The Warehouse theme has an issue where the height of the product info column doesn't properly increase in Chrome because of some issue in the ResizeObserver API
									// This issue happens when the Mix & Match widget is resized because a new product is aadded to the bundle.
									
									var height = document.querySelector('.product-block-list__item--info .card').getBoundingClientRect().height;
									if (height > 200) {
										document.querySelector('.product-block-list__wrapper').style.minHeight = height + 'px';
									}
									
								}, 200);
							}
						});
										
					
					$(window).on('resize', function() {
						if (typeof bndlr.repositionTimeout !== 'undefined') {
							clearTimeout(bndlr.repositonTimeout);
						}
						
						bndlr.repositonTimeout = setTimeout(bndlr.repositionPlusSigns, 50);
					});
					
					
										
										
										
											// Detect default product variant selector change and also change the product variant in the bundler widget
						$('#SingleOptionSelector-0, #SingleOptionSelector-1').on('change', function() {	
							var variantSelector = '#ProductSelect-product-template option:selected, #ProductSelect-product-template option:selected';
							var variant = $(variantSelector).val();
							if (typeof variant == 'undefined') {
								var variant =  $(variantSelector).val();
							}
							
							$('select.bndlr-select-variant option[value="'+variant+'"]').parent('select').val(variant);
							$('select.bndlr-select-variant option[value="'+variant+'"]').parent('select').trigger('change');
						});
										
										
															
										

					// Set listener for direct checkout button on product pages
										try {
						
						document.addEventListener('click', function (event) {
							
														
							try {
								if (bndlr.useBundlerCheckout && 
									(	
										event.target.matches('form#form_buy_sticky #button-cart-buy') // Special sticky cart form
									) && 
									bndlr.externalAppPreventCheckout.canCheckout()) {
									
									event.preventDefault();
									event.stopPropagation();
									event.stopImmediatePropagation();
									
									
									var form = $(event.target).closest('form');
									var $stickyQuantity = form.find('[name="stickyquantity"]');
									if ($stickyQuantity.length > 0) {
										$stickyQuantity.attr('name', 'quantity');
									}
									var url = form.attr('action');

									
									
									$.ajax({
										type: "POST",
										url: url,
										data: form.serialize(),
										success: function(data) {
											self.prepareInvoice();
										}
									});
									
																	}
							} catch(e) {
								bundlerConsole.log(e.message);
							}
						}, true);
					} catch(e) {
						bundlerConsole.log(e.message);				
					}
					
						
					//});
					
										
										
					
										
					
					try {
						
						var eventNames = [
							'click'
						];
						
												
						for (var h = 0; h < eventNames.length; h++) {
							// Try to attach the default aggressive event listener to trigger before other events
							// Some older browsers don't support it.
							
							document.addEventListener(eventNames[h], function (event) {

								try {

									if (bndlr.useBundlerCheckout && event.target.matches(checkoutSelector) && bndlr.externalAppPreventCheckout.canCheckout()) {

										
										event.preventDefault();
										event.stopPropagation();
										event.stopImmediatePropagation();
										
										try {
											$(event.target).addClass('bndlr-checkout-button-clicked');
										} catch(e) {
											console.error(e);
										}
										self.prepareInvoice();
									}
								} catch(e) {
									bundlerConsole.log(e.message);
								}
							}, true);
						}
						
						
											} catch(e) {
						//bundlerConsole.log(e.message);						
					}
					
					try {
						// Shadow DOM elements
						
						var shadowDomSelectors = [
							'#upCart',
							'#vanga-smartcart',
							'#opus-shadow-container',
							//'redo-shopify-toggle'
						];
						
						for (var c in shadowDomSelectors) {
							if (shadowDomSelectors.hasOwnProperty(c)) {
								var shadowDomSelector = shadowDomSelectors[c];
								var shadowDoms = document.querySelectorAll(shadowDomSelector);

								if (shadowDoms.length === 1) {
									if (typeof shadowDoms[0].shadowRoot !== 'undefined') {
										
										for (var h = 0; h < eventNames.length; h++) {
											// Try to attach the default aggressive event listener to trigger before other events
											// Some older browsers don't support it.
											
											shadowDoms[0].shadowRoot.addEventListener(eventNames[h], function (event) {

												try {
													if (bndlr.useBundlerCheckout && event.target.matches(checkoutSelector) && bndlr.externalAppPreventCheckout.canCheckout()) {

														event.preventDefault();
														event.stopPropagation();
														event.stopImmediatePropagation();
														
														try {
															$(event.target).addClass('bndlr-checkout-button-clicked');
														} catch(e) {
															console.error(e);
														}
														self.prepareInvoice();
													}
												} catch(e) {
													bundlerConsole.log(e.message);
												}
											}, true);
										}
									}
								}
								
							}
						}
						
					} catch(e) {
						bundlerConsole.log(e.message);						
					}
					
					function setIframeListeners() {
						try {
							// IFRAME element
							
							var iframeSelectors = [
								'#kaktusc-widget'
							];
							
							
							function addEventListenerToIframe(iframe) {
								// Access the iframe's document
								const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

								// Select the element inside the iframe
								const targetElements = iframeDocument.querySelectorAll('.kaktusc-cart__checkout');

								// Add the event listener to the specific element
								if (targetElements !== null && targetElements.length > 0) {
									for (var j = 0; j < targetElements.length; j++) {
										
										
										for (var h = 0; h < eventNames.length; h++) {
											// Try to attach the default aggressive event listener to trigger before other events
											// Some older browsers don't support it.
											
											targetElements[j].addEventListener(eventNames[h], function (event) {

												try {
													if (bndlr.useBundlerCheckout && bndlr.externalAppPreventCheckout.canCheckout()) {

														event.preventDefault();
														event.stopPropagation();
														event.stopImmediatePropagation();
														
														try {
															$(event.target).addClass('bndlr-checkout-button-clicked');
														} catch(e) {
															console.error(e);
														}
														self.prepareInvoice();
													}
												} catch(e) {
													bundlerConsole.log(e.message);
												}
											}, true);
										}
									}
								}
							}
							
							for (var c in iframeSelectors) {
								if (iframeSelectors.hasOwnProperty(c)) {
									var iframeSelector = iframeSelectors[c];
									var iframes = document.querySelectorAll(iframeSelector);

									if (iframes.length > 0) {
										for(var z = 0; z < iframes.length; z++) {
											
											var tmpIframe = iframes[z];										
											
											// Check if iframe is already loaded
											if (tmpIframe.contentDocument || tmpIframe.contentWindow.document.readyState === 'complete') {
												// Iframe is already loaded, so add the event listener
												addEventListenerToIframe(tmpIframe);
											} else {
												// Iframe is not yet loaded, wait for the load event
												tmpIframe.addEventListener('load', function() {
													addEventListenerToIframe(tmpIframe);
												});
											}
											
											
										}
									}
								}
							}
							
						} catch(e) {
							bundlerConsole.log(e.message);						
						}
					}
					
					setIframeListeners();
					
					
					var productWidthStandard = 230;
					var productWidthLandingPage = 330;
					if (typeof clientSpecifics['product_dimensions'] !== 'undefined') {
						productWidthStandard 	= clientSpecifics['product_dimensions'].getStandardWidth();
						productWidthLandingPage = clientSpecifics['product_dimensions'].getLadingPageWidth();
					}
					
					$body.append('<style>' +
						'.bndlr-container {' +
							'width:100%;' +
							'text-align:center;' +
							'margin-top:20px;' +
							'padding-top: 20px;' +
							'clear: both;' +
							'box-sizing: border-box;' +
							'line-height:1.5;' +
							//'font-size:16px;' +
						'}' +
						'.bndlr-product {' +
							'max-width:230px;' +
							'max-width:'+productWidthStandard+'px;' +
							'display:inline-block;' +
							'vertical-align: top;' +
							'margin: 5px 5px;' +
							'position:relative;' +
							'border: 1px solid rgba(198, 198, 198, 0.55);' +
							'padding: 5px 5px;' +
							'vertical-align: middle;' +
							'box-sizing: border-box;' +
						'}' +
						
						'.bndlr-product-overlay {' +
							'width:100%;' +
							'height:100%;' +
							'position:absolute;' +
							'top:0;' +
							'left:0;' +
							'background:rgba(255, 255, 255, 0.5);' +
							'background:rgba(255, 255, 255, 0.25);' +
							'box-sizing: border-box;' +
							'display:none;' +
							'pointer-events:none;' +
						'}' +
						
						'.bndlr-product-overlay .bndlr-product-overlay-checkmark  {' +
							'position:absolute;' +
							'width: auto;' + 
							'height: 1.5em;' + 
							'display: block;' +
							'background:white;' +
							'background: #FFFFFF;' +
							'top:0;' +
							'right:0;' +
						'}' +
						
						'.bndlr-product-overlay .bndlr-product-overlay-checkmark .bndlr-preselected-checkmark {' +
							'width: auto;' +
							'height: 1.5em;' +
							'display: block;' +
							'stroke-width: 3;' +
							'stroke: rgb(70, 103, 167);' +
							'stroke: #4667A7;' +
							'margin:0 auto;' +
						'}' +
						
						'.bndlr-product:not(:last-of-type)::after {' +
							'position: absolute;' +
							'display: block;' +
							'right: calc(-0.5em - 6px);' +
							'top: 50%;' +
							'transform: translateY(-50%);' +
							'z-index: 9;' +
							'z-index: 1;' +
							'content: "+";' +
							'font-weight: bold;' +
							'color: white;' +
							'color: #ffffff;' +
							'background: #4667a7;' +
							'background: #4667a7;' +
							'border-radius:50%;' +
							'width: 1em;' +
							'height: 1em;' +
							'line-height: 1.05em;' +
							'font-size:25px;' +
							'font-family:arial;' +							
						'}' +
						'.bndlr-product.bndlr-no-plus-sign::after {' +
							'display:none;' +
						'}' +
												'.bndlr-container .bndlr-break-plus-signs .bndlr-add-to-cart {' +
							'max-width:230px;' +
						'}' +
						/* Bundler landing page */
						'.bndlr-landing-page .bndlr-product {' +
							'max-width:330px;' +
							'max-width:'+productWidthLandingPage+'px;' +
						'}' +
						'.bndlr-landing-page .bndlr-mnm-selected-products .bndlr-product {' +
							'max-width:250px;' +
						'}' +
						'.bndlr-landing-page .bndlr-container {' +
							'margin-top:0;' +
							'padding-top:0;' +
						'}' +
						'.bndlr-landing-page .bndlr-break-plus-signs .bndlr-add-to-cart {' +
							'max-width:330px;' +
						'}' +
						'@media screen and (max-width: 554px) {' +
							'.bndlr-landing-page .bndlr-container .bndlr-add-to-cart {' +
								'max-width:330px;' +
							'}' +
						'}' +
						/* ------------- */
						'.bndlr-break-plus-signs .bndlr-product:not(:last-of-type)::after {' +
							'right: calc(-0.5em - 6px);' +
							'left: 50%;' +
							'transform: translateX(-50%);' +
							'bottom: calc(-0.5em - 6px);' +
							'top:initial;' +
						'}' +
						'.bndlr-products-container {' +
							'display:inline-block;' +
							'padding:7px;' +
							'border-radius:2px;' +
							'margin-bottom: 20px;' +
							'position:relative;' +
                            '}' +
                        '.bndlr-sectioned-title {' +
                            'text-align: center;' +
                            'margin-top: 25px;' +
						'}' +
						'.bndlr-inner-products-container {' +
							'display:inline-block;' +
						'}' +
						'.bndlr-mixnmatch .bndlr-inner-products-container {' +
							'padding-top:5px;' +
						'}' +
						'.bndlr-bundle-description {' +
							'width:80%;' +
							'margin:0 auto;' +
						'}' +
						'.bndlr-bundle-title {' +
							'margin-bottom: 0.3em;' +
							'margin-top: 0.2em;' +
						'}' +
						'.bndlr-container h2.bndlr-bundle-title {'+
							'text-align:center;' +
						'}' +
						'.bndlr-bundle-checkout-warning {' +
							'width:80%;' +
							'margin:0 auto 0.2em auto;' +
							'font-size:0.8em;' +
							'opacity:0.8;' +
							'margin-top: 0.5em;' +
						'}' +
												'.bndlr-add-to-cart {' +
							'display:block;' +
							'width: calc(100% - 10px);' +
							'margin:5px auto 0 auto;' +
							'background: #4667a7;' +
							'background: #4667a7;' +
							'padding: 0.6em 0;' +
							'color: white;' +
							'color: #ffffff;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'max-width: 710px;' +
						'}' +
						'.bndlr-add-to-cart-container {' +
							'display:flex;' +
							'width: calc(100% - 10px);' +
							'margin:0px auto 0 auto;' +
							'max-width: 710px;' +
							'padding-top:5px;' +
						'}' +
						'.bndlr-add-to-cart-container .bndlr-add-to-cart, .bndlr-add-to-cart-container .bndlr-add-bundle-to-cart {' +
							'margin:0;' +
							'flex: 1 1 auto;' +
						'}' +
						'.bndlr-add-to-cart-container .bndlr-floating-label {'+
							'position: relative;' +
						'}' +
						'.bndlr-add-to-cart-container .bndlr-floating-label  .bndlr-add-to-cart-quantity-label {'+
							'position: absolute;' +
							'transition: all .3s ease;' +
							'font-size: 0.7em !important;' +
							'top: 0;' +
							'left: 0.5em;' +
							'pointer-events: none;' +
							'margin: 0;' +
							'padding: 0;' +
							'color: rgb(115, 115, 115);' +
							'font-weight: normal !important;' +
							'line-height: 1.6;' +
							'text-transform: none;' +
							'letter-spacing: inherit !important;' +
							'text-transform: inherit !important;' +
							'width: auto;' +
						'}' +
						'.bndlr-add-to-cart-container .bndlr-add-to-cart-quantity-input {' +
							'flex: 1 1 50px;' +
							'margin-right: 5px;' +
							'max-width: 70px;' +
							'font-size: 1em;' +
							'padding: .3em;' +
															'padding: 0.8em 0.25em 0.25em 0.25em;' +
														'line-height: 1.6;' +
							'font-family: inherit;' +
							'font-weight: inherit;' +
							'font-style: inherit;' +
							'text-align: center;' +
							'box-sizing: border-box;' +
							'border-radius: 2px;' +
							'margin-top: initial;' +
							'margin-bottom: initial;' +
							'height: 100%;' +
							'overflow: visible;' +
							'border: 1px solid rgba(198, 198, 198, 0.55);' +
						'}' +
						'.bndlr-add-to-bundle {' +
							'display:block;' +
							'width: 100%;' +
							'margin:5px auto 0 auto;' +
							'background: #4667a7 !important;' +
							'background: rgb(67, 112, 183) !important;' +
							'padding: 0.6em 0;' +
							'color: white !important;' +
							'color: #FFFFFF !important;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'max-width: 710px;' +
							'user-select: none;' +
						'}' +
						'.bndlr-add-to-bundle:active {' +
							'opacity:0.5;'+
						'}' +
						
						'.bndlr-add-to-bundle-container {' + 
							'display:flex;' +
							'flex-direction: row' +
						'}' + 
						'.bndlr-add-to-bundle-container .quantity-input {' + 
							'width: 44px;' +
							'margin: 5px 5px 0 auto;' +
							'border: 1px solid #ccc;' +
							'text-align: center;' +
							'border: 1px solid rgba(198, 198, 198, 0.55);' +
							'border-radius: 2px;' +
							'font-weight: inherit;' +
							'font-style: inherit;' +
							'padding: 5px;' +
							'opacity: 1;' +
						'}' + 
						'.bndlr-add-to-bundle-container .quantity-input[type=number]::-webkit-inner-spin-button, ' + 
						'.bndlr-add-to-bundle-container .quantity-input[type=number]::-webkit-outer-spin-button {' +  
							'opacity: 1 !important;' +
						'}' +
						'.bndlr-add-to-bundle-container .quantity-input[type=number]:focus {' +
							'outline: none;'+
							'border: 1px solid rgba(20,20,20);' +
							'box-shadow: none;' +
						'}' +
						
						'.bndlr-add-bundle-to-cart {' +
							'display:block;' +
							'width: 100%;' +
							'margin:5px auto 0 auto;' +
							'background: #4667a7 !important;' +
							'background: #4667a7 !important;' +
							'padding: 0.6em 0;' +
							'color: white !important;' +
							'color: #ffffff !important;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'max-width: 710px;' +
						'}' +
						
						
						'.bndlr-add-sectioned-bundle-to-cart {' +
							'display:block;' +
							'width: 100%;' +
							'margin:5px auto 0 auto;' +
							'background: #4667a7 !important;' +
							'background: #4667a7 !important;' +
							'padding: 0.6em 0;' +
							'color: white !important;' +
							'color: #FFFFFF !important;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'max-width: 710px;' +
							'text-align:center;' +
							'user-select: none;' +
						'}' +
						'.bndlr-add-sectioned-bundle-to-cart.bndlr-disabled {' +
							'opacity:0.2;' +
							'pointer-events:none;' +
						'}' +
						'.bndlr-add-to-sectioned-bundle {' +
							'display:block;' +
							'width: 100%;' +
							'margin:5px auto 0 auto;' +
							'background: #4667a7 !important;' +
							'background: #4667a7 !important;' +
							'padding: 0.6em 0;' +
							'color: white !important;' +
							'color: #FFFFFF !important;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'max-width: 710px;' +
							'user-select: none;' +
						'}' +
						
						'.bndlr-sectioned-product .bndlr-product-qn-container {' +
							'margin-left:5px;' +
							'margin-right:5px;' +
						'}' +
						
						
						'.bndlr-sectioned-instructions-text {' +
							'margin: 0 auto 0.2em auto;' +
							'margin-top: 0px;' +
							'font-size: 0.8em;' +
							'margin-top: 0.5em;' +
							'text-align: center;' +
							'color:rgba(14, 27, 77, 1);' +
							'color:rgb(14, 27, 77);' +
							'opacity: 0.75;' +
						'}' +
						
						'.bndlr-add-to-sectioned-bundle:active {' +
							'opacity:0.5;'+
						'}' +
						
													'.bndlr-add-to-cart[data-active="false"] {' +
								'opacity:0.8;' +
								'cursor: default;' +
							'}' +
												
						'.bndlr-checkmark {' +
							'width: auto;' +
							'height: 1.5em;' + // Must be the same as line height
							'display: block;' +
							'stroke-width: 4;' +
							'stroke: #ffffff;' +
							'margin:0 auto;' +
							'stroke-dasharray: 45;' +
							'stroke-dashoffset: 45;' +
							'-moz-animation: bndlr-stroke 0.35s linear forwards;' +
							'-webkit-animation: bndlr-stroke 0.35s linear forwards;' +
							'-o-animation: bndlr-stroke 0.35s linear forwards;' +
							'-ms-animation: bndlr-stroke 0.35s linear forwards;' +
							'animation: bndlr-stroke 0.35s linear forwards;' +
						'}' +
						
						'.bndlr-product.bndlr-mix-and-match .bndlr-checkmark {' +
							'stroke: #FFFFFF;' +
						'}' +
						
						// Don't animate checkmark in internet explorer and edge, as they don't support it. Edge should support it, but who knows :D
						'_:-ms-lang(x), .bndlr-checkmark {' +
							'stroke-dasharray: 0px;' +
							'stroke-dashoffset: 0px;' +
						'}' +
						
						'@keyframes bndlr-stroke {' +
							'100% {' +
								'stroke-dashoffset: 0px;' +
							'}' +
						'}' +
						
						'.bndlr-product-image-url {' +
							'display: block;' +
							'text-decoration: none;' +
							'border: none !important;' +
							'padding: 0 !important;' +
						'}' +
						'.bndlr-product-image-url::after {' +
							'display: none !important;' +
						'}' +
						'.bndlr-product-image {' +
							'border-radius:2px;' +
							'max-width:100%;' +
							'width:100%;' +
							'height:auto;' +
							'display:block;' +
							'margin-bottom:5px;' + 
							'margin-left: 0 !important;' +
							'opacity: 1 !important;' + /* To prevent image from disappearing because of lazyloading scripts */
						'}' +/*
						
						'.bndlr-product-image[width][height] {' +
							'height:calc(100% - 5px);' +
						'}' +
						*/'.bndlr-product-title {' +
							'font-weight:bold;' +
							'border: none !important;' +
							'padding: 0 !important;' +
															'color: #282828 !important;' +
														
						'}' +
						'.bndlr-product-quantity {' +
							'font-weight:bold;' +
							'color: #788188;' +
							'color: #788188;' +
							'display: inline-block;' +
							'margin-right: 5px;' +
						'}' +
						'.bndlr-old-price {' +
							'text-decoration: line-through !important;' + /* We need important because of the .money class */
							/*'margin-right:0.5em;' + No need for margin as we use one space to allow word break */
							'margin-right:0.25em;' +
							'color: #788188 !important;' +
							'color: #788188 !important;' +
							'font-weight:bold !important;' +
						'}' +
						'.bndlr-new-price {' +
							'color: #788188 !important;' +
							'color: rgb(120, 129, 136) !important;' +
							'font-weight:bold !important;' +
						'}' +
												'.bndlr-add-to-cart .bndlr-new-price {' +
							'color: inherit !important;' +
							'font-weight:inherit !important;' +
						'}' +
						'.bndlr-old-price-cart-inline {' +
							'text-decoration: line-through !important;' +
							'margin-right:0.25em;' +
						'}' +
						'.bndlr-total-price,.bndlr-mnm-total-price {' +
							'font-weight:bold;' +
						'}' +
						'.bndlr-total-price .bndlr-old-price, .bndlr-total-price .bndlr-new-price, .bndlr-mnm-total-price .bndlr-old-price, .bndlr-mnm-total-price .bndlr-new-price {' +
							'color:inherit;' +
						'}' +
						'.bndlr-price-per-unit {' +
							'color: #788188 !important;' +
							'color: rgb(120, 129, 136) !important;' +
							'font-weight:normal !important;' +
							'font-style:italic;' +
							'font-size: 0.8em;' +
							'vertical-align: middle;' +
							'vertical-align: top;' +
						'}' +		 
						'.bndlr-select-variant {' +
							'font-family: inherit;' +
							'font-weight: inherit;' +
							'font-style: inherit;' +
							'-webkit-font-smoothing: antialiased;' +
							'-webkit-text-size-adjust: 100%;' +
							'border-radius: 2px;' +
							'max-width: 100%;' +
							'font-size: .82em;' +
							'padding: .445em 10px;' +
							'padding-right: 10px;' +
							'padding-right: 10px;' +
							'line-height: 1.6;' +
							'border: 1px solid #E3E3E3;' +
							'width: 100%;' +
							'max-width: 100%;' +
							'display: block;' +
							'margin-top: 5px;' +
							'margin-bottom: 0px !important;' +
							'color:rgb(47, 47, 47);' +
							'-webkit-appearance: none;' +
							'-moz-appearance: none;' +
							'appearance: none;' +
							'background-image: url(https://cdn-bundler.nice-team.net/app/img/app/dwn.svg?v2) !important;' +
							'background-repeat: no-repeat !important;' +
							'background-position: right 10px center !important;' +
							'background-color: #fff !important;' +
							'background-color: #FFFFFF !important;' +
							'padding-right: 28px;' +
							'text-indent: 0.01px;' +
							'text-overflow: "";' +
							'cursor: pointer;' +
							'background-size: auto;' +
							'min-height: unset !important;' +
							'height: auto;' +
						'}' +
						'select.bndlr-select-variant::-ms-expand {' +
							'display:none;' +
						'}' +
						'.bndlr-loading {' +
							'color: rgba(0,0,0,0) !important;' +
							'position:relative;' +
						'}' +
						'.bndlr-loading svg.bndlr-checkmark {' +
							'opacity:0;' +
						'}' +
						'.bndlr-loading:after {' +
							'display: block;' +
							'content: "";' +
							'border: 2px solid white;' +
							'border: 2px solid #ffffff;' +							
							'width: 1em;' +
							'height: 1em;' +
							'border-radius: 50%;' +
							'border-top: 2px solid transparent;' +
							'position: absolute;' +
							'left: 50%;' +
							'top: 50%;' +
							'animation-name: bndlr-spin;' +
							'animation-duration: 500ms;' +
							'animation-iteration-count: infinite;' +
							'animation-timing-function: linear;' +
						'}' +
						'@keyframes bndlr-spin {' +
							'from {' +
								'transform:translateY(-50%) translateX(-50%) rotate(0deg);' +
							'}' +
							'to {' +
								'transform:translateY(-50%) translateX(-50%) rotate(360deg);' +
							'}' +
						'}' +
						'.bndlr-bundle-loading {' +
							'height:6rem;' +
							'position:relative;' +
						'}' +
						'.bndlr-bundle-loading:after {' +
							'display: block;' +
							'content: "";' +
							'border: 2px solid #cdcdcd;' +
							'width: 3em;' +
							'height: 3em;' +
							'border-radius: 50%;' +
							'border-top: 2px solid transparent;' +
							'position: absolute;' +
							'left: 50%;' +
							'top: 50%;' +
							'animation-name: bndlr-spin;' +
							'animation-duration: 500ms;' +
							'animation-iteration-count: infinite;' +
							'animation-timing-function: linear;' +
						'}' +
						'#bndlr-discount-message {' +
							'position:fixed;' +
							'display:block;' +
							'width:auto;' +
							'height:auto;' +
							'background:rgb(246, 239, 220);' +
							'background:rgb(246, 239, 220);' +
							'color:#262626;' +
							'color:#262626;' +
							'padding: 30px 20px;' +
															'right:10px;' +
								'bottom:-100%;' +
														'z-index:99999;' +
							'box-shadow: 1px 1px 2px 1px #a5a5a5;' +
							'border-radius: 2px;' +
							'text-align:center;' +
							'font-size:20px;' +
							'border: 3px solid rgb(47, 47, 47);' +
							'border: 3px solid rgb(47, 47, 47);' +							
															'margin-left:10px;' +
													'}' +
						'.bndlr-message-title {' +
							'font-style:italic;' +
							'font-size: 0.8em;' +
							'font-weight: normal;' +
						'}' +
						'.bndlr-message-and-text {' +
							'font-size: 0.8em;' +
							'font-weight: normal;' +
						'}' +
						'.bndlr-message-question {' +
							'font-size: 0.7em;' +
							'font-weight: normal;' +
							'padding: 0 20px;' +
							'margin: 15px 0 10px 0;' +
						'}' +
						'.bndlr-message-discount-value {' +
							'border-top: 1px solid black;' +
							'border-top: 1px solid #262626;' +
							'border-bottom: 1px solid black;' +
							'border-bottom: 1px solid #262626;' +
							'font-weight:bold;' +
							'margin: 10px;' +
							'line-height: 1.5;' +
						'}' +
						'.bndlr-message-yes {' +
							'font-size: 0.7em;' +
							'background: rgb(70, 167, 98);' +
							'background: rgb(70, 167, 98);' +
							'color: white;' +
							'color: #ffffff;' +
							'display: inline-block;' +
							'padding: 5px 15px;' +
							'border: 1px solid rgb(0, 0, 0);' +
							'border: 1px solid #262626;' +
							'border-radius: 2px;' +
							'margin:0 10px;' +
							'cursor:pointer;' +
						'}' +
						'.bndlr-message-no {' +
							'font-size: 0.7em;' +
							'background: transparent;' +
							'display: inline-block;' +
							'padding: 5px 15px;' +
							'border: 1px solid rgb(0, 0, 0);' +
							'border: 1px solid #262626;' +
							'border-radius: 2px;' +
							'margin:0 10px;' +
							'cursor:pointer;' +
						'}' +
						'.bndlr-message-close, .bndlr-message-close:empty {' +
							'position:absolute;' +
							'width:32px;' +
							'height:32px;' +
							'top:-5px;' +
							'right:-5px;' +
							'cursor:pointer;' +
							'border: none;' +
							'box-sizing: border-box;' +
							'display:block;' +
						'}' +
						'.bndlr-message-close:before, .bndlr-message-close:after {' +
							'position: absolute;' +
							'left: calc(16px - 1px);' +
							'content: "";' +
							'height: 16px;' +
							'top: 8px;' +
							'width: 2px;' +
							'background-color: rgb(38, 38, 38);' +
							'background-color: rgb(38, 38, 38);' +
						'}' +
						'.bndlr-message-close:before {' +
							'transform: rotate(45deg);' +
						'}' +
						'.bndlr-message-close:after {' +
							'transform: rotate(-45deg);' +
						'}' +
						/*
						'.bndlr-message-close::after {' +
							'content: "";' +
							'display: block;' +
							'height: 2px;' +
							'width: 100%;' +
							'background-color: rgb(38, 38, 38);' +
							'background-color: rgb(38, 38, 38);' +
							'position: absolute;' +
							'left: 0;' +
							'top: 7px;' +
						'}' +
						'.bndlr-message-close::before {' +
							'content: "";' +
							'display: block;' +
							'height: 100%;' +
							'width: 2px;' +
							'background-color: rgb(38, 38, 38);' +
							'background-color: rgb(38, 38, 38);' +
							'position: absolute;' +
							'left: 7px;' +
							'top: 0;' +
						'}' +
						'.bndlr-message-close {' +
							'width: 16px;' +
							'height: 16px;' +
							'-webkit-transform: rotate(45deg);' +
							'-x-transform: rotate(45deg);' +
							'-o-transform: rotate(45deg);' +
							'transform: rotate(45deg);' +
							'position: absolute;' +
							'right: 3px;' +
							'top: 3px;' +
							'border: none;' +
							'cursor: pointer;' +
							'box-sizing: border-box;' +
						'}' +
						*/
						'.bndlr-warning {' +
							'position:absolute;' +
							'bottom:2px;' +
							'left:2px;' +
							'background:white;' +
							'color: #292929;' +
							'font-size:1em;' +
							'display:block;' +
							'padding: 5px;' +
							//'z-index: 1000;' +
							'border-radius:2px !important;' +
							'border: 1px solid #cdcdcd;' +
							'cursor:help;' +
							'left: 50%;' +
							'transform: translateX(-50%);' +
							'width: 90%;' +
						'}' +
						'.bndlr-warning-container .bndlr-warning {' +
							'position:relative;' +
							'left: unset;' +
							'transform: unset;' +
							'text-align: center;' +
							'bottom: unset;' +
							'width: auto;' +
							'margin: 2px;' +
						'}' +
						/* Accessibility CSS */
						'.bndlr-add-to-cart:focus, .bndlr-select-variant:focus, .bndlr-product a:focus, .bndlr-add-to-bundle:focus, .bndlr-add-bundle-to-cart:focus, .bndlr-close:focus, .bndlr-add-sectioned-bundle-to-cart:focus {' +
							'outline:1px dotted rgb(134, 134, 134);' +
							'outline-offset: 1px;' +
						'}' +
						'.bndlr-add-to-cart:focus, .bndlr-select-variant:active, .bndlr-add-to-bundle:focus, .bndlr-add-bundle-to-cart:focus, .bndlr-add-sectioned-bundle-to-cart:focus  {' +
							'opacity:0.9;' +
						'}' +
						'.bndlr-select-variant:hover {' +
							'outline:1px solid rgb(221, 221, 221);' +
						'}' +
						
						/* Rich text editor overrides */
						'.rte img.bndlr-product-image {' +
							'margin:0;' +
							'margin-bottom: 5px;' +
							'margin-left: 0 !important;' +
						'}' +
						'.rte .bundler-target-element a {' +
							'text-decoration:initial;' +
							'text-underline-position:initial;' +
						'}' +
						'.rte .bundler-target-element h2::after {' +
							'margin:0;' +
							'padding:0;' +
							'display:none;' +
						'}' +
						'.rte .bundler-target-element h2 {' +
							'margin-top:0.2em;' +
							'margin-bottom:0.3em;' +
						'}' +
						
						/* Gecko 4.4 theme fix */
						'#jas-content .jas-row .bundler-target-element {' +
							'flex:1 1 auto;' +
						'}' +
						
						/* Custom bundle image */
						'img.bndlr-bundle-image {' +
							'border: 1px solid rgba(198, 198, 198, 0.55);' +
							'padding: 5px 5px;' +
							'max-width:100%;' +
							'max-width:calc(100% - 10px);' +
							'width:auto;' +
							'margin: 5px;' +
							'vertical-align: bottom;' +
							'box-sizing: border-box;' +
						'}' +
						'.bndlr-product-names-list {' + 
							'max-width: 710px;' +
							'margin:0 auto;' +
							'padding-bottom: 0.25em;' +
						'}' +
						
						'.bndlr-product-names-list .bndlr-price-per-unit {' + 
							'vertical-align: middle;' +
							'padding-left: 0.5em;' +
							'font-size: 0.7em;' +
						'}' +
						
						'#bndlr-loaded {' + 
							'width:0;' +
							'height:0;' +
						'}' +
												
												
						'.bundler-target-element {' +
							'clear:both;' +
							'direction:ltr;' +
						'}' +
						
												
												
												'.template-product section.page.page-product-header[itemtype="http://schema.org/Product"][data-section-type="product"] .bndlr-container {' +
							'padding-bottom:100px;' +
						'}' +
						
						'.bndlr-error {' +
							'text-align: center;' +
							'color:rgba(142, 142, 142, 0.46);' +
							'font-size: 0.7em;' +
							'font-style: italic;' +
						'}' +
						'span.bndlr-cart-values {' +
							'display:inline;' +
						'}' +

						/* Mix & Match bundle style */
						
						'.bndlr-mnm-second-container {' +
							'display:flex;' +
							'flex-direction:column;' +
						'}' +
						/*
						'.bndlr-mnm-available-products {' +
							'padding:5px;' +
						'}' +
						*/
						'.bndlr-mnm-selected-products-title {' +
							'text-align:center;' +
							'padding:5px 10px 0 10px;' +
							'font-size: 1.1em;' +
							'font-weight: bold;' +
							'font-style: italic;' +
						'}' +
						'.bndlr-mnm-selected-products {' +
							'flex: 1 1 50%;' +
							'display: flex;' +
							'padding:5px 0;' +
						'}' +
						'.bndlr-mnm-selected-products .bndlr-product {' +
							'max-width:200px;' +
						'}' +
						'.bndlr-mnm-add-to-cart-wrapper {' +
							'flex: 1 1 auto;' +
							'padding:5px;' +
						'}' +
						
						'.bndlr-mnm-selected-products .bndlr-product {' +
							'box-shadow: 1px 1px 5px 0px rgb(128, 128, 128);' +
							'border:none;' +
						'}' +
						
						'.bndlr-mnm-instructions-text {' +
                            'display: block;' +
							'color: rgb(232, 35, 35);' +
							'color: rgb(232, 35, 35);' +
						'}' +
						
	
						'.bndlr-product[data-mnm-required="true"]::before {' +
							'display:block;' +
							'content:"Required";' +
							'content:"Required";' +
							'position:absolute;' +
							'opacity: 1;' +
							'left: 0;' +
							'top: 0;' +
							'background:rgb(219, 54, 24);' +
							'background: rgb(219, 54, 24);' +
							'color:white;' +
							'color: rgb(255, 255, 255);' +
							'padding: 5px 7px;' +
							'font-weight: normal;' +
							'z-index:1;' +
							'border-bottom-right-radius: 2px;' +
						'}' +
						
						'#bndlr-mnm-status-box {' +
							'position:fixed;' +
							'bottom: 1em;' +
							'left:50%;' +
							'transform:translateX(-50%);' +
							'min-width:250px;' +
							'max-width:90%;' +
							'text-align:center;' +
							'z-index:2;' +
						'}' +
						
						'@media only screen and (max-width: 440px) {' +
							'#bndlr-mnm-status-box {' +
								'min-width:90%;' +
							'}' +
						'}' +
						
						'.bdnlr-mnm-status-box-info-container {'+
							'background:black;' +
							'background: #000000;' +
							'padding: 1em;' +
							'border-radius: 5px;' +
						'}' +
						
						'.bdnlr-mnm-status-box-products-container {' +
							//'margin-bottom: -0.5em;' +
							//'height: 67px;' +
							'text-align: center;' +
							'padding-left: 5px;' +
						'}' +
						
						'.bndlr-status-box-product {' +
							'width: 67px;' +
							'height: 67px;' +
							'display: inline-block;' +
							'margin-left: -10px;' +
							'margin-bottom: -0.5em;' +
							'vertical-align:bottom;' +
						'}' +
						'.bndlr-status-box-product-quantity {' +
							'position: absolute;' +
							'margin-top: -0.5em;' +
							'margin-left: -0.5em;' +
							'color: gray;' +
							'color: rgb(128, 128, 128);' +
							'font-style: italic;' +
							'font-size: 0.8em;' +
							'text-shadow: 1px 1px 0px rgb(193, 192, 192);' +
						'}' +
						
						'.bndlr-status-box-product-url {' +
							'display:block;' +
						'}' +
						
						'.bndlr-status-box-product-image {' +
							'width: 67px;' +
							'border-radius: 50% !important;' +
							'height: 67px;' +
							'object-fit: cover;' +
							'background:white;' +
							'box-shadow: 1px 1px 2px 0px rgba(0, 0, 0, 0.7);' +
						'}' +
						
						'#bndlr-mnm-status-box .bndlr-mnm-instructions-text {' +
							'color: white;' +
							'color: #FFFFFF;' +
						'}' +
						
						'.bndlr-status-box-add-to-cart {' +
							'display:block;' +
							'width: 100%;' +
							'margin:0 auto;' +
							'background: #4667a7;' +
							'background: #4667a7;' +
							'padding: 0.6em 0;' +
							'color: white;' +
							'color: #FFFFFF;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'max-width: 710px;' +
						'}' +
						
						'.bndlr-tiered-mnm-instructions-text {' +
							'color: rgb(0, 0, 0);' +
							'color:rgb(0, 0, 0);' +
							'border-radius: 4px;' +
							'box-shadow: 0px 0px 2px rgba(0, 0, 0, 0.32) inset;' +
							'margin: 0.5em auto;' +
							'display:inline-block;' +
							'font-weight: bold;' +
							'background: linear-gradient(90deg, rgb(51, 51, 51) 50%, transparent 0) repeat-x, linear-gradient(90deg, rgb(51, 51, 51) 50%, transparent 0) repeat-x, linear-gradient(0deg, rgb(51, 51, 51) 50%, transparent 0) repeat-y, linear-gradient(0deg, rgb(51, 51, 51) 50%, transparent 0) repeat-y;' +
							'background: linear-gradient(90deg, rgb(0, 0, 0) 50%, transparent 0) repeat-x, linear-gradient(90deg, rgb(0, 0, 0) 50%, transparent 0) repeat-x, linear-gradient(0deg, rgb(0, 0, 0) 50%, transparent 0) repeat-y, linear-gradient(0deg, rgb(0, 0, 0) 50%, transparent 0) repeat-y;' +
							'background-size: 4px 1px, 4px 1px, 1px 4px, 1px 4px;' +
							'background-position: 0 0, 0 100%, 0 0, 100% 0;' +
							'animation: bndlr-linear-gradient-move .3s infinite linear;' +
							'transform: translate3d(0,0,0);' +
							'overflow: hidden;' +
							'padding: 1px;' +
						'}' +
						
						'.bndlr-tiered-mnm-instructions-text-inner {' +
							'background: rgb(254, 216, 63);' +
							'background: rgb(254, 216, 63);' +
							'padding: 0.4em 1em;' +
						'}' +
						
						'@keyframes bndlr-linear-gradient-move {' +
							'100% {' +
								'background-position: 4px 0, -4px 100%, 0 -4px, 100% 4px;' +
							'}' +
						'} ' +
						
						
						// Start of visibility animation
'.bndlr-visibility-hidden {' +
	'visibility:hidden;' +
	'opacity:0;' +
	'transition: visibility 0.5s, opacity 0.5s linear;' +
'}' +
'.bndlr-visibility-visible {' +
	'visibility: visible;' +
	'opacity:1;' +
	'transition: visibility 0.5s, opacity 0.5s linear;' +
'}' +
// End of visibility animation						
						'.bndlr-hidden {' +
							'display:none !important;' +
						'}' +
						
						'.bndlr-close::after {' +
							'content: "";' +
							'display: block;' +
							'height: 2px;' +
							'width: 100%;' +
							'background-color: rgb(70, 70, 70);' +
							'position: absolute;' +
							'left: 0;' +
							'top: 7px;' +
							'outline: 1px solid rgb(255, 255, 255);' +
						'}' +
						'.bndlr-close::before {' +
							'content: "";' +
							'display: block;' +
							'height: 100%;' +
							'width: 2px;' +
							'background-color: rgb(70, 70, 70);' +
							'position: absolute;' +
							'left: 7px;' +
							'top: 0;' +
							'outline: 1px solid rgb(255, 255, 255);' +
						'}' +
						'.bndlr-close {' +
							'width: 16px;' +
							'height: 16px;' +
							'-webkit-transform: rotate(45deg);' +
							'-x-transform: rotate(45deg);' +
							'-o-transform: rotate(45deg);' +
							'transform: rotate(45deg);' +
							'position: absolute;' +
							'right: 3px;' +
							'top: 3px;' +
							'border: none;' +
							'cursor: pointer;' +
							'box-sizing: border-box;' +
						'}' +
						'div.bndlr-close:empty {' +
							'display:block;' + // Fix for Dawn theme
						'}' +
						
						'#ajaxifyModal #ajaxifyCart .bndlr-cart-values {'+
							// Smaller font size for Supply theme
							'font-size:80%;'+
						'}'+
						
						'.bndlr-dn {' +
							'display:none;' +
						'}' +
						'.bndlr-no-click {' +
							'pointer-events:none;' +
						'}' +
						
													// Volume discounts
							
							'.bundler-volume-target-element { ' +
								'clear: both;' +
							'}' +
							
							'.bndlr-volume {' +
								'text-align:center;' +
								'padding-top: 2em;' +
								'color:black;' +
								'color:#000000;' +
								'padding-bottom: 2em;' +
							'}' +
							
							'.bndlr-volume-title, h2.bndlr-volume-title {' +
								'margin-bottom: 0.3em;' +
								'margin-top: 0.2em;' +
								'font-size: 1.25em;' +
								'line-height: 1.2;' +
								'float:none;' +
								'width:auto;' +
							'}' +
							
							'.bndlr-volume-discounts {' +
								'margin-top: 0.75em;' + 
							'}' +
							
							'.bndlr-volume-discount {' +
								'border: 2px solid rgba(189, 189, 189, 0.55);' +
								'border: 2px solid rgba(189, 189, 189, 0.55);' +
								'padding: 0.75em;' +
								'margin-bottom: .5em;' +
								'text-align:center;' +
								'border-radius:5px;' +
								'position:relative;' +
								'color:black;' +
								'color:#000000;' +
								'background:white;' +
								'background:#FFFFFF;' +
							'}' +
							
							'.bndlr-volume-style-0.bndlr-volume-discount.bndlr-has-savings-text {' +
								'padding: 0.5em 0.75em 1.1em 0.75em;' +
								'margin-bottom: 1.2em;' +
							'}' +
							
							'.bndlr-volume-style-0 .bndlr-volume-saving-text {' +
								'position:absolute;' +
								'left:50%;' +
								'transform:translate(-50%, 50%);' +
								'bottom:0;' +
								'border-radius:5px;' +
								'background:rgb(70, 103, 167);' +
								'background:#4667a7;' +
								'color:white;' +
								'color:#FFFFFF;' +
								'font-size:0.75em;' +
								'padding:4px 45px;' +
								'white-space: nowrap;' +
								'font-weight:bold;' +
								'line-height:1.6;' +
							'}' +
							
							'.bndlr-volume-style-0 .bndlr-volume-saving-text a {' +
								'color:white;' +
								'color:#FFFFFF;' +
								'font-weight:bold;' +
								'line-height:1.6;' +
							'}' +
							
							'.product-single__box.js-product-single-actions.js-product-single-box .bundler-volume-target-element {' + // Special style for Venue theme
								'padding-left: 24px;'+
								'padding-right: 24px;'+
							'}' +
							
							'@media screen and (max-width: 980px) {' +
								'.product-single__box.js-product-single-actions.js-product-single-box .bundler-volume-target-element {' + // Special style for Venue theme
									'padding-left: 18px;'+
									'padding-right: 18px;'+
								'}' +
							'}' +
							
														
															'.bndlr-volume-discount .bndlr-volume-saving-text {'+
									'cursor:pointer;' +
								'}' +
																			
						
						/* Sectioned Mix & Match bundle style */
						'.bndlr-sectioned-mixnmatch {' +
							'width:100%;' +
							'max-width:1536px;' +
							'margin-left:auto;' +
							'margin-right:auto;' +
							'background: white;' +
							'border-radius: 5px;' +
							'margin-top: 10px !important;' +
							'margin-bottom: 10px !important;' +
							'padding: 10px 10px !important;' +
							'box-shadow: 1px 1px 1px rgba(128, 128, 128, 0.38);' +
							'border: 1px solid rgb(219, 219, 219);' +
							'background: rgb(247, 247, 247);' +
							'background: rgb(247, 247, 247);' +
							'color: #rgb(14, 27, 77);' +
							'color: rgb(14, 27, 77);' +
						'}' +
						
						'.bndlr-sections-main-container {' +
							'display:flex;' +
							'justify-content:center;' +
							'justify-content:space-between;' +
							//'background: white;' +
							//'padding: 5px;' +
						'}' +
						
						'.bndlr-section-main-title {' +
							'margin-bottom: 0.3em;' +
							'margin-top: 0.2em;' +
							'color: rgb(14, 27, 77);' +
						'}' +
						'.bndlr-section-description {' +
							'width:80%;' +
							'margin:0 auto;' +
							'margin-bottom: 10px;' +
							'opacity: 0.8;' +
						'}' +
						
						'.bndlr-sections-container {' +
							'flex: 1 1 100%;' +
						'}' +
						'.bndlr-sections-status-container {' +
							'text-align: left;' +
							'flex: 0 0 300px;' +
							'background:white;' +
							'background: rgb(255, 255, 255);' +
							'color: rgb(14, 27, 77);' +
							'border-left: 2px solid rgb(247, 247, 247);' +
							'padding:10px;' +
							'border-left: none;' +
							'border-radius: 5px;' +
							'box-shadow: 0px 0px 2px rgb(128, 128, 128);' +
						'}' +
						
						'.bndlr-section-title {' +
							'width: 100%;' +
							'font-size: 1.4em;' +
							'line-height: 2;' +
						'}' +
						
						'.bndlr-sectioned-section-name {' +
							'display:flex;' +
							'align-items: center;' +
							'cursor:pointer;' +
						'}' +
						
						'.bndlr-section-name-number {' +
							'width: calc(1.6em + 2px);' +
							'min-width: calc(1.6em + 2px);' +
							'max-width: calc(1.6em + 2px);' +
							'height: calc(1.6em + 2px);' +
							'min-height: calc(1.6em + 2px);' +
							'max-height: calc(1.6em + 2px);' +
							'border-radius: 50%;' +
							'text-align: center;' +
							'background: transparent;' +
							'border: 2px solid rgb(228, 228, 228);' +
							'border: 2px solid rgb(228, 228, 228);' +
							'margin: 4px 4px 4px 0;' +
							'align-self: flex-start;' +
						'}' +
						'.bndlr-section-name-text {' + 
							'font-size: 1em;' + 
							'line-height: 1.2;' + 
							'margin-bottom: 0px;' + 
							'margin-top: 0px;' + 
						'}' +
						
						'.bndlr-section-name-line {' +
							'flex-grow: 1;' +
							'margin: 0 0.5em;' +
							'display: flex;' +
							'background: rgb(247, 247, 247);' +
							'background: rgb(228, 228, 228);' +
							'height: 2px;' +
							'align-self: center;' +
							'border-radius: 1em;' +
						'}' +
						
						'.bndlr-sectioned-available-products {' +
							'flex-wrap: wrap;' +
							'justify-content: center;' +
							'margin-left: -10px;' +
							'margin-right: 0;' +
						'}' +
						
						'.bndlr-sectioned-section-products {' +
							'padding: 0 20px 40px;' +
							'padding: 0 0.5em 40px calc(1.6em + 7px);' +
							'margin-top: 10px;' +
						'}' +
						
						'.bndlr-sectioned-section {' +
							'display:flex;' +
							'flex-direction:column;' +
						'}' +
						
						'.bndlr-sectioned-section .bndlr-next-section {' +
							'display:none;' +
							'align-self: flex-end;' +
							'padding: 0.6em 1.2em;' +
							'background: rgb(67, 112, 183);' +
							'background: #4667A7;' +
							'background: #4667a7;' +
							'color: white;' +
							'color: #FFFFFF;' +
							'border-radius: 2px;' +
							'cursor: pointer;' +
							'margin-top: 10px;' +
							'margin-right: 5px;' +
						'}' +
						
						'.bndlr-sectioned-status-box-product-quantity {' +
							'position: absolute;' +
							'margin-top: -0.5em;' +
							'margin-left: -0.5em;' +
							'color: gray;' +
							//'color: rgb(128, 128, 128);' +
							'font-style: italic;' +
							'font-size: 0.8em;' +
							'line-height:1.5;' +
							'width:calc(1em * 1.5);' +
							'border-radius: 50%;' +
							'background: white;' +
							'box-shadow: 1px 1px 1px rgba(2, 2, 2, 0.41);' +
							'text-align: center;' +
						'}' +
						'.bndlr-sectioned-status-box-product-image {' +
							'width: 67px !important;' +
							'height: 67px !important;' +
							'object-fit: cover;' +
							'background: rgb(255, 255, 255);' +
							'box-shadow: 1px 1px 2px 0px rgba(0, 0, 0, 0.7);' +
							'display: block;' +
							'border-radius:3px;' +
						'}' +
						'.bndlr-sectioned-status-box-product .bndlr-close {' +
							'top:0;' +
							'right:0;' +
						'}' +
						
						'.bndlr-sectioned-mixnmatch.bndlr-container .bndlr-sections-status-container .bndlr-bundle-checkout-warning {' +
							'display:block;' +
						'}' +
						
						
						'.bndlr-sectioned-section-products .bndlr-sectioned-status-box-product {' +
							'width: 67px;' +
							'height: 67px;' +
							'display: inline-block;' +
							'margin: 0 10px 10px 0;' +
							'vertical-align:bottom;' +
							'position:relative;' +
						'}' +
						
						'.bndlr-sectioned-status-box-product .sealsubs-target-element.sealsubs-full {' +
							'display:none;' +
						'}' +
						
						
						
						/* Shine */
						'.bndlr-shine-animation {' +
							'position:relative;' +
							'overflow:hidden;' +
						'}' +
						
						'.bndlr-shine-animation:after {' +
							'content:"";' +
							'top:0;' +
							'left:0;' +
							'transform:translateX(-150%);' +
							'width:100%;' +
							'height:100%;' +
							'position: absolute;' +
							'z-index:1;' +
							'animation: bndlr-shine-keyframes 5s infinite 1s;' +
							'background: -moz-linear-gradient(left, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(128,186,232,0) 99%, rgba(125,185,232,0) 100%); /* FF3.6+ */' +
							'background: -webkit-gradient(linear, left top, right top, color-stop(0%,rgba(255,255,255,0)), color-stop(50%,rgba(255,255,255,0.8)), color-stop(99%,rgba(128,186,232,0)), color-stop(100%,rgba(125,185,232,0))); /* Chrome,Safari4+ */' +
							'background: -webkit-linear-gradient(left, rgba(255,255,255,0) 0%,rgba(255,255,255,0.8) 50%,rgba(128,186,232,0) 99%,rgba(125,185,232,0) 100%); /* Chrome10+,Safari5.1+ */' +
							'background: -o-linear-gradient(left, rgba(255,255,255,0) 0%,rgba(255,255,255,0.8) 50%,rgba(128,186,232,0) 99%,rgba(125,185,232,0) 100%); /* Opera 11.10+ */' +
							'background: -ms-linear-gradient(left, rgba(255,255,255,0) 0%,rgba(255,255,255,0.8) 50%,rgba(128,186,232,0) 99%,rgba(125,185,232,0) 100%); /* IE10+ */' +
							'background: linear-gradient(to right, rgba(255,255,255,0) 0%,rgba(255,255,255,0.8) 50%,rgba(128,186,232,0) 99%,rgba(125,185,232,0) 100%); /* W3C */' +
						'}' +

						/* animation */
						'@keyframes bndlr-shine-keyframes {' +
							'0% {'+
								'transform:translateX(-150%);'+
							'}' +
							'20% {'+
								'transform:translateX(150%);'+
							'}' +
							'100% {'+
								'transform:translateX(150%);'+
							'}' +
						'}' +
						'.bndlr-sectioned-section[data-requirements-fulfilled="true"] .bndlr-next-section {' +
							'display:block;' +
						'}' +
                        '.bndlr-sectioned-section[data-required-products-fulfilled="true"] .bndlr-sectioned-required-instructions-text {' +
							'display:none;' +
						'}' +
                         '.bndlr-sectioned-section[data-required-products-fulfilled="false"] .bndlr-sectioned-required-instructions-text {' +
                            'display:block;' +
                        '}' +			
						'[data-bundler-section] {' +
							'display:none;' +
						'}' +
						
													'[data-bundler-active-section="0"] [data-bundler-section="0"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="1"] [data-bundler-section="1"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="2"] [data-bundler-section="2"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="3"] [data-bundler-section="3"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="4"] [data-bundler-section="4"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="5"] [data-bundler-section="5"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="6"] [data-bundler-section="6"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="7"] [data-bundler-section="7"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="8"] [data-bundler-section="8"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="9"] [data-bundler-section="9"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="10"] [data-bundler-section="10"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="11"] [data-bundler-section="11"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="12"] [data-bundler-section="12"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="13"] [data-bundler-section="13"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="14"] [data-bundler-section="14"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="15"] [data-bundler-section="15"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="16"] [data-bundler-section="16"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="17"] [data-bundler-section="17"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="18"] [data-bundler-section="18"] {' +
								'display:flex;' +
							'}' +
													'[data-bundler-active-section="19"] [data-bundler-section="19"] {' +
								'display:flex;' +
							'}' +
												
													'[data-bundler-active-section="0"] [data-bundler-section-status="0"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="1"] [data-bundler-section-status="1"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="2"] [data-bundler-section-status="2"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="3"] [data-bundler-section-status="3"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="4"] [data-bundler-section-status="4"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="5"] [data-bundler-section-status="5"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="6"] [data-bundler-section-status="6"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="7"] [data-bundler-section-status="7"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="8"] [data-bundler-section-status="8"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="9"] [data-bundler-section-status="9"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="10"] [data-bundler-section-status="10"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="11"] [data-bundler-section-status="11"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="12"] [data-bundler-section-status="12"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="13"] [data-bundler-section-status="13"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="14"] [data-bundler-section-status="14"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="15"] [data-bundler-section-status="15"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="16"] [data-bundler-section-status="16"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="17"] [data-bundler-section-status="17"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="18"] [data-bundler-section-status="18"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
													'[data-bundler-active-section="19"] [data-bundler-section-status="19"] .bndlr-section-name-line {' +
								'background: #4667A7;' +
								'background: #4667A7;' +
							'}' +
												
						'.bndlr-product.bndlr-sectioned-product {' +
							'padding:0px;' +
							'border:none;' +
							'box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.37);' +
							'transition: box-shadow 0.3s cubic-bezier(.25,.8,.25,1);' +
						'}' +
						
						'.bndlr-mix-and-match.bndlr-product.bndlr-sectioned-product .bndlr-product-image-url {'+
							'margin-top:0;'+
							'margin-bottom:auto;'+
						'}'+
						
						'.bndlr-product.bndlr-sectioned-product:hover {' +
							'box-shadow: 0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22);' +
							'box-shadow: 3px 3px 10px rgba(0, 0, 0, 0.37);' +
							'box-shadow: 3px 3px 15px rgba(0, 0, 0, 0.37);' +
						'}' +
						'.bndlr-product.bndlr-sectioned-product .bndlr-product-image {' +
							'border-bottom-right-radius: 0;' +
							'border-bottom-left-radius: 0;' +
						'}' +
						
						
						'.bndlr-product.bndlr-sectioned-product .bndlr-select-variant {' +
							'margin: 5px 5px 0px 5px !important;' +
							'width: calc(100% - 10px);' +
						'}' +
						
						'.bndlr-product.bndlr-sectioned-product .bndlr-product-options-container {' +
							'margin: 5px 5px 0px 5px !important;' +
							'padding:0;' +
							'width: calc(100% - 10px);' +
						'}' +
						'.bndlr-product.bndlr-sectioned-product .bndlr-product-options-container .bndlr-select-variant {' +
							'margin: 5px 6px 0px 5px !important;' + // The right margin has 1 more pixel because of the border
							'width: calc(100% - 11px);' +
						'}' +
						'.bndlr-product.bndlr-sectioned-product .bndlr-product-options-container .bndlr-select-option {' +
							'margin: 5px 0px 5px 5px !important;' +
							'margin: 0px !important;' +
						'}' +
						'.bndlr-add-to-sectioned-bundle {' +
							'margin: 5px 5px 0px 5px;' +
							'width: calc(100% - 10px);' +
						'}' +
						
						'.bndlr-sections-container .bndlr-product.bndlr-sectioned-product {' +
							'max-width:220px;' +
							'background:white;' +
							'background:#FFFFFF;' +
							'color:rgb(40, 40, 40);' +
							'border-radius: 5px;' +
							'padding-bottom:5px;' +
						'}' +
						'.bndlr-sections-container .bndlr-product.bndlr-sectioned-product .bndlr-product-title {' +
							'color:rgb(40, 40, 40) !important;' +
							'word-wrap: break-word;' +
						'}' +
						'.bndlr-sectioned-mixnmatch .bndlr-products-container {' +
							'width:100%;' +
							'display:block;' +
							'padding:0;' +
							'margin:0;' +
						'}' +
						
						'.bndlr-sections-status-container .bndlr-bundle-checkout-warning {' +
							'width:98%;' +
							'text-align: center;' +
						'}' +
						
						'.bndlr-sectioned-section-status {' +
							'position:relative;' +
							'min-height:60px;' +
						'}' +
						'.bndlr-section-name-connector-line {' +
							'position: absolute;' +
							'left: calc(0.8em + 0px);' +
							'height: calc(100% - 1.6em - 14px);' +
							'background: transparent;' +
							'width: 2px;' +
							'top: calc(1.6em + 11px);' +
							'overflow:hidden;' +
							//'border:1px dashed rgba(0, 0, 0, 0.4);' +
							//'border-right:2px solid rgb(247, 247, 247);' +
						'}' +
						
						'.bndlr-section-name-connector-line .bndlr-dashed-line {' +
							'stroke: rgb(228, 228, 228);' +
							'stroke: rgb(228, 228, 228);' +
							'stroke-width: 3px;' +
							'stroke-dasharray: 7px 2px;' +
							'fill: none;' +
							'animation: bndlr_dashoffset 8s linear infinite;' +
						'}' +

						'@keyframes bndlr_dashoffset {' +
							'from {' +
								'stroke-dashoffset: 43;' +
								'-webkit-transform: translate3d(0, 0, 0);' +
								'transform: translate3d(0, 0, 0);' +
							'}' +
							'to {' +
								'stroke-dashoffset: 0;' +
								'-webkit-transform: translate3d(0, 0, 0);' +
								'transform: translate3d(0, 0, 0);' +
							'}' +
						'}' +
						
						'.bndlr-sectioned-section-name:hover .bndlr-section-name-number {' +
							'border-color:#4667A7;' +
							'border-color:#4667A7;' +
						'}' +
						'.bndlr-sectioned-section-name:hover {' +
							'color:#4667A7;' +
							'color:#4667A7;' +
						'}' +
						'.bndlr-sectioned-section-name:hover .bndlr-section-name-text {' +
							'color:#4667A7;' +
							'color:#4667A7;' +
							'text-decoration:underline;' +
						'}' +
						
						
						'[data-requirements-fulfilled="true"] .bndlr-section-name-connector-line .bndlr-dashed-line {' +
							'stroke:#4667A7;' +
							'stroke: #4667A7;' +
						'}' +
						'[data-requirements-fulfilled="true"] .bndlr-section-name-number {' +
							'border-color: #4667A7;' +
							'border-color: #4667A7;' +
							'background: #4667A7;' +
							'background: #4667A7;' +
							'color: white;' +
							'color: rgb(255, 255, 255);' +
						'}' +
						'.bndlr-section-name-checkmark {' +
							'display:none;' +
						'}' +
						'.bndlr-section-name-checkmark svg {' +
							'stroke:#4667A7;' +
							'stroke:#4667A7;' +
						'}' +
						'[data-requirements-fulfilled="true"] .bndlr-section-name-checkmark {' +
							'display:block;' +
						'}' +
						'[data-requirements-fulfilled="true"] + [data-requirements-fulfilled="false"] .bndlr-section-name-text {' +
							'transform-origin:center center;' +
							'animation: bndlr-tilt-n-shake-animation 0.35s 5 linear;' +
						'}' +
						
						'.bndlr-add-sectioned-bundle-to-cart:not(.bndlr-disabled) {' +
							'animation: bndlr-tilt-n-shake-animation 0.35s 1 linear;' +
						'}' +
						
						'@keyframes bndlr-tilt-n-shake-animation {' +
							'0% { transform: rotate(0deg); }' +
							'25% { transform: rotate(5deg); }' +
							'50% { transform: rotate(0eg); }' +
							'75% { transform: rotate(-5deg); }' +
							'100% { transform: rotate(0deg); }' +
						'}' +
						
						'@media only screen and (max-width: 768px) {' +
							'.bndlr-sections-main-container {' +
								'flex-direction: column-reverse;' +
							'}' +
							'.bndlr-sections-status-container {' +
								'margin-left: 0;' +
								'margin-bottom: 10px;' +
								'border-radius: 0;' +
							'}' +
							'.bndlr-sections-main-container {' +
								'padding-left:0;' +
								'padding-right:0;' +
							'}' +
							'.bndlr-sectioned-mixnmatch .bndlr-products-container {' +
								'padding-left:0;' +
								'padding-right:0;' +
							'}' +
						'}' +
						
						/* END OF Sectioned Mix & Match bundle style */
						
						'.bndlr-product .shopify-product-reviews-badge:empty {' +
							'display:none;' +
						'}' +
						
						
						'#bundler-target-element:empty, .bundler-target-element:empty, .bundler-volume-target-element:empty {' + // Fix for Dawn theme
							'display:block !important;' +
						'}' +
						
						'#__pf [data-pf-type="Section"] .bundler-volume-target-element {' + // Fix for Dawn theme
							'max-width:500px;' +
						'}' +
						
																																																																																																																														
													// Align elements version 2
							'.bndlr-inner-products-container > div:first-child {' + 
								'display: flex;' +
								'flex-wrap: wrap;' +
								'justify-content: center;' +
							'}' +
							'.bndlr-product {' + 
								'display: flex;' +
								'flex-direction: column;' +
								'justify-content: center;' +
							'}' +
							
							'.bndlr-product-image-url {' +
								'margin-top:auto;' +
								'margin-bottom:auto;' +
							'}' +
							
							/*
							// To align the product image at the top and make the products the same width
							// Will look good if images are the same height and some of the products don't have variant selectors.
							// Will look bad if images are NOT the same height and some of the products don't have variant selectors.
							'.bndlr-product-image-url {'+
								'margin-top:0;'+
								'margin-bottom:0;'+
							'}'+
							'.bndlr-bottom-pusher {'+
								'margin-bottom:auto;'+
							'}'+
							// Make products same width
							'.bndlr-landing-page .bndlr-product {'+
								'flex:1 1 0px;'+ // Could cause issue in IE
							'}'+
							*/
							
							// IE fixes
							'_:-ms-lang(x), .bndlr-inner-products-container > div:first-child {' + 
								'display: block;' +
							'}' +
							'_:-ms-lang(x), .bndlr-product {' + 
								'display: inline-block;' +
							'}' +/*
							'_:-ms-lang(x), .bndlr-bottom-pusher {' +
								'margin-top:0;' +
							'}' +*/
							'_:-ms-lang(x), .bndlr-product-image-url {' +
								'margin-top:0;' +
								'margin-bottom:0;' +
							'}' +
							/*
							'.bndlr-product-image-url {' + // Makes the picture centered and other info at the bottom. 
								'flex: 1 1 auto;' +
								'justify-content: center;' +
								'display: flex;' +
								'align-items: center;' +
							'}' +*/
							
															'.bndlr-product-image-url {'+
									'margin-top:0;'+
									'margin-bottom:auto;'+
								'}'+
								'.bndlr-bottom-pusher {'+
									'margin-bottom:unset;'+
								'}'+
													
						'.bndlr-mnm-available-products, .bndlr-mnm-selected-products {' + 
							'display: flex;' +
							'flex-wrap: wrap;' +
							'justify-content: center;' +
						'}' +
						'.bndlr-product.bndlr-mix-and-match {' + 
							'display: flex;' +
							'flex-direction: column;' +
							'justify-content: center;' +
							'flex: 1 1 auto;' +
						'}' +
						'.bndlr-mix-and-match .bndlr-product-image-url {' +
							'margin-top:auto;' +
							'margin-bottom:auto;' +
						'}' +
						'.bndlr-mix-and-match .bndlr-bottom-pusher {' +
							'margin-bottom:unset;' +
						'}' +
						// IE fixes
						'_:-ms-lang(x), .bndlr-mnm-available-products, .bndlr-mnm-selected-products {' + 
							'display: block;' +
						'}' +
						'_:-ms-lang(x), .bndlr-product.bndlr-mix-and-match {' + 
							'display: inline-block;' +
						'}' +
						'_:-ms-lang(x), .bndlr-mix-and-match .bndlr-product-image-url {' +
							'margin-top:0;' +
							'margin-bottom:0;' +
						'}' +
						
													'.bndlr-mix-and-match .bndlr-product-image-url {'+
								'margin-top:0;'+
								'margin-bottom:auto;'+
							'}'+
							'.bndlr-mix-and-match .bndlr-bottom-pusher {'+
								'margin-bottom:unset;'+
							'}'+
												
													// Custom bounce animation :D
							'@keyframes bdnlr-bounce {' +
								'0%, 10%, 27%, 40%, 50% {' +
									'-webkit-animation-timing-function: cubic-bezier(.215, .61, .355, 1);' +
									'-webkit-transform: translateZ(0);' +
									'animation-timing-function: cubic-bezier(.215, .61, .355, 1);' +
									'transform: translateZ(0);' +
								'}' +
								'20%, 21% {' +
									'-webkit-animation-timing-function: cubic-bezier(.755, .05, .855, .06);' +
									'-webkit-transform: translate3d(0, -20px, 0);' +
									'animation-timing-function: cubic-bezier(.755, .05, .855, .06);' +
									'transform: translate3d(0, -20px, 0);' +
								'}' +
								'35% {' +
									'-webkit-animation-timing-function: cubic-bezier(.755, .05, .855, .06);' +
									'-webkit-transform: translate3d(0, -10px, 0);' +
									'animation-timing-function: cubic-bezier(.755, .05, .855, .06);' +
									'transform: translate3d(0, -10px, 0);' +
								'}' +
								'45% {' +
									'-webkit-transform: translate3d(0, -4px, 0);' +
									'transform: translate3d(0, -4px, 0);' +
								'}' +
							'}' +
							'.bndlr-add-to-cart, .bndlr-add-bundle-to-cart {' +
								'-moz-animation: bdnlr-bounce 2s infinite;' +
								'-webkit-animation: bdnlr-bounce 2s infinite;' +
								'animation: bdnlr-bounce 2s infinite;' +
								'-moz-transform-origin: center bottom;' +
								'-webkit-transform-origin: center bottom;' +
								'transform-origin: center bottom;' +
							'}' +
												
						// 2020-03-12 make padding and margin smaller for custom bundle elements
						'.bundler-target-element[data-bndlr-ccid] .bndlr-container {' +
							'margin-top:10px;' +
							'padding-top:10px;' +
						'}' +
						
						'.bndlr-medium .bndlr-product {' +
							'max-width:190px;' +
						'}' +
						
													'.sealsubs-target-element-bundle {' +
								'max-width: 710px;' +
								'width:calc(100% - 10px);' +
								'margin: 5px auto 0 auto;' +
							'}' +
							'.bndlr-mnm-add-to-cart-wrapper .sealsubs-target-element-bundle {' +
								'width: 100%;' +
							'}' +
							
							'.bndlr-product .sealsubs-target-element {' +
								'flex: unset;' +
							'}' +
												
						
						'.bundler-widgets-side-by-side, .bundler-widgets-side-by-side #bundler-target-element, .bundler-widgets-side-by-side .side-by-side-inner-element {' +
							'display: flex;' +
							'clear: both;' +
							'max-width: 1500px;' +
							'margin: 0 auto;' +
							'flex-wrap:wrap;' +
						'}' +
						'.bundler-widgets-side-by-side .bundler-target-element {' +
							'display: flex;' +
							'flex: 1 1 auto;' +
							//'flex: 1 1 0px;' +
							'align-self: flex-end;' +
							'justify-content: center;' +
							'max-width:740px;' +
							'min-width: 320px;' +
						'}' +
						'.bundler-widgets-side-by-side .bndlr-products-container {' +
							'display:block;' +
						'}' +
						
						'.number_total.bundler-cart-price-info-container-inline {' +
							'flex-direction:row !important;' +
						'}' +
						
						'.bndlr-product .giraffly_Quickbuy, .bndlr-sectioned-status-box-product .giraffly_Quickbuy {' +
							'display:none !important;' +
						'}' +
						'.bndlr-sr-only {' +
							'border: 0;' +
							'clip: rect(0,0,0,0);' +
							'height: 1px;' +
							'margin: -1px;' +
							'overflow: hidden;' +
							'padding: 0;' +
							'position: absolute;' +
							'width: 1px;' +
						'}' +
						
					'</style>');
					
					if (nav.isShopPage() === false) {
						// We are on a third party page
						// Append special style
						$body.append('<style>' +
							'.bndlr-container {' +
								'margin-top:0;' +
								'padding-top:0;' +
							'}' +
						'</style>');
					}
					
										
										
											document.addEventListener('sealsubs:price_update', function(e) { 
							bndlr.processPriceUpdate(e.detail);
						});
										
					if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.theme !== 'undefined' && typeof window.Shopify.theme.name === 'string' && (window.Shopify.theme.name === 'Flow' || window.Shopify.theme.name.indexOf('Streamline') !== -1)) {

						document.addEventListener('bundler:bundle_widget_created', function() {
							// Trigger a resize of the widnow event so that the footer gets repositioned
							debounce('window-resize', function() {
								window.dispatchEvent(new Event('resize'));
							}, 200);
						});
					}
					
					
					if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.theme !== 'undefined' && typeof window.Shopify.theme.theme_store_id !== 'undefined' && window.Shopify.theme.theme_store_id === 730) {
						document.addEventListener('bundler:bundle_widget_created', function() {
							// Trigger a resize of the widnow event so that the footer gets repositioned
							debounce('window-resize', function() {
								//window.dispatchEvent(new Event('resize'));
							}, 200);
						});
					}
					
					if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.theme !== 'undefined' && typeof window.Shopify.theme.theme_store_id !== 'undefined' && window.Shopify.theme.theme_store_id === 829) {
						document.addEventListener('bundler:bundle_widget_created', function() {
							// Trigger a resize of the widnow event so that the footer gets repositioned
							debounce('window-resize', function() {
								window.dispatchEvent(new Event('resize'));
							}, 200);
						});
					}
					
										
					
										
					if (typeof clientSpecifics['init'] !== 'undefined') {
						clientSpecifics['init'].trigger();
					}
					
										
					
										/*
					
					function init() {};

					init.prototype.trigger = function() {
						window.OCUDisableEvents=true;
					}
					
					clientSpecifics['init'] = new init();
					
					*/
					
										
										
																							if (typeof window.OCUApi !== 'undefined') {
							
							var OCUcallbackBeforeRedirect = function() {
								
								var simPromise = new Promise((resolve, reject) => {
									return false; // Return false and take care of the checkout on our own 
								});

								bndlr.prepareInvoice(undefined, undefined, false);
								
								return simPromise;
							}
							
							window.OCUApi.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							
							// Set this again because some stores overwrote after page load with timeout of 1000 and 2000 ms.
							setTimeout(function() {
								window.OCUApi.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							}, 2000);
							
							setTimeout(function() {
								window.OCUApi.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							}, 5000);
							
							setTimeout(function() {
								window.OCUApi.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							}, 8000);
						}
						
						if (typeof window.Zipify !== 'undefined' && typeof window.Zipify.OCU !== 'undefined' && typeof window.Zipify.OCU.api !== 'undefined') {
							
							var OCUcallbackBeforeRedirect = function() {
								
								var simPromise = new Promise((resolve, reject) => {
									return false; // Return false and take care of the checkout on our own 
								});

								bndlr.prepareInvoice(undefined, undefined, false);
								
								return simPromise;
							}
							
							window.Zipify.OCU.api.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							
							// Set this again because some stores overwrote after page load with timeout of 1000 and 2000 ms.
							setTimeout(function() {
								window.Zipify.OCU.api.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							}, 2000);
							
							setTimeout(function() {
								window.Zipify.OCU.api.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							}, 5000);
							
							setTimeout(function() {
								window.Zipify.OCU.api.callbackBeforeRedirect = OCUcallbackBeforeRedirect;
							}, 8000);
						}
					
										
										if (typeof window.theme !== 'undefined' && typeof window.theme.goToCheckoutWithDiscount === 'function') {
						var origGotoCheckout = window.theme.goToCheckoutWithDiscount;
						window.theme.goToCheckoutWithDiscount = function() {
							window.bndlr.getCheckoutInfo(function(data) {
								if (typeof data.url !== 'undefined' && data.url.length > 0) {
									window.location.href = data.url;
								} else {
									origGotoCheckout();
								}
							});
						};
					}
					
					
					
					//$('body').append('<div id="bndlr-loaded"></div>');

					//bundlerConsole.info('%c App loaded: Bundler - Product Bundles (6E):', 'background: #1960bc; color: #fff', 'https://apps.shopify.com/bundler-product-bundles');
				},
				// It would be nicer to define this function in the bndlr object.
				canShowFloatingStatusBox: function() {
					if (typeof window.BndlrIsBundleLandingPage !== 'undefined' && window.BndlrIsBundleLandingPage === true) {
						return true;
					}
					
															
					return false;
				},
				canAttachMixnMatchAddToCartListeners: function() {
					if (typeof window.BndlrIsBundleLandingPage !== 'undefined' && window.BndlrIsBundleLandingPage === true) {
						return true;
					}

										
					return false;
				},
				convertCurrency: function(selector) {
					
										
					if (typeof selector === 'undefined') {
						selector = '.bndlr-product .bndlr-money, .bndlr-total-price .bndlr-money';
					}

					if (typeof DoublyGlobalCurrency !== 'undefined' && typeof DoublyGlobalCurrency.currentCurrency !== 'undefined' && typeof DoublyGlobalCurrency.convertAll !== 'undefined') {

						try {
							var newCurrency = DoublyGlobalCurrency.currentCurrency;
							DoublyGlobalCurrency.convertAll(newCurrency, selector);
						} catch(e) {}
						
					} else if (typeof Currency !== 'undefined' && typeof Currency.currentCurrency !== 'undefined' && typeof Currency.convertAll !== 'undefined') {

						var oldCurrency = bndlr.getDefaultCurrency();
						var newCurrency = Currency.currentCurrency;

						// Convert currency if old currency is not the same as new currency
						// if currency rate is set to 1.0, which means that the conversion was not automatically performed by Shopify backend
						if (oldCurrency !== newCurrency && 
							newCurrency !== '' && 
							typeof Shopify !== 'undefined' && 
							typeof Shopify.currency !== 'undefined' && 
							typeof Shopify.currency.rate !== 'undefined' &&
							Shopify.currency.rate === "1.0") {

															try {
									Currency.convertAll(oldCurrency, newCurrency, selector);
								} catch(e) {
									// New currency can sometimes be empty string and an error will occur
									// TODO check why does this happen
								}
													}
					}
					
					if (typeof conversionBearAutoCurrencyConverter !== 'undefined' && typeof conversionBearAutoCurrencyConverter.convertPricesOnPage === 'function') {
						conversionBearAutoCurrencyConverter.convertPricesOnPage();
					}
					
										
										
					if (typeof BOLDCURRENCY !== 'undefined' && typeof BOLDCURRENCY.converter !== 'undefined' && typeof BOLDCURRENCY.converter.refresh !== 'undefined') {								
						BOLDCURRENCY.converter.refresh();
					}
					
					if (typeof window.bucksCC !== 'undefined' && typeof window.bucksCC.reConvert === 'function') {
						try {
							bucksCC.reConvert();
						} catch(e) {
							console.log(e);
						}
					}
					
					// ((window || {}).bucksCC || {}).reConvert && bucksCC.reConvert()

											if (typeof window.baCurr !== 'undefined' && typeof window.baCurr.refreshConversion === 'function') {
							try {
								window.baCurr.refreshConversion();
							} catch(e) {
								console.log(e);
							}
						}
										
					// luxespaceofficial
					if (typeof window.store !== 'undefined' 
						&& typeof window.store.update !== 'undefined' 
						&& typeof window.GemCurrency !== 'undefined' 
						&& typeof window.GemCurrency.currentCurrency !== 'undefined') {
							try {
								window.store.update('dataCurrency', window.GemCurrency.currentCurrency);
							} catch(e) {
								console.log(e);
							}
						}
				},
				canUseCheckout: function() {
											// Function which is exposed to external apps so they can check if the Bundler can checkout (sealsubs).
						return bndlr.useBundlerCheckout && bndlr.externalAppPreventCheckout.canCheckout();
									},
				preparingCheckout: false,
				prepareInvoice: function(fallbackToCheckout, callback, triggerNormalCheckout) {
					
					var cartBotIsWorking = false;
					
					if (typeof window.cartbot !== 'undefined' && typeof window.cartbot.applyBots === 'function') {
						cartBotIsWorking = window.cartbot.applyBots();
					}
					
					if (cartBotIsWorking === false) {
					
						if (typeof clientSpecifics['on_prepare_invoice'] !== 'undefined') {
							clientSpecifics['on_prepare_invoice'].trigger(fallbackToCheckout, callback, triggerNormalCheckout);
						} else {
							bndlr._prepareInvoice(fallbackToCheckout, callback, triggerNormalCheckout);
						}
					}
				},
				_prepareInvoice: function(fallbackToCheckout, callback, triggerNormalCheckout) {
					// Main function to trigger invoice creation
					// Don't use this/self, so we can call the method from external apps

					if (bndlr.preparingCheckout !== false) {
						var lastStartedAt = bndlr.preparingCheckout;
						if (Date.now() < (lastStartedAt+1500)) {
							// Skip this call if we started it already in less than 1.5 seconds
							return true;
						}
					}
					bndlr.preparingCheckout = Date.now();
					
					
					if (typeof fallbackToCheckout === 'undefined') {
						fallbackToCheckout = true;
					}
					// triggerNormalCheckout is used to trigger a checkout from external apps and prevent an infinite loop, as the customer gets redirected directly to the checkout apage
					if (typeof triggerNormalCheckout === 'undefined') {
						triggerNormalCheckout = true;
					}
					
					
					var canPrepareInvoice = true;
					if (typeof clientSpecifics['before_prepare_invoice'] !== 'undefined') {
						canPrepareInvoice = clientSpecifics['before_prepare_invoice'].canPrepareInvoice();
					}
					
					if (canPrepareInvoice === false) {
						return;
					}
					
					cart.get('default', false).done(function(cartData) {

							//cartData = bndlr.fixCartPrices(cartData);

							// Get checkout note
							var cartNoteSelector = '#CartSpecialInstructions, .cart-note__input, #note, [name="cart[note]"], [name="note"]';
							if ($(cartNoteSelector).first().length > 0 && $(cartNoteSelector).first().val().length > 0) {
								cartData.note = $(cartNoteSelector).first().val();
							}
							
														
								try {
									if (nav.isCartPage() && $('.bundler-target-element').length === 0) {
										// Check if we are on the cart page and there isn't any bundle offer on it.
										// Find any input items on cart page, loop through them and change the quantity if needed
										var cartItemKeyRegex = /\d+:[a-z0-9]+/;
										$('[name="updates[]"]').each(function(key, el) {
											
											if ($(el).is(':visible')) {
												// Check quantity only for visible elements (zany-zeus)
												
												var quantityWasFixed = false;
												
												var id = $(el).attr('id');
												
												if (typeof id !== 'string') {
													id = $(el).attr('data-id');
												}

												if (typeof id === 'string') {
													var match = id.match(cartItemKeyRegex);
													
													if (match !== null && typeof match[0] === 'string') {
														var itemKey = match[0];
														var itemQuantity = $(el).val()*1;
														
														if (itemQuantity > 0) {
															// Loop thorugh cart items and correct quantity if needed
															for (var j = 0; j<cartData.items.length; j++) {
																if (cartData.items[j].key === itemKey && cartData.items[j].quantity != itemQuantity) {

																	// Set new item quantity
																	cartData.items[j].quantity 				= itemQuantity;
																	cartData.items[j].line_price 			= itemQuantity*cartData.items[j].price; // No need to actually set this, just the quantity is important
																	cartData.items[j].original_line_price 	= itemQuantity*cartData.items[j].original_price; // No need to actually set this, just the quantity is important
																	cartData.items[j].final_line_price 		= itemQuantity*cartData.items[j].final_price; // No need to actually set this, just the quantity is important
																}
															}
															
															quantityWasFixed = true;
														}
													}
												}
												
												if (quantityWasFixed === false) {
													var index = $(el).attr('data-index');
													
													if (typeof index === 'string') {
														var index = index*1;
														if (index > 0) {
															var itemQuantity = $(el).val()*1;
																if (itemQuantity > 0) {
																// Loop thorugh cart items and correct quantity if needed
																for (var j = 0; j<cartData.items.length; j++) {
																	if ((j+1) === index && cartData.items[j].quantity != itemQuantity) {

																		// Set new item quantity
																		cartData.items[j].quantity 				= itemQuantity;
																		cartData.items[j].line_price 			= itemQuantity*cartData.items[j].price; // No need to actually set this, just the quantity is important
																		cartData.items[j].original_line_price 	= itemQuantity*cartData.items[j].original_price; // No need to actually set this, just the quantity is important
																	cartData.items[j].final_line_price 		= itemQuantity*cartData.items[j].final_price; // No need to actually set this, just the quantity is important
																	}
																}

																quantityWasFixed = true;
															}
														}
													}
												}
											}
										});
									}
								} catch(e) {
									console.error(e);
									bndlr.preparingCheckout = false;
								}
								
														
							try {
								// Use try catch block as this is not core functionality
								// Get attributes for Zapiet Pickup & delivery app
								var cartSelector = 'form[action="/cart"][method="post"], form.cart[method="post"], #cart form, form[action^="/cart?"][method="post"]';

								if ($(cartSelector).length > 0) {
									// Get checkout url with attributes
									var url = $(cartSelector).attr('action');
									var urlParams = url.match(/(?:cart\?)(.*)/);

									var additionalParams = {}
									if (urlParams !== null && typeof urlParams[1] !== 'undefined' && urlParams[1].length > 0) {
										// Url has some extra parameters
										additionalParams = nav.getQueryParams(urlParams[1]);
										bndlr.setCheckoutParams(additionalParams);
									}
									
									// Get attributes
									$(cartSelector).find('input[name^="attributes["], select[name^="attributes["], textarea[name^="attributes["]').each(function(ix, el) {
										if (typeof cartData.attributes === 'undefined') {
											// Set attributes key if it is missing
											cartData.attributes = {}
										}


										
										var key = $(el).attr('name').replace('attributes[', '').replace(']', '');
										var value = $(el).val();
										
											
										var $el = $(el);
										var addAttribute = true;
										if ($el.attr('type') === 'checkbox') {
											if ($el.is(':checked') === false) {
												// Only the checked checkboxes are sent to the server
												addAttribute = false;
											}
										}
										
										// Check if value is not empty string or if the attribute doesn't yet exist in the cart data.
										if (addAttribute && ((value !== '' && value !== null) || typeof cartData.attributes[key] == 'undefined')) {
											// Add attribute to cart data
											cartData.attributes[key] = value;
											
											additionalParams['attributes['+key+']'] = value;
										}
									});
									
									bndlr.setCheckoutParams(additionalParams);
									
								}
							} catch(e) {
								bundlerConsole.log(e);
								bndlr.preparingCheckout = false;
							}

							var hasToApplyLegacyDiscounts = true;
							try {
								// This has to be in a try-catch block so that we don't break the checkout if something goes wrong in the discount estimator
								var updatedCartBeforeCheckout = DiscountEstimator.updateCartWithDiscounts(cartData);

								hasToApplyLegacyDiscounts = updatedCartBeforeCheckout.has_to_apply_legacy_discounts;
							} catch(e) {
								console.log(e.message);
							}
							
							var withExtraInfo = false;
							if (typeof window.discountOnCartProApp !== 'undefined' && typeof window.discountOnCartProApp.applyCode === 'function') {
								withExtraInfo = true;
							}
						
							var process = function() {
								bndlr.getInvoice(cartData, withExtraInfo, '', hasToApplyLegacyDiscounts).done(function(data) {
									if (typeof callback === 'function') {
										//$('.bndlr-add-to-cart').removeClass('bndlr-loading');
										callback();
									} else {
										bndlr.useInvoice(data, triggerNormalCheckout, cartData);
									}
									bndlr.preparingCheckout = false;
									
								}).fail(function(f) {
									//bundlerConsole.log('Something went wrong.');
									//bundlerConsole.log('Falling back to normal checkout.');
									if (fallbackToCheckout === true) {
										// Fallback to normal checkout url
										window.location.href = bndlr.addCheckoutParams('/checkout');
									} else {
										$('.bndlr-add-to-cart').removeClass('bndlr-loading');
									}
									
									bndlr.preparingCheckout = false;
								});
							};
							
							var processWasSet = false;
							
													
							
														
							if (processWasSet === false) {
								process();
							}
						
							
					});
					
				},
				getCartData: function(successCallback) {
					cart.get('default', false).done(function(cartData) {
						
						//cartData = bndlr.fixCartPrices(cartData);
						
						// Get checkout note
						var cartNoteSelector = '#CartSpecialInstructions, .cart-note__input, #note, [name="cart[note]"], [name="note"]';
						if ($(cartNoteSelector).first().length > 0 && $(cartNoteSelector).first().val().length > 0) {
							cartData.note = $(cartNoteSelector).first().val();
						}
						
						try {
							if (nav.isCartPage() && $('.bundler-target-element').length === 0) {
								// Check if we are on the cart page and there isn't any bundle offer on it.
								// Find any input items on cart page, loop through them and change the quantity if needed
								var cartItemKeyRegex = /\d+:[a-z0-9]+/;
								$('[name="updates[]"]').each(function(key, el) {
									var id = $(el).attr('id');

									if (typeof id === 'string') {
										var match = id.match(cartItemKeyRegex);
										if (match !== null && typeof match[0] === 'string') {
											var itemKey = match[0];
											var itemQuantity = $(el).val()*1;
											if (itemQuantity > 0) {
												// Loop thorugh cart items and correct quantity if needed
												for (var j = 0; j<cartData.items.length; j++) {
													if (cartData.items[j].key === itemKey && cartData.items[j].quantity != itemQuantity) {
														// Set new item quantity
														cartData.items[j].quantity 				= itemQuantity;
														cartData.items[j].line_price 			= itemQuantity*cartData.items[j].price; // No need to actually set this, just the quantity is important
														cartData.items[j].original_line_price 	= itemQuantity*cartData.items[j].original_price; // No need to actually set this, just the quantity is important
														cartData.items[j].final_line_price 		= itemQuantity*cartData.items[j].final_price; // No need to actually set this, just the quantity is important
													}
												}
											}
										}
									}
								});
							}
						} catch(e) {
							console.error(e);
						}
						
						try {
							// Use try catch block as this is not core functionality
							// Get attributes for Zapiet Pickup & delivery app
							var cartSelector = 'form[action="/cart"][method="post"], form.cart[method="post"], #cart form';
							if ($(cartSelector).length > 0) {
								// Get checkout url with attributes
								var url = $(cartSelector).attr('action');
								var urlParams = url.match(/(?:cart\?)(.*)/);
								if (urlParams !== null && typeof urlParams[1] !== 'undefined' && urlParams[1].length > 0) {
									// Url has some extra parameters
									var additionalParams = nav.getQueryParams(urlParams[1]);
									bndlr.setCheckoutParams(additionalParams);
								}
								
								// Get attributes
								$(cartSelector).find('input[name^="attributes["], select[name^="attributes["], textarea[name^="attributes["]').each(function(ix, el) {
									if (typeof cartData.attributes === 'undefined') {
										// Set attributes key if it is missing
										cartData.attributes = {}
									}
									
									var key = $(el).attr('name').replace('attributes[', '').replace(']', '');
									var value = $(el).val();
									
										
									var $el = $(el);
									var addAttribute = true;
									if ($el.attr('type') === 'checkbox') {
										if ($el.is(':checked') === false) {
											// Only the checked checkboxes are sent to the server
											addAttribute = false;
										}
									}
									
									// Check if value is not empty string or if the attribute doesn't yet exist in the cart data.
									if (addAttribute && ((value !== '' && value !== null) || typeof cartData.attributes[key] == 'undefined')) {
										// Add attribute to cart data
										cartData.attributes[key] = value;
									}
									
									
								});
								
							}
						} catch(e) {
							bundlerConsole.log(e);
						}
					
						if (typeof successCallback === 'function') {
							successCallback(cartData);
						}
					});
				},
				gettingCheckoutInfo: false,
				getCheckoutInfo: function(callback) { // A method, used by an external JavaScript API to get info about the checkout 
					// Don't use this/self, so we can call the method from external apps

					if (bndlr.gettingCheckoutInfo !== false) {
						var lastStartedAt = bndlr.gettingCheckoutInfo;
						if (Date.now() < (lastStartedAt+1500)) {
							// Skip this call if we started it already in less than 1.5 seconds
							return true;
						}
					}
					bndlr.gettingCheckoutInfo = Date.now();
					
					bndlr.getCartData(function(cartData) {

						var updatedCartBeforeCheckout = DiscountEstimator.updateCartWithDiscounts(cartData);
						var hasToApplyLegacyDiscounts = updatedCartBeforeCheckout.has_to_apply_legacy_discounts;
						
						if (cartData.items.length > 0) {

							bndlr.getInvoice(cartData, true, 'getCheckoutInfo', hasToApplyLegacyDiscounts).done(function(data) {
								if (typeof callback === 'function') {
									data.can_apply_discount = false;
									if (typeof data.url !== 'undefined' && data.url !== '/checkout') {
										data.can_apply_discount = true;
									}
									callback(data);
								}
								bndlr.gettingCheckoutInfo = false;
								
																	// cosmix-superfood.myshopify.com
									
									if (typeof data.code === 'string') {										
										try {
											bndlr.setCookie('discount_code', data.code, 0);
										} catch(e) {
											console.log(e);
										}
									}
								
																
							}).fail(function(f) {
								if (typeof callback === 'function') {
									callback({
										can_apply_discount: false
									});
								}						
								bndlr.gettingCheckoutInfo = false;
							});
						} else {
							callback({
								can_apply_discount: false
							});
						}
					});
					
				},
				getInvoice: function(cartData, withExtraInfo, source, hasToApplyLegacyDiscounts) {			
					if (typeof withExtraInfo === 'undefined') {
						withExtraInfo = false;
					}
					
					if (typeof source === 'undefined') {
						source = '';
					}
					
					var additionalGetParams = '';
					if (source !== '') {
						additionalGetParams = '&from='+source;
					}
					
					var exchangeRate = 1;
					if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.currency !== 'undefined' && typeof window.Shopify.currency.rate !== 'undefined') {
						exchangeRate = window.Shopify.currency.rate;
					}
					
					var country = '';
					if (typeof window.Shopify !== 'undefined' && typeof window.Shopify.country === 'string') {
						country = window.Shopify.country;
					}
					
					
					// If we only have the non-legacy bundles, or if there is a subscription product in the cart, don't proceed with cdo.php execution.
					// cdo.php needs to execute only as a fallback in the cases where a new discount function cannot handle cases.
					// We return an empty promise here
					if (hasToApplyLegacyDiscounts === false) {
						 // Create a fake resolved promise
						const fakePromise = $.Deferred().resolve({
							url: "/checkout"
						}).promise();

						return fakePromise;
					}
				
					// Get invoice url from backend
					return $.ajax({
						url: nav.getInvoiceEndpoint(withExtraInfo, additionalGetParams),
						type: 'POST',
						data: {
							cart: cartData,
							er: exchangeRate,
							country: country
							
						},
						dataType: 'json',
						timeout: 15000
					});					
				},
				clearDiscounts: function(callback) {
					// Clears discounts from the cart
					
											
						$.ajax({
							url : nav.getRootUrl()+'discount/CLEAR',
							type: 'GET',
							success: function(data, textStatus, jqXHR) {
								callback();
							},
							error: function (jqXHR, textStatus, errorThrown) {
								callback();
							}
						});
									},
				cartContainsDiscountCode: function(positiveCallback, negativeCallback) {
					
					try {
							
						cart.get('default', true).done(function(cartData) {
							
							var containsDiscountCode = false;
							if (typeof cartData.items !== 'undefined' && cartData.items.length > 0) {
								for(var l = 0; l < cartData.items.length; l++) {
									if (typeof cartData.items[l].line_level_discount_allocations !== 'undefined' && cartData.items[l].line_level_discount_allocations.length > 0) {
										containsDiscountCode = true;
									}
								}
							}
							
							if (containsDiscountCode === true) {
								positiveCallback();
							} else {
								negativeCallback();
							}
						});
					} catch(e) {
						console.log(e);
						negativeCallback();
					}
				},
				useInvoice: function(invoice, triggerNormalCheckout, cartData) {
					
					// triggerNormalCheckout is used to trigger a checkout from external apps and prevent an infinite loop, as the customer gets redirected directly to the checkout apage
					if (typeof triggerNormalCheckout === 'undefined') {
						triggerNormalCheckout = true;
					}

					var checkoutWasHandled = false;

					if (typeof window.discountOnCartProApp !== 'undefined' && typeof window.discountOnCartProApp.applyCode === 'function') {

						if (typeof invoice.code === 'string') {
							// We have a discount code here and the "Discount on cart" app is installed, which means that we will leave the application of discounts to the "Discount on cart" app.
							
							try {
								window.discountOnCartProApp.applyCode(invoice.code);
								checkoutWasHandled = true;

								var self = this;
								document.body.addEventListener('docapp-discount-applied', function() {
									setTimeout(function() {
										window.location.href = self.addCheckoutParams('/checkout');
									}, 1000);
								});
								
								setTimeout(function() {
									window.location.href = self.addCheckoutParams('/checkout');
								}, 6000);
							} catch(e) {
								
							}
						}
					}
					
					if (checkoutWasHandled !== true) {

						// Redirect to the invoice url
						if (typeof invoice.url !== 'undefined') {
							if (invoice.url === '/checkout') {

								if (triggerNormalCheckout) {
																													
										$(document).trigger('bundler_trigger_normal_checkout');
										
																		
								} else {
									window.location.href = this.addCheckoutParams('/checkout');
								}
								// window.location.href = '/checkout';
							} else {
								
								var excludedCheckoutKeys = [];
								if (invoice.url.indexOf('discount=') !== -1) {
									// We have a discount code
									excludedCheckoutKeys.push('discount');
									
									invoice.url = (nav.getRootUrl(true)+invoice.url).replace('//checkout', '/checkout');
								}
								
																
																
																
																
																	try {
										if (typeof invoice.code === 'string') {
											// We have a discount code. Set it to the cookie. 
											
											try {
												bndlr.setCookie('discount_code', invoice.code, 0);
											} catch(e) {
												console.log(e);
											}
										}
									} catch(e) {
										
									}
																
								
								
																
								
																
								invoice.url = this.addCheckoutParams(invoice.url, excludedCheckoutKeys);
								
																
									BndlrAnalytics.track('initiateCheckout');
									
									var self = this;
									if ((typeof invoice.status_code !== 'undefined' && invoice.status_code == 202) || (typeof invoice.code === 'string' && invoice.code.length > 0)) {
										console.log('invoice isnt yet ready');
										// This order requires pooling
										// Wait some time before you redirect to it.
										// Also add a tiemout when applying discounts with discount codes, because it seems that sometimes, Shopify wasn't yet ready for them.
										var timeout = 1000;
																				
										
										setTimeout(function() {
											//window.location = invoice.url;
											window.location = self.addCheckoutParams(invoice.url);
										}, timeout);
									} else {
										
										//console.log('redirecting to', invoice.url);
										
										// This orders seems okay, redirect immediately
										//window.location = invoice.url;
										window.location = self.addCheckoutParams(invoice.url);
									}
									/*
									setTimeout(function() {
										window.location = invoice.url;
									}, 500);
									*/
															}
						} else {
							//bundlerConsole.log('Something went wrong', invoice);
							// Fallback to normal checkout url
							window.location.href = this.addCheckoutParams('/checkout');
						}
					}
				},
				showBundleOnElementWithHandle: function($el) {
					var productHandle = $el.attr('data-product-handle');

					if (productHandle !== false) {
						
						var self = this;							
						cart.getProductData(nav.getRootUrl(), productHandle).done(function(productData) {
							productData = self.remapProductData(productData);
							
							var bundle = self.findBundle(productData.id, productData.variants);

							var uniqueKey = utils.getRandomString();
							$el.attr('data-b-key', uniqueKey);
							var keySelector = '[data-b-key="'+uniqueKey+'"]';
							
							$el.attr('data-bundle', bundle.id);
							$el.html('<div class="bndlr-bundle-loading"></div>');							
							
							if (bundles !== false) {
								self.getProducts(bundle, function() {
									self.displayBundle(bundle, keySelector);
								});
							}
						});
					}
				},
				canShowBundlesAutomatically: function() {
					var canShowWidgets = true;
										
					return canShowWidgets;
				},				
				getCustomerTags: function() {
					// Returns customer tags (Array), or Null if the tags couldn't be retrieved.
					return customer.getCustomerTags();
				},
				canShowBundle: function(bundle) {
					
					// This function checks whether the bundle can onyl be shown to customers tagged with a specific tag					
					if (typeof bundle.limit_for_customer_tags === 'undefined' || bundle.limit_for_customer_tags.length === 0) {
						// No tags are set for this bundle
						return true;
					}
					
					var customerTags = bndlr.getCustomerTags();

					if (customerTags !== null && customerTags.length > 0) {
						// Customer tags were retrieved successfully
						for(var g = 0; g < customerTags.length; g++) {
							
							for(var h = 0; h < bundle.limit_for_customer_tags.length; h++) {
								if (customerTags[g].trim() === bundle.limit_for_customer_tags[h].trim()) {
									return true;
								}
							}								
						}
						
						// Tag wasn't found, therefore we can't show this bundle
						return false;
					} else {
						// Customer isn't logged in or isn't tagged
						if (typeof bundle.tags_additional_options === 'string' && bundle.tags_additional_options === 'or_without_tags') {
							// This bundle should also be available to not logged in customers 
							return true;
						}
					}
					
					return false;
				},
				isInShowBundle: false, // A flag which lets us know that the function is still processing this
				resetIsInShowBundle: function() {
					bndlr.isInShowBundle = false;
				},
				showBundle: function(removePreviousBundles) {
					// removePreviousBundles is used when switching bundles based on selected variant change.
					
					/*
					console.log('show bundle');
					console.trace();
					*/
					
					if (typeof window.completelyDisableBundlerApp !== 'undefined' && window.completelyDisableBundlerApp === true) {
						console.log('Bundler is disabled via completelyDisableBundlerApp variable.');
						return true;
					}

					if (this.isInShowBundle === true) {
						console.log('already showing bundle');
						return true;
					}
					
					this.isInShowBundle = true;
					
					var bundleFound = false;

										
										
					// Check if there is a custom bundle element
					if ($('#bundler-target-element[data-bundle], .bundler-target-element[data-bundle]').length > 0) {
						var bundlesList = [];
						$('#bundler-target-element[data-bundle], .bundler-target-element[data-bundle]').each(function(index, el) {
							
							$el = $(el);
							if ($el.find('.bndlr-container').length === 0) {
								// Element doesn't yet contain the bundle
								// The element doesn't yet have the bundle key
								
								$el.addClass('bundler-target-element');
								
								var uniqueKey = $el.attr('data-bndlr-k');
								
								if (typeof uniqueKey !== 'string') {
									uniqueKey = utils.getRandomString();
									$el.attr('data-bndlr-k', uniqueKey);
									
									
									$el.attr('id', '_bndl_key_'+uniqueKey);
									
								}
								
								var keySelector = '#_bndl_key_'+uniqueKey;
								
								bundlesList.push({
									id			: $el.attr('data-bundle'),
									keySelector	: keySelector
								});
							}
						});

						var bundleDataList = [];
						for(var i = 0; i < bundlesList.length; i++) {
							if (bundlesList[i].id.length) {
							
								bundleDataList[i] = {
									bundle		: this.getBundleById(bundlesList[i].id),
									keySelector	: bundlesList[i].keySelector
								};

								if (bundleDataList[i].bundle !== false) {
									bundleFound = true;
									
																	}

								if (bundleDataList[i].bundle !== false) {

									if (bndlr.canShowBundle(bundleDataList[i].bundle) === true) {

										var self = this;

										var bundle = bundleDataList[i].bundle;

										self.getProducts(bundle, (function() {

												var bundleTmp = bundle;
												var keySelectorTmp = bundleDataList[i].keySelector;
												return function(products) {

													self.setObserver(bundleTmp, keySelectorTmp);
													self.isInShowBundle = false;
												}
											}
										)());
									} else {
										// Remove loading spinner
										document.querySelector(bundleDataList[i].keySelector).innerHTML = '';
									}
								}
							}
						}						
					}
					
										
						if (this.canShowBundlesAutomatically() === false) {
							this.isInShowBundle = false;
							return true;
						}
					
						if (bundleFound === false) {
							// Trigger to display bundle on product page
							var productHandle = nav.getProductHandle();

							if (productHandle !== false && ((typeof removePreviousBundles !== 'undefined' && removePreviousBundles) || $('.bndlr-automatic').length <= 0)) {
								// $('.bndlr-automatic').length check makes sure that we don't add bundle widgets on the page too many times if we call the .refresh() method.
								// Except if we set the removePreviousBundles parameter to true, as we want to refresh the bundle widget because of the variant change
									
								var self = this;

								cart.getProductData(nav.getRootUrl(true), productHandle).done(function(productData) {
									
									productData = self.remapProductData(productData);

																			var bundle = self.findBundle(productData.id, productData.variants);

										if (bundle !== false) {
											
											if (typeof removePreviousBundles !== 'undefined' && removePreviousBundles) {
												$('.bundler-target-element').remove();
											}
		
											var uniqueKey = utils.getRandomString();
											var keySelector = '#_bndl_key_'+uniqueKey;
										
											self.loopThroughSelectors(function($element, htmlSelector) {

												if ($element.length === 1 && $element.closest('#judgeme_product_reviews').length === 0) {

													var dataBundleAttr 	= $element.attr('data-bundle');
													
													if (typeof dataBundleAttr === 'undefined' || dataBundleAttr === false) {
														
														if (typeof self.productHtmlSelectorsActions[htmlSelector] !== 'undefined') {
															// use positioning function
															var positioningFunction = self.productHtmlSelectorsActions[htmlSelector];
															$element[positioningFunction]('<div id="_bndl_key_'+uniqueKey+'" class="bundler-target-element bndlr-automatic" data-bundle="' + bundle.id + '" data-bndlr-k="'+uniqueKey+'"></div>');
														} else {
															// deafult action is append
															$element.append('<div id="_bndl_key_'+uniqueKey+'" class="bundler-target-element bndlr-automatic" data-bundle="' + bundle.id + '" data-bndlr-k="'+uniqueKey+'"></div>');
														}
														return false;
													}
												}
											});

											self.getProducts(bundle, function() {
												self.setObserver(bundle, keySelector);
												self.isInShowBundle = false;
											});
										} else {
											this.isInShowBundle = false;
										}
																	});
							} else {
								this.isInShowBundle = false;
							}
						} else {
							this.isInShowBundle = false;
						}
										
					var self = this;
					setTimeout(function() {
						// Timeout to set the flag to false in case anything goes wrong along the way in this function
						self.isInShowBundle = false;
					}, 3000);
				},
				
				loopThroughSelectors: function(callback) {
					
					for(var i = 0; i < this.productHtmlSelectors.length; i++) {
						var htmlSelector = this.productHtmlSelectors[i];
						
						if (htmlSelector === '.bundler-target-only-visible-element') {
							var $element = $(htmlSelector).filter(':visible');
						} else {
							var $element = $(htmlSelector);
						}
						
						if (callback($element, htmlSelector) === false) {
							break;
						}						
					}
				},
				isVariantStockAvailable: function(variant) {
					if (variant.inventory_quantity <= 0 && variant.inventory_policy === 'deny') {
						return false;
					}
					
					return true;
				},
				// This method will price or 0 if the price was undefined, null or ''
				priceOrZero: function(price) {
					if (typeof price === 'undefined' || price === '' || price === null) {
						return 0;
					}
					
					return this.getPrice(price);
				},
				remapProductData: function(productData, variantId) {

					if (typeof productData.product !== 'undefined' && typeof productData.id === 'undefined') {
						// product data is in a sub product object if you request a .json file or by content type header
						// productData = productData.product;
						
						var source = productData.product;

						var product = {
							id: source.id,
							title: source.title,
							handle: source.handle,
							variants: [],
							images: [],
							featured_image: source.images[0].src
						};
						
						var variants = [];

						for (var z = 0; z < source.variants.length; z++) {
	
							var variant = {
								id:			 		source.variants[z].id,
								public_title: 		source.variants[z].public_title,
								name: 				source.variants[z].name,
								title: 				source.variants[z].title,
								price: 				this.getPrice(source.variants[z].price),
								compare_at_price:	this.priceOrZero(source.variants[z].compare_at_price),
								featured_image: 	{
									src: this.getVariantsFeaturedImage(source, source.variants[z])
								},
								available:			this.isVariantStockAvailable(source.variants[z])
							};
							
							variants.push(variant);
						}

						product.variants = variants;
						
						var images = [];
						for (var z = 0; z<source.images.length; z++) {
							images.push(source.images[z].src);
						}
						
						product.images = images;
						
						productData = product;
					}
					
					if (typeof variantId !== 'undefined' && variantId !== null) {
						// Remap product data for this variant id, as this product is included in a variant level bundle
						var variants = [];

						for (z = 0; z < productData.variants.length; z++) {

							if (productData.variants[z].id == variantId) {

								variants.push(productData.variants[z]);
								
								productData.id 		= productData.variants[z].id;
								
								var variantTitle = this.getVariantTitle(productData.variants[z]);
								
								if (productData.title !== variantTitle) {
									productData.title 	= productData.title + ' - ' + this.getVariantTitle(productData.variants[z]);
								} else {
									productData.title 	= productData.title;
								}
								
								break;
							}
						}
						
						if (variants.length === 0) {
							console.warn('Could not get variant '+variantId+' data for product '+productData.title+'!');
							// Assign the required variant ID to this product, as we then use this id to map the product to the actual data
							productData.id = variantId;
						}
						
						productData.variants = variants;
					}
					
					if (typeof productData.variants !== 'undefined') {
						for (z = 0; z < productData.variants.length; z++) {
							
							if (typeof productData.variants[z].name === 'undefined' && productData.title !== 'undefined') {
								// Variant name is not defined for some reason (plantedfoods)
								// Set it up
								var variantTitle = this.getVariantTitle(productData.variants[z]);
							
								if (productData.title !== variantTitle) {
									productData.variants[z].name = productData.title + ' - ' + variantTitle;
								} else {
									productData.variants[z].name = productData.title;
								}
							}
							
							if (typeof productData.variants[z].options === 'undefined') {
								// Set options array, because this value is undefined. This seems to happen when we are retrieving data from a normal product endpoint (without .js or .json).
								productData.variants[z].options = [];
								if (typeof productData.variants[z].option1 !== 'undefined') {
									productData.variants[z].options.push(productData.variants[z].option1);
								}
								if (typeof productData.variants[z].option2 !== 'undefined') {
									productData.variants[z].options.push(productData.variants[z].option2);
								}
								if (typeof productData.variants[z].option3 !== 'undefined') {
									productData.variants[z].options.push(productData.variants[z].option3);
								}
							}
						}
					}
					
					productData.product_id = productData.id;
					
					return productData;
					
									},
				getVariantTitle: function(variant) {
					var name = variant.public_title;
					if (typeof name == 'undefined' || name === null) {
						name = variant.name;
					}
					
					if (typeof name == 'undefined' || name === null) {
						name = variant.title;
					}
					
					return name;
					
				},
				findBundle: function(productId, variants, volumeDiscountType) {
					if (typeof volumeDiscountType === 'undefined') {
						volumeDiscountType = false;
					}
					// This method find the bundle, relevant to the currently viewed product.
					// If there are multiple same priority variant level bundles, then the one with the currently selected variant will be displayed
					
					var currentPriority = 0;
					var foundPreferredVariantBundle = null;
					var foundNonPreferredVariantBundle = null;
					
					var bndls = bundles;
					if (typeof clientSpecifics['before_find_bundle_reorder'] !== 'undefined') {
						bndls = clientSpecifics['before_find_bundle_reorder'].reorder(bndls);
					}
					
					
					// Finds bundle in bundles
					for (var i = 0; i<bndls.length; i++) {
						
						if (bndls[i].show_bundle !== 'true') {
							continue;
						}
						
						if (volumeDiscountType === true && bndls[i].minimum_requirements !== 'volume_discounts') {
							// The bundle is not the volume discount bundle
							continue;
						}
						
						if (volumeDiscountType === false && bndls[i].minimum_requirements === 'volume_discounts') {
							// The bundle is the volume discount bundle, but we don't want it
							continue;
						}
						
						/*
						if(bndls[i].minimum_requirements === 'sectioned_n_products') {
							// The bundle is a sectioned Mix & Match bundle, which shouldn't be showing up on product pages.
							continue;
						}
						*/
						
						if (bndlr.canShowBundle(bndls[i]) !== true) {
							continue;
						}
						
						if (bndls[i].priority !== currentPriority) {
							
							// Priority level has changed. Flush any variant level bundles
							if (foundPreferredVariantBundle !== null) {
								return foundPreferredVariantBundle;
							}
							
							if (foundNonPreferredVariantBundle !== null) { 
								// Flush non preferred variant bundle only if we aren't doing this for volume discounts
								// Removed " && volumeDiscountType !== true" condition on 2024-03-19 because it caused an issue in jdstore-biz where volume discount which targeted ALL products 
								// was shown instead of preferred volume discount. Not sure why exactly we had this condition in there before.
								return foundNonPreferredVariantBundle;
							}
						}
						
						if (volumeDiscountType === true && bndls[i].minimum_requirements === 'volume_discounts' && bndls[i].product_target_type === 'all_products') {
							return bndls[i];
						}
						
						currentPriority = bndls[i].priority;
						
						if (this.isVariantBundle(bndls[i]) === false && volumeDiscountType === false) {
							// Product level bundles
							if (typeof bndls[i].products[productId] !== 'undefined') {
								return bndls[i];
							}
							if (typeof bndls[i].required_products[productId] !== 'undefined') {
								return bndls[i];
							}
							
							
							if(bndls[i].minimum_requirements === 'sectioned_n_products') {
								// This is a sectioned mix and match bundle
								var sections = bndls[i].sections;
								for(var k in sections) {
									if (sections.hasOwnProperty(k)) {
										if (typeof sections[k].products[productId] !== 'undefined') {
											return bndls[i];
										}
									}
								}
							}
						} else {
							// Variant level bundles
							var preferredVariant = nav.getVariantId();

							if (preferredVariant === '') {
								// The variant is not in the URL. Fallback to the product variant selector on the product page.
								var selectedVariant = $('select.product-single__variants[name="id"] option:selected');
								if (selectedVariant.length) {
									preferredVariant = selectedVariant.val();
								}
							}
							
																							if (preferredVariant === '') {
									// The variant is not in the URL. Fallback to the product variant selector on the product page.
									var selectedVariant = $('form[action*="/cart/add"] input[name="id"]');
									if (selectedVariant.length === 1) {
										preferredVariant = selectedVariant.val();
									}
								}
														
							if (preferredVariant === '') {
								// The variant is not in the URL. Fallback to the product variant selector on the product page.
								var selectedVariant = $('form[action*="/cart/add"][data-type="add-to-cart-form"] input[name="id"]');
								if (selectedVariant.length === 1) {
									preferredVariant = selectedVariant.val();
								}
							}
							
							if (preferredVariant === '') {
								// The variant is not in the URL. Fallback to the product variant selector on the product page.
								var selectedVariant = $('#product form[action*="/cart/add"] [name="id"]');
								if (selectedVariant.length === 1) {
									preferredVariant = selectedVariant.val();
								}
							}
							
							if (preferredVariant === '') {
								// The variant is not in the URL. Fallback to the product variant selector on the product page.
								var selectedVariant = $('.product__info-wrapper product-form form[action*="/cart/add"] [name="id"]');
								if (selectedVariant.length === 1) {
									preferredVariant = selectedVariant.val();
								}
							}

							if (preferredVariant !== '') {
								
								// First loop will try to find a bundle, relevant to the currently selected variant
								for (var pid in bndls[i].products) {
									if (bndls[i].products.hasOwnProperty(pid)) {

										var bundleVariants = bndls[i].products[pid].variants;

										if (typeof bundleVariants[preferredVariant] !== 'undefined') {
											foundPreferredVariantBundle = bndls[i];
										}
									}
								}
								
								if (foundPreferredVariantBundle === null) {
									// Check required products if a bundle wasn't found with discounted products
									for (var pid in bndls[i].required_products) {
										if (bndls[i].required_products.hasOwnProperty(pid)) {

											var bundleVariants = bndls[i].required_products[pid].variants;

											if (typeof bundleVariants[preferredVariant] !== 'undefined') {
												foundPreferredVariantBundle = bndls[i];
											}
										}
									}
								}
							}

							// Second loop is the default one. Will find first bundle which has at least one variant included from the currently viewed product.
							for (var pid in bndls[i].products) {
								if (bndls[i].products.hasOwnProperty(pid)) {

									var bundleVariants = bndls[i].products[pid].variants;
									
									for (var x = 0; x < variants.length; x++) { // Variants of current product
										var variantId = variants[x].id;
										
										if (typeof bundleVariants[variantId] !== 'undefined') {
											foundNonPreferredVariantBundle = bndls[i];
										}
									}
								}
							}
							
							if (foundNonPreferredVariantBundle === null) {
								// Check required products if a bundle wasn't found with discounted products
								for (var pid in bndls[i].required_products) {
									if (bndls[i].required_products.hasOwnProperty(pid)) {

										var bundleVariants = bndls[i].required_products[pid].variants;
										
										for (var x = 0; x < variants.length; x++) { // Variants of current product
											var variantId = variants[x].id;
											
											if (typeof bundleVariants[variantId] !== 'undefined') {
												foundNonPreferredVariantBundle = bndls[i];
											}
										}
									}
								}
							}
						}
					}
					
					if (foundPreferredVariantBundle !== null) {
						return foundPreferredVariantBundle;
					}
					
					if (foundNonPreferredVariantBundle !== null) {
						return foundNonPreferredVariantBundle;
					}
					
					// Fallback for volume discounts 
					if (volumeDiscountType) {
						// Try to find the bundle based on product ID
						if (typeof bndls[i] !== 'undefined' && typeof bndls[i].products[productId] !== 'undefined') {
							return bndls[i];
						}
						if (typeof bndls[i] !== 'undefined' && typeof bndls[i].required_products[productId] !== 'undefined') {
							return bndls[i];
						}
					}
					
					return false;
				},
								isVariantBundle: function(bundle) {
					if (typeof bundle.product_level !== 'undefined' && bundle.product_level == 'variant') {
						return true;
					}
					
					return false;
				},
				getBundleById: function(bundleId) {
					// Finds bundle in bundles
					for (var i = 0; i<bundles.length; i++) {
						if (typeof bundles[i].id !== 'undefined' && bundles[i].id == bundleId) {
							return bundles[i];
						}
					}
					
					return false;
				},
				processBundlesWithRetrievedProducts: function() {
					// bundlerConsole.log('ProductRetrievalRequests', JSON.parse(JSON.stringify(ProductRetrievalRequests)));
					// bundlerConsole.log('ProductRetrievalStatus', 	JSON.parse(JSON.stringify(ProductRetrievalStatus)));
					
					// Loop through bundles and check if every required product was successfully retrieved
					for(var bundleId in ProductRetrievalRequests) {
						if (ProductRetrievalRequests.hasOwnProperty(bundleId)) {

							var allBundleProductsWereRetrieved = true;
							
							for (var handle in ProductRetrievalRequests[bundleId].products) {
								if (ProductRetrievalRequests[bundleId].products.hasOwnProperty(handle)) {
									// Check if the product was already retrieved
									if (ProductRetrievalRequests[bundleId].products[handle] !== 'retrieved') {
										allBundleProductsWereRetrieved = false;
									}
								}
							}

							if (allBundleProductsWereRetrieved) {								
								// All products were retrieved, so we can set up the libraries for this bundle and execute the callback
								Tools.Products.setLibraries(Library, bundleId);

								//ProductRetrievalRequests[bundleId].callback();
																
								for(var i = 0; i < ProductRetrievalRequests[bundleId].callback.length; i++) {
									setTimeout(ProductRetrievalRequests[bundleId].callback[i], 1);
								}

								delete ProductRetrievalRequests[bundleId];
							}
						}
					}
					
				},
				handleProductRetrievalError: function(handle) {
					// Display error message for the bundles which were waiting for this product's data
					// FIND EACH BUNDLE WHICH REQUESTED THIS PRODUCT'S DATA		
					for(var bundleId in ProductRetrievalRequests) {

						if (ProductRetrievalRequests.hasOwnProperty(bundleId)) {
							
							if (typeof ProductRetrievalRequests[bundleId].products[handle] !== 'undefined') {
								// This bundle was waiting for this product
								if (typeof ProductRetrievalStatus[handle].error !== 'undefined') {
									errorHandler.displayError(ProductRetrievalStatus[handle].error, bundleId);
								}
							}
						}
					}

				},
				removeProductFromRetrievalRequests: function(handle) {
					// This is only used for bundles, which don't need all products available at all times 
					// FIND EACH BUNDLE WHICH REQUESTED THIS PRODUCT'S DATA		
					for(var bundleId in ProductRetrievalRequests) {

						if (ProductRetrievalRequests.hasOwnProperty(bundleId)) {
							
							if (typeof ProductRetrievalRequests[bundleId].products[handle] !== 'undefined') {
								// This bundle was waiting for this product
								delete ProductRetrievalRequests[bundleId].products[handle];
							}
						}
					}

				},
				// forHandle parameter is optional. It is used when retrieving product data through JSON type, because the original handle does not exist anymore (the merchant changed it in admin).
				markProductAsRetrieved: function(productData, forHandle) {
					if (typeof productData.product !== 'undefined' && typeof productData.id === 'undefined') {
						productData = productData.product;
					}
					
					if (typeof forHandle !== 'undefined') {
						var handle = forHandle;
					} else {
						var handle = productData.handle;
					}
					
					if (typeof handle !== 'undefined' && handle !== '' && typeof ProductRetrievalStatus[handle] !== 'undefined') {

						ProductRetrievalStatus[handle].retrieved 	= true;
						ProductRetrievalStatus[handle].product_id 	= productData.id;
						ProductRetrievalStatus[handle].data 		= productData
					}
				},
				setProductLibrariesForBundlesInQueue: function(forHandle) {
					// After the product is retrieved from JSON endpoint, this method will set the libraries for all bundles which were waiting for the retrieval request to be completed
					// This also has to be fired if we want to display the bundle after the products were already retrieved.
					// This method marks the product for bundles in queue (ProductRetrievalRequests[bundleId].products[handle]) as retrieved and sets the necessary libraries which the app needs
					// forHandle parameter is required for products which had the handle changed (the merchant changed it and we retrieved the data via the redirect)
					
					var handle = forHandle;
					if (typeof ProductRetrievalStatus[handle] !== 'undefined' && ProductRetrievalStatus[handle].retrieved === true) {
						var productData = ProductRetrievalStatus[handle].data;

						// SET PRODUCT LIBRARY FOR EVERY PRODUCT IN THE BUNDLE					
						for(var bundleId in ProductRetrievalRequests) {
							// Each retrieval request has bundle data, products which it wants and a callback
							if (ProductRetrievalRequests.hasOwnProperty(bundleId)) {
								
								if (typeof ProductRetrievalRequests[bundleId].products[handle] !== 'undefined' && ProductRetrievalRequests[bundleId].products[handle] != 'retrieved') {
									// Product for this bundle was retrieved

									// DISCOUNTED PRODUCTS
									// Set the product data in the library for the products in this bundle
									for (var key in ProductRetrievalRequests[bundleId].bundle.products) {
										if (ProductRetrievalRequests[bundleId].bundle.products.hasOwnProperty(key)) {
											
											var bndlrProduct = ProductRetrievalRequests[bundleId].bundle.products[key];

											if (bndlrProduct.handle === handle) {

												if (Library.Products.isEmpty(bndlrProduct.id)) {
													// Save product to library only if the current value is empty

													// This product was waiting for our data
													// Set it in library
													if (ProductRetrievalRequests[bundleId].bundle.product_level == 'variant') {
														// Variant level bundle
														var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)), bndlrProduct.id);
													} else {
														// Product level bundle
														var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)));
													}

													//bundlerConsole.log('setting product data in library', handle);
													// Set the remapped data to products library
													Library.Products.set(bndlrProduct.id, remappedData);
												}
											}
										}
									}
									
									// REQUIRED PRODUCTS
									// Set the required product data in the library for the required products in this bundle
									if (ProductRetrievalRequests[bundleId].bundle.minimum_requirements === 'specific_products') {
										for (var key in ProductRetrievalRequests[bundleId].bundle.required_products) {
											if (ProductRetrievalRequests[bundleId].bundle.required_products.hasOwnProperty(key)) {
												
												var bndlrProduct = ProductRetrievalRequests[bundleId].bundle.required_products[key];

												if (bndlrProduct.handle === handle) {

													if (Library.Products.isEmpty(bndlrProduct.id)) {
														// Save product to library only if the current value is empty
													
														// This product was waiting for our data
														// Set it in library
														if (ProductRetrievalRequests[bundleId].bundle.product_level == 'variant') {
															// Variant level bundle
															var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)), bndlrProduct.id);
														} else {
															// Product level bundle
															var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)));
														}

														// Set the remapped data to products library
														Library.Products.set(bndlrProduct.id, remappedData);
													}
												}
											}
										}
									}
									
									// SECTIONED BUNDLES 
									if (ProductRetrievalRequests[bundleId].bundle.minimum_requirements === 'sectioned_n_products') {
										// Loop through bundle sections
										for (var i = 0; i<ProductRetrievalRequests[bundleId].bundle.sections.length; i++) {
											// In section 
											var section = ProductRetrievalRequests[bundleId].bundle.sections[i];
											
											for (var key in section.products) {
												if (section.products.hasOwnProperty(key)) {
													
													var bndlrProduct = section.products[key];

													if (bndlrProduct.handle === handle) {

														if (Library.Products.isEmpty(bndlrProduct.id)) {
															// Save product to library only if the current value is empty
														
															// This product was waiting for our data
															// Set it in library
															/*
															if (ProductRetrievalRequests[bundleId].bundle.product_level == 'variant') {
																// Variant level bundle
																var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)), bndlrProduct.id);
															} else {
																// Product level bundle
																var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)));
															}*/
															var remappedData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)));

															// Set the remapped data to products library
															Library.Products.set(bndlrProduct.id, remappedData);
														}
													}
												}
											}
										}										
									}
									
									// Mark the product as retrieved for this bundle request
									ProductRetrievalRequests[bundleId].products[handle] = 'retrieved';
								}
							}
						}
					}
				},
				setVariantProductData: function(productData) {
					// Loop through variants and set them as separate products in the library
					if (typeof productData.variants !== 'undefined') {
						
						for(var i=0; i< productData.variants.length; i++) {
							var variantProductData = bndlr.remapProductData(JSON.parse(JSON.stringify(productData)), productData.variants[i].id);
							Library.Products.set(variantProductData.id, variantProductData);
						}
					}
				},
				getProducts: function(bundle, callback) {
					// Gets product data and fires callback after all data is retrieved
					
					var needsAllProducts = true;

					var products = {};
					var totalProducts = 0;
					var processedProducts = 0;
					var strippedProducts = JSON.parse(JSON.stringify(bundle.products));
					
					Library.DiscountedProducts.set(bundle.id, bundle.products);
					
					if (bundle.minimum_requirements === 'specific_products') {
						// Merge bundle products with required products so we can get info for all of these products
						// strippedProducts = Object.assign({}, strippedProducts, bundle.required_products);
						Library.RequiredProducts.set(bundle.id, bundle.required_products);
						
						var requiredProducts = JSON.parse(JSON.stringify(bundle.required_products));				
						
						Object.keys(requiredProducts).forEach(function(key) { 
							strippedProducts[key] = requiredProducts[key]; 
						});
					}
	
					if (bundle.minimum_requirements === 'sectioned_n_products') {
						// Add products from each section into the "strippedProducts" object so that we will then retrieve them from Shopify. 
						
						// TODO set the products of each section in it's own library?
						//Library.RequiredProducts.set(bundle.id, bundle.required_products);
						
						var sectionedProducts = {};
						var sections = [];
						for(var sectionId = 0; sectionId < bundle.sections.length; sectionId++) {

							sections.push(JSON.parse(JSON.stringify(bundle.sections[sectionId].products)));
							
							for(var k in bundle.sections[sectionId].products) {
								if (bundle.sections[sectionId].products.hasOwnProperty(k)) {
									if (typeof sectionedProducts[k] === 'undefined') {
										sectionedProducts[k] = bundle.sections[sectionId].products[k];
									}
								}
							}
						}
						
						Library.SectionedBundlesProducts.set(bundle.id, sections);
						
						Object.keys(sectionedProducts).forEach(function(key) { 
							strippedProducts[key] = sectionedProducts[key]; 
						});
					}
					
					if (bundle.minimum_requirements === 'sectioned_n_products' || bundle.minimum_requirements === 'n_products' || bundle.minimum_requirements === 'tiered_n_products') {
						needsAllProducts = false;
					}
	
	
					if (typeof ProductRetrievalRequests[bundle.id] === 'undefined') {
						ProductRetrievalRequests[bundle.id] = {
							products: 	{},
							callback: 	[callback],
							bundle:		bundle
						};
					} else {
						ProductRetrievalRequests[bundle.id].callback.push(callback);
					}
					
					// Set product retrieval requests for this bundle
					for (var productId in strippedProducts) {
						if (strippedProducts.hasOwnProperty(productId)) {
							var handle = strippedProducts[productId].handle;
							if (typeof ProductRetrievalRequests[bundle.id].products[handle] === 'undefined') {
								
								var pid = strippedProducts[productId].id;
								if (typeof strippedProducts[productId].pid !== 'undefined') {
									// We are probably in the variant level bundle 
									// get the actual product ID here
									pid = strippedProducts[productId].pid;
								}
									
								
								ProductRetrievalRequests[bundle.id].products[handle] = {
									retrieving	: true,
									id			: strippedProducts[productId].id,
									pid			: pid // Set the actual product ID so that we can retrieve product from our endpoint even for variant level bundles
								}
							}
						}
					}
					
					// bundlerConsole.log(JSON.parse(JSON.stringify(ProductRetrievalRequests)));
					// bundlerConsole.log(JSON.parse(JSON.stringify(ProductRetrievalStatus)));
					// Process product retrieval requests
					for(var bundleId in ProductRetrievalRequests) {
						if (ProductRetrievalRequests.hasOwnProperty(bundleId)) {
							for (var productHandle in ProductRetrievalRequests[bundleId].products) {
								if (typeof ProductRetrievalStatus[productHandle] === 'undefined') {									
									// Product was never retrieved
									// Retrieve product
									
									ProductRetrievalStatus[productHandle] = {
										retrieved: false
									};

									var productId = ProductRetrievalRequests[bundleId].products[productHandle].pid;
									
									//console.log('start product retrieval', productHandle);
									
									cart.getProductData(nav.getRootUrl(true), productHandle+'').done((function() {
											return function(productData) {
												// Product was successfully retrieved
												// Set the product data in Products Library
												// Mark product as retrieved
												//console.log('product retrieved', productData);
												
												bndlr.markProductAsRetrieved(productData);
												
												bndlr.setProductLibrariesForBundlesInQueue(productData.handle);
												bndlr.processBundlesWithRetrievedProducts();
											}
										})()).fail((function() {
											var handle = productHandle;
											var pid = productId;
											//var needsAllP = needsAllProducts;
											
											return function(jqXHR) {

												if (jqXHR.status == 404) {
													// Initial request failed with 404.
													// Request data by content type
													cart.getProductDataJSON(nav.getRootUrl(true), handle).done(function(productData) {
														
														if (typeof productData.product !== 'undefined') {
															bndlr.markProductAsRetrieved(productData, handle);
															bndlr.setProductLibrariesForBundlesInQueue(handle);
															bndlr.processBundlesWithRetrievedProducts();
														} else {
															
															var errorMessage = 'Bundler: Can\'t get product data: ' + nav.getRootUrl(true) + 'products/' + handle +'.<br />To show the bundle widget, just make sure that the product is active in your online shop.';
															
															if (needsAllProducts) {
																// If the bundle needs all products, then mark this as a product with an error 
																ProductRetrievalStatus[handle]['error'] = errorMessage;
																bndlr.handleProductRetrievalError(handle);
															} else {
																// The bundle doesn't need all products. 
																// Do something with it
																bndlr.removeProductFromRetrievalRequests(handle);
																bndlr.processBundlesWithRetrievedProducts();
															}
														}
														
													}).fail((function() {
														var pd = pid;
														//var needsAP = needsAllP;

																													return function(jqXHR) {

																// Get product data from proxy
																//if (jqXHR.status == 404) {
		
																	cart.getProductDataViaProxy(nav.getRootUrl(true), pd, handle, function() {
																		var errorMessage = 'Bundler: Can\'t get product data: ' + nav.getRootUrl(true) + 'products/' + handle +'.<br />To show the bundle widget, just make sure that the product is active in your online shop.';
																		if (needsAllProducts) {
																	
																			// If the bundle needs all products, then mark this as a product with an error 
																			ProductRetrievalStatus[handle]['error'] = errorMessage;
																			bndlr.handleProductRetrievalError(handle);
																		} else {
																			// The bundle doesn't need all products. 
																			// Do something with it
																			bndlr.removeProductFromRetrievalRequests(handle);
																			bndlr.processBundlesWithRetrievedProducts();
																		}
																	}).done(function(productData) {
																		
																		bndlr.markProductAsRetrieved(productData);
													
																		bndlr.setProductLibrariesForBundlesInQueue(productData.handle);
																		bndlr.processBundlesWithRetrievedProducts();
																		
																	}).fail(function() {
																		
																		var errorMessage = 'Bundler: Can\'t get product data: ' + nav.getRootUrl(true) + 'products/' + handle +'.<br />To show the bundle widget, just make sure that the product is active in your online shop.';
																		
																		if (needsAllProducts) {
																	
																			// If the bundle needs all products, then mark this as a product with an error 
																			ProductRetrievalStatus[handle]['error'] = errorMessage;
																			bndlr.handleProductRetrievalError(handle);
																		} else {
																			// The bundle doesn't need all products. 
																			// Do something with it
																			bndlr.removeProductFromRetrievalRequests(handle);
																			bndlr.processBundlesWithRetrievedProducts();
																		}
																	});
																//}//
															}
																											})());
												}			
											}
										}
									)());
									
								} else if (ProductRetrievalStatus[productHandle].retrieved === true) {									
									// Product was already retrieved
									// Mark the product in this bundle as retrieved. This is crucial when we want to switch the displayed bundle when the customer selects a different variant.
									// If we don't mark the product as retrieved for this bundle request, then the bundle won't get displayed ;)
									
									// Mark the product in this bundle inqueue as retrieved and set the necessary libraries
									bndlr.setProductLibrariesForBundlesInQueue(productHandle);
									// Process all retrieved products
									bndlr.processBundlesWithRetrievedProducts();
									
								}  else if (ProductRetrievalStatus[productHandle].retrieved === false) {
									// Product is being retrieved
									// Wait
								} 
							}
						}
					}
				},
				productHtmlSelectors: [
																																																																						'#bundler-target-element', // Custom target element
					'.bundler-target-element', // Custom target element by class
					'.bundler-target-only-visible-element', 
					'div.product-template[itemtype="http://schema.org/Product"] .product__content.page-width',
					'#ProductSection-product-template .product.grid',
					'.layout-content-wrapper .product-detail-form',
					'#ProductSection-product-template section[itemtype="http://schema.org/Product"]',
					'single-product.product-page-main',
					'#__pf [data-pf-type="Layout"] [data-pf-type="Column"] [data-pf-type="ProductBox"]:visible', // weird theme Exgym-home1, yoursafeathlete-unequal
					'#__pf [data-pf-type="Layout"] [data-pf-type="Column"] [data-checkout="checkout"]:visible', // core-coffee-roasting-company
					'#MainContent #shopify-section-product-template #ProductSection-product-template,product-template__container.page-width', // Resolves the issue where the bundle isn't centered on mobile devices in Debut theme
					'#ProductSection-product-template .product-single.grid',
					'#ProductSection-product-template',
					'.product-main .box_product_page .product-essential',
					'#ProductSection .product-single',
					'div#section-product.product--section[itemtype="//schema.org/Product"] .box__product-content.site-box .site-box-content', //utilitario-mexicano
					'div[itemtype="http://schema.org/Product"] #layoutmaincontent',
					'#shopify-section-product-template #section-product-template .product-single .wrapper .product-details .product-single__meta div[itemprop="offers"][itemtype="http://schema.org/Offer"]',
					'#shopify-section-product-template [data-section-id="product-template"] .product-block-list .product-block-list__item--info form.product-form',
					'#shopify-section-product-template .product-section .page-content .page-width',
					'[itemtype="http://schema.org/Product"][data-section-id="product"] .product-detail__wrapper .page-width',
					'div[itemtype="http://schema.org/Product"] + .single-product-layout-type-3 .product-single',
					'div[itemtype="http://schema.org/Product"] .product-single[data-product-id]',
					'div[itemtype="http://schema.org/Product"][data-section-type="product"] .row.product-single',
					'div[itemtype="http://schema.org/Product"] #shopify-section-product-details',
					'.shopify-section div[itemtype="http://schema.org/Product"] ~ .container--product-page',
					'div[itemtype="http://schema.org/Product"]',
					'div[itemtype="//schema.org/Product"]',
					'div[itemtype="http://data-vocabulary.org/Product"] .product_section',
					'#shopify-section-product-template .main_content_area .product_section[itemtype="http://schema.org/Product"]',
					'#ProductSection-product-template-default .product-default .product_top .product-shop',
					'#ProductSection-product-template-default .product_bottom',
					'#shopify-section-single-product-tab',
					'#shopify-section-product-template .sixteen.columns [class|="product"] [itemtype="http://schema.org/Product"]',
					'#shopify-section-product-template div[class^="product-"] div[itemtype="http://schema.org/Product"].product_section',
					'#shopify-section-product-template .product-template .product-right .shopify-product-form',
					'#shopify-section-product-template .section-product .product-single',
					'#shopify-section-product-template.shopify-section--product-template div.one-whole.column[class*="product-"]',
					'#shopify-section-product-template div.product_section.is-flex',
					'#shopify-section-product-template div.product_section',
					'#shopify-section-product-template div.product-section:first',
					'#shopify-section-product-template [data-section-id="product-template"] .product-detail',
					'#shopify-section-product-template',
					'section.grid-hold.product.content',
					'#shopify-section-product [data-section-id="product"] .pro_main_c > div.row',
					'#PageContainer main > div[itemtype="http://schema.org/Product"]',
					'#shopify-section-static-product .product--container article.product--outer',
					'#shopify-section-static-product article.product--outer',
					'#shopify-section-product-detail-main [data-section-id="product-detail-main"]',
					'article[itemtype="http://schema.org/Product"]',
					'#ProductSection-product .product-page .product-single',
					'div[itemtype="http://schema.org/Product"] .ten.columns.omega',
					'#shopify-section-static-product.shopify-section.section-product',
					'div[class^="product-"] div[itemtype="http://schema.org/Product"].product_section',
					'.template-product .shg-product:first',
					'div#product-details[itemtype="http://schema.org/Product"]',
					'div#product_page_content[itemtype="http://schema.org/Product"]',
					'.product-template-section .product_section',
					'#shopify-section-product-template-control div[itemtype="http://schema.org/Product"]:first',
					'#MainContent .module-wrap[data-label="Product"][data-status="dynamic"]',
					'section[itemtype="http://schema.org/Product"]',
					'.template-product .gryffeditor .module-wrap[data-label="Product"]:first',
					'article#single-product .product__right',
					'#PageContainer #shopify-section-product-template-alt',
					'#shopify-section-product .product--template[data-section-id="product"][data-section-type="product"][data-product-template]',
					'div[data-section-type="product"] .product-page .product-single',
					
					'div[data-section-type="product"]',
					'#ProductSection-product .product-page .product-single:not(.product-single--medium-image)',
					'#template-product .product_section .product__information',
					'div[class*="product-"][itemtype="http://schema.org/Product"]',
					'#shopify-section-product .product-container .product-details-wrapper .product-message',
					'#jas-content .product > .jas-row',
					'.product #shopify-section-product-page-description',
					'.product .product-infors .theiaStickySidebar',
					'#MainContent section[keyword="product"] .gt_container',
					'div[data-type="product"] .lh-product-single .lh-details-product',
					'#shopify-section-static-product .module-wrapper .module-product .product-wrap .product-tabs',
					'.template-product .product-tabs .product-tabs-body #product-tab-description',
					'#shopify-section-product-page article#section-product-page .product-content',
					'.product-template.product-details-section .section.product_section',
					'#PageContainer .product-template .section-description',
					'#shopify-section-product.shopify-section.section--products',
					'#shopify-section-product-template .product .page__content-wrapper',
					'#shopify-section-product-sections-template .product-section .page-content .page-width .product-single__description-full',
					'#shopify-section-bbar-product-template #product-view',
					'#shopify-section-template--product',
					'div[data-section-type="product-page"] .product-page__main',
					'.shopify-section .product-section .page-content',
					'.site-box-container.product--section .box__product-content .site-box-content',
					'#shopify-section-product--static .product-form-product--static',
					'#shopify-section-product--static',
					'#shopify-section-product-description-bottom-template .product_form form.shopify-product-form',
					'#shopify-section-template-product #template-product .container--product',
					'.shopify-section.section-product .product-details-inline',
					'#shopify-section-module-product [data-section-id="module-product"]',
					'#shopify-section-product #content .pro_main_c > .row:first',
					'#shopify-section-product-sections-template .page-content .page-width .product-single__meta',
					'#shopify-section-product-template > div[class^="product-"]',
					'.product-page--right-column--container .product-form--root form.product-form--container',
					'.product.product--large',
					'.product .product__info-container',
					'#shopify-section-product-template-new',
					'.shopify-section section[data-section-type="product"] > div.container',
					'#shopify-section-product-details-template .container .product.product_section',
					'.product .product-details',
					'.pro-page #ProductSection-product-template-default .product-default .product_top',
					'.product-single .product-single__bottom',
					'.Product__InfoWrapper .Product__Info .Container',
					'.shopify-section .product__section.product-template div.row.grid_wrapper .product__section-content',
					'#PageContainer .container .grid.product-single',
					'#shopify-section-product-details-template.shopify-section--product-template .container .product_section.is-flex',
					'.product-block-list__item.product-block-list__item--info .card.card--sticky',
					'.product-id.product-template .product-grid-product-template',
					'#content .shopify-section.section-product-template .product-container[data-section-type="product-template"]',
					'.is-product-main .product-container .product-main',
					'.main__wrapper #content ~ .product__wrapper',
					'.main__wrapper #content.product-page',
					'.product-section .page-content .page-width .breadcrumb + .grid',
					
					'#shopify-section-product .section-product',
					'.product--container',
					'.product-page-main',
					'.shopify-section.section-product',
					'.shopify-section .product-section:not(.is-modal) .page-content',
					'div.shopify-section--main-product',
					'.AddToCartForm  .item-content [data-key="accordion"]',
					'div.product-area',
					'div.product__section',
					'[itemtype="http://schema.org/Product"] ~ .grid[itemtype="http://schema.org/Product"]',
					'#shopify-section-product-template [itemtype="http://schema.org/Offer"] ~ .container ~ .product-detail',
					'#shopify-section-product-page__product',
					'.product-page--root .product-page--top-panel',
					'.product-page--root',
					'.screen-layer--is-active .screen-layer__inner .product-section.is-modal .page-content .page-width',
					'.section-main-product [data-section-type="main-product"]',
					'.product_section [data-product-details]',
					'.product_section',
					'.content-page-detail',
					'.product.product--wet-pouch',
					'#product_template',
					'#shopify-section-product .product-details',
					'.product-detail__detail.sticky-element .product-detail__options + form.ajax-product-form',
					'[class*="#product-meta-block @type:buy_buttons"',
					'[data-section-type="product"] .product .product__container',
					'.proDetailRightContent',
					'.product__info-container.product__info-container--sticky',
					'[data-pf-type="Section"] [data-pf-type="Row"] [data-pf-type="Column"] > [data-pf-type="ProductBox"] form.pf-product-form',
					'section.product-page-section',
					'#m-product .product-data',
					'.shopify-section [x-data="product()"]',
					'.product-single[data-product-id]',
					'[id*="ProductOverview"].shopify-section',
					'.product .container .product__row .product__col .product-accordion',
					'.product__info-container product-form.product-form',
					'.product__section-contentWrapper',
					'.product__row',
					'.product-section[data-product-handle]:not(.is-modal)',
					'#product-area',
					'.shopify-section.product-section',
					'.module-product .product-wrap',
					'.product-single__details',
					'article#product-description form.product__form-container.product_form',
					'.product-page.product-template.main__section[data-product-id]',
					'.t4s-row__product',
					'#MainContent div[id^="shopify-section-template--"].section-main-product',
					'.f-product-single[data-section-type="main-product"]',
					'product-page.main-product.grid',
					'#ProductSection-product-template form[action*="/cart/add"]',
					'section[data-product-section] .section-content',
					'.product-template[data-section-type="product-page"]',
					'.section.section--tight .product',
					'[data-section-type="product-template"]',
					'.border-grid-color[data-section-type="product"]',
					'.product__top',
					'#product-template',
					'.single-product__form-wrap',
					'.gryffeditor form.AddToCartForm',
					'[class="#section-body-content"] [class="#product"]',
					'#product-box',
					'section.product-detail-wrapper',
					'section.product__container',
					'.block-section .product-page',
					'section[id^="MainProduct-template--"]',
					'#section-product',
					'.product--stacked.product--medium'
					//'.page-content--product .product-grid__container'
					//'div[class*="lg:sticky"] form[id^="product-card--"][data-type="add-to-cart-form"]',
					
				],
				productHtmlSelectorsActions: {
					// Warning: using the after selector can cause the app to show the bundles in a reverse order on product pages!
					'#ProductSection-product-template-default .product-default .related-products'													: 'before',
					'#shopify-section-product .product-container .product-details-wrapper .product-message'											: 'before',
					'#shopify-section-product-template .product-template .product-right .shopify-product-form'										: 'after',
					'#shopify-section-product-template [data-section-id="product-template"] .product-block-list .product-block-list__item--info form.product-form'	: 'after',
					'#shopify-section-static-product .module-wrapper .module-product .product-wrap .product-tabs'									: 'after',
					'#PageContainer .product-template .section-description'																			: 'after',
					'#shopify-section-product.shopify-section.section--products'																	: 'after',
					'#shopify-section-product-sections-template .product-section .page-content .page-width .product-single__description-full'		: 'before',
					'#shopify-section-bbar-product-template #product-view'																			: 'after',
					'#shopify-section-product--static .product-form-product--static'																: 'after',
					'#shopify-section-static-product .product--container article.product--outer'													: 'after',
					'#shopify-section-product .product--template[data-section-id="product"][data-section-type="product"][data-product-template]'	: 'after',
					'#shopify-section-product-description-bottom-template .product_form form.shopify-product-form'									: 'after',
					'#shopify-section-module-product [data-section-id="module-product"]'															: 'after',
					'#shopify-section-product #content .pro_main_c > .row:first'																	: 'after',
					'#shopify-section-product-template div.product_section.is-flex'																	: 'after',
					'.product-page--right-column--container .product-form--root form.product-form--container'										: 'after',
					'#shopify-section-product-details-template .container .product.product_section'													: 'after',
					'#shopify-section-product-details-template.shopify-section--product-template .container .product_section.is-flex'				: 'after',
					'.product .product-details'																										: 'after',
					'.pro-page #ProductSection-product-template-default .product-default .product_top'												: 'after',
					'.AddToCartForm  .item-content [data-key="accordion"]'																			: 'before',
					'div.product-area'																												: 'after',
					'.main__wrapper #content ~ .product__wrapper'																					: 'after',
					'[data-section-type="product"] .product .product__container'																	: 'after',
					'div[itemtype="http://schema.org/Product"][data-section-type="product"] .row.product-single'									: 'after',
					'#m-product .product-data'																										: 'after',
					'.shopify-section [x-data="product()"]'																							: 'after',
					'div[itemtype="http://schema.org/Product"] #shopify-section-product-details'													: 'before',
					'.product .container .product__row .product__col .product-accordion'															: 'after',
					'#__pf [data-pf-type="Layout"] [data-pf-type="Column"] [data-checkout="checkout"]:visible'										: 'after',
					'.product__info-container product-form.product-form'																			: 'after',
					'.product__row'																													: 'after',
					'article#product-description form.product__form-container.product_form'															: 'after',
					'product-page.main-product.grid'																								: 'after',
					'#ProductSection-product-template form[action*="/cart/add"]'																	: 'after',
					'.product.product--large'																										: 'after',
					'.border-grid-color[data-section-type="product"]'																				: 'after',
					'.gryffeditor form.AddToCartForm'																								: 'after',
					'#product-box'																													: 'after',
					'.block-section .product-page'																									: 'after',
					'#section-product'																												: 'after',
					'.product--stacked.product--medium'																								: 'after',
					//'div[class*="lg:sticky"] form[id^="product-card--"][data-type="add-to-cart-form"]'												: 'after'
				},
				discountedBundleProducts: {},
				activeBundle: {},
				objectToArray: function(object) {
					var array = [];
					var order = [];
					for (var property in object) {
						if (object.hasOwnProperty(property)) {
							if (object[property].hasOwnProperty('sequence')) {
								var sequence = object[property]['sequence'];
								if (typeof order[sequence] === 'undefined') {
									order[sequence] = object[property];
								} else {
									order.push(object[property]);
								}
							}
						}
					}

					if (order.length > 0) {
						for(var i = 0; i<order.length; i++) {
							if (typeof order[i] !== 'undefined') {
								array.push(order[i]);
							}
						}
					} else {
						for (var property in object) {
							if (object.hasOwnProperty(property)) {
								array.push(object[property]);
							}
						}
					}
					return array;
				},
				// Flag which is switched to false if one of the products isn't in stock or the variants are misconfigured.
				widgetCanBeDisplayed: true,
				renderedBundles: {}, // contains a list of bundle keys which are already rendered
				setObserver: function(bundle, keySelector, customCallback) {
					
					// Set intersection observer
										
						var rootMargin = '0px 0px 0px 0px';
						var threshold = 0.25;
						var root = null; // Defaults to viewport
						
						if (typeof window.bndlrPOSShowBundles !== 'undefined' && window.bndlrPOSShowBundles === true) {							
							rootMargin = '0px 0px 500px 0px';
							threshold = 0;
							root = document; // Set the root to document otherwise the bundles won't show up on iOS in POS app.
							/*
							if (typeof debug === 'function') {
								debug('test');
							}
							
							if (typeof customCallback !== 'function') {
								this.displayBundle(bundle, keySelector);
							} else {
								customCallback();
							}
							
							return true;
							*/
						}
					
						if (typeof IntersectionObserver !== 'undefined') {
							var options = {
								root: root, 
								rootMargin: rootMargin,
								threshold: threshold
							}

							var callback = function(entries, observer) {

								for (var i = 0; i<entries.length; i++) {
									var entry = entries[i];
									
									/*
									if (typeof debug === 'function') {
										debug('entry.isIntersecting: '+entry.isIntersecting.toString()+' '+'entry.boundingClientRect.top: '+entry.boundingClientRect.top.toString());
									}
									*/

									if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
										
										// Show bundle if the entry is intersecting or is displayed above the viewport (entry.boundingClientRect.top < 0)
										observer.unobserve(entry.target);
										if (typeof customCallback !== 'function') {
											idleCallback(function() {
												bndlr.displayBundle(bundle, keySelector)
											});
										} else {
											customCallback();
										}
									}
									
									// Each entry describes an intersection change for one observed
									// target element:
									//   entry.boundingClientRect
									//   entry.intersectionRatio
									//   entry.intersectionRect
									//   entry.isIntersecting
									//   entry.rootBounds
									//   entry.target
									//   entry.time
								}
							};

							var observer = new IntersectionObserver(callback, options);
							
							var target = document.querySelector(keySelector);
							
							if (target !== null) {
								observer.observe(target);
							}
						} else {
							this.displayBundle(bundle, keySelector);
						}
						
									},
				displayBundle: function(bundle, keySelector) {
					// Could cause problems in popups or is the same bundle is more than once in the same page. We should also pass the selector to the function, so we don't modify other widgets of the same bundle on the page ;)

					this.widgetCanBeDisplayed = true;
					
					// Displays bundle on product page
					var bundleKey = utils.getRandomString();

					// Recalculate discounted product prices and save the new values to the lib
					var discountedProducts = Library.DiscountedProducts.get(bundle.id);
					discountedProducts = this.modifyProductsPrices(bundle, discountedProducts);
					Library.DiscountedProducts.set(bundle.id, discountedProducts);

					var sectionedBundlesProducts = Library.SectionedBundlesProducts.get(bundle.id);
					for (var i = 0; i < sectionedBundlesProducts.length; i++) {
						
						for(var k in sectionedBundlesProducts[i]) {
							if (Object.keys(sectionedBundlesProducts[i][k]).length === 0) {
								// This product wasn't retrieved due to some error 
								// Remove it 
								delete sectionedBundlesProducts[i][k];
							}
						}
						
						// TODO Use the sectionedModifyProductsPrices 
						sectionedBundlesProducts[i] = this.modifyProductsPrices(bundle, sectionedBundlesProducts[i], false, '', i);
					}

					Library.SectionedBundlesProducts.set(bundle.id, sectionedBundlesProducts);


					// Set linePrice and compareAtPrice for requiredProducts
					Tools.Products.setRequiredVariantLinePrices(Library, bundle);
					
					var requiredProducts 	= Library.RequiredProducts.get(bundle.id);
					var allProducts 		= Library.Products.get();

					var orderedProducts = this.objectToArray(bundle.products);
					
					var bundleRequiredProducts = [];
					if (bundle.minimum_requirements == 'specific_products') {
						bundleRequiredProducts = this.objectToArray(bundle.required_products);
					}
					
					var bundleName = bundle.name.replace('"', '').replace(/<[^>]*>?/gm, '');
					
					var canDisplayBundle = true;
					
					var hideProductsIfImageIsSet = true;
										
					
					if (bundle.mix_and_match_display === 'true' && (bundle.minimum_requirements === 'n_products' || bundle.minimum_requirements === 'tiered_n_products')) {
						
						try {
							var bundleHtml = ''+
								'<div id="_bndl_'+bundleKey+'" class="bndlr-container bndlr-mixnmatch" data-bndlr-key="'+bundleKey+'" data-bundle-name="'+ bundleName +'">' + 
									'<div class="bndlr-products-container">';
										bundleHtml += widgetView.getBundleTitle(bundle.title, bundle.name, bundle.id);
										bundleHtml += '<div class="bndlr-bundle-description">' + bundle.description + '</div>';
										
										bundleHtml += '<div class="bndlr-inner-products-container">';
											
											if (bundle.product_level == 'variant' && bundle.bundle_image !== '') {
												// Show custom bundle image
												bundleHtml += widgetView.getBundleImage(bundle.bundle_image, bundle.title, bundle.name, bundle.id);
											}
											
											bundleHtml += '<div class="bndlr-mnm-available-products">';

												for (var p = 0; p < orderedProducts.length; p++) {
													var productId = orderedProducts[p].id;
													if (typeof discountedProducts[productId] !== 'undefined') {

														var isRequired = (orderedProducts[p].required === 1 ? true: false);
														var productHtml = this.getMixAndMatchProductHtml(discountedProducts[productId], bundle, isRequired);
														
														bundleHtml += productHtml;
													}
												}
												
											bundleHtml += '</div>';
											
											bundleHtml += '<div class="bndlr-mnm-second-container">';
											
												bundleHtml += '<div class="bndlr-mnm-selected-products-title bndlr-hidden bndlr-toggle">';
													bundleHtml += 'Your bundle:';
												bundleHtml += '</div>';
											
												bundleHtml += '<div class="bndlr-mnm-selected-products bndlr-hidden bndlr-toggle">';
												bundleHtml += '</div>';
												
												bundleHtml += '<div class="bndlr-mnm-add-to-cart-wrapper">';
													bundleHtml += '<span class="bndlr-mnm-instructions-text">';
														bundleHtml += this.MixNMatch.getInstructionsText(bundle, 0, true);
													bundleHtml += '</span>';
													
																											var acAttr = '';
																													acAttr = 'data-ac-enabled="true"';
																												bundleHtml += '<div class="sealsubs-target-element-bundle sealsubs-target-element" style="display:none" data-product-handles="" '+acAttr+'></div>';
																										
													if (bundle.total_price_text !== '') {
														bundleHtml += '<div class="bndlr-mnm-total-price bndlr-hidden"></div>';
													}
													
													bundleHtml += '<div class="bndlr-tiered-mnm-instructions-text bndlr-hidden">';
														bundleHtml += '<div class="bndlr-tiered-mnm-instructions-text-inner">';
															bundleHtml += this.MixNMatch.getInstructionsTextTiered(bundle, 0, true);
														bundleHtml += '</div>';
													bundleHtml += '</div>';
													
													var addToCartButtonText = bundle.button_text;
													
													if (bundle.minimum_requirements !== 'tiered_n_products') {
																													bundleHtml += '<div class="bndlr-add-bundle-to-cart bndlr-hidden" title="'+addToCartButtonText.replace('"', '')+'" data-active="'+this.widgetCanBeDisplayed.toString()+'" tabindex="0" role="button">' + addToCartButtonText + '</div>';
																											} else {
														bundleHtml += '<div class="bndlr-add-bundle-to-cart bndlr-hidden" title="'+addToCartButtonText.replace('"', '')+'" data-active="'+this.widgetCanBeDisplayed.toString()+'" tabindex="0" role="button">' + addToCartButtonText + '</div>';
													}
													
													

													
													bundleHtml += '<div class="bndlr-bundle-checkout-warning bndlr-hidden">'+ bundle.discount_warning +'</div>';
													
												bundleHtml += '</div>';
											
											bundleHtml += '</div>';
										bundleHtml += '</div>';
										
										
									bundleHtml += '</div>';
								bundleHtml += '</div>';
							
							var htmlSelector = '.bundler-target-element[data-bundle="'+bundle.id+'"]';
							
																						
								//if (typeof window.BndlrIsBundleLandingPage !== 'undefined' && window.BndlrIsBundleLandingPage === true) {
								if (this.canShowFloatingStatusBox() && $('#bndlr-mnm-status-box').length === 0) {
									
									// We are on a bundle landing page
									// Add bundle status box
									var bundleStatusBox = '<div id="bndlr-mnm-status-box" class="bndlr-visibility-visible" data-bndlr-bundle-key="'+bundleKey+'">'+
										'<div class="bdnlr-mnm-status-box-products-container">' +
										'</div>' +
										'<div class="bdnlr-mnm-status-box-info-container">' +
											'<span class="bndlr-mnm-instructions-text">' +
												this.MixNMatch.getInstructionsText(bundle, 0, true) +
											'</span>' +
											'<div class="bndlr-status-box-add-to-cart bndlr-hidden" title="'+addToCartButtonText.replace('"', '')+'" data-active="'+this.widgetCanBeDisplayed.toString()+'" tabindex="0" role="button">' + addToCartButtonText + '</div>';
										'</div>' +
									'</div>';
									$('body').append(bundleStatusBox);
									this.MixNMatch.showHideStatusBox();
								}
													
						} catch(e) {
							bundlerConsole.log(e);
							canDisplayBundle = false;
						}
						
					} else if (bundle.minimum_requirements === 'sectioned_n_products') {
						
						try {

							var bundleHtml = '';

                                bundleHtml += '<div id="_bndl_'+bundleKey+'" class="bndlr-container" data-bndlr-key="'+bundleKey+'" data-bundle-name="'+ bundleName +'">';

                                    if (bundle.title !== "" || bundle.description !== "") {
                                        bundleHtml += '<div class="bndlr-sectioned-title">';
                                            if (bundle.title !== "") {
                                                bundleHtml += '<h2 class="bndlr-bundle-title" role="heading">' + bundle.title +'</h2>';
                                            }
                                            if (bundle.description !== "") {
                                                bundleHtml += '<div class="bndlr-bundle-description" role="heading">' + bundle.description +'</h2> </div>';
                                            }
                                        bundleHtml += '</div>';
                                    }

                                    bundleHtml += '<div class="bndlr-products-container bndlr-sectioned-mixnmatch"> ';
										
										// TODO: Add progress bar for the sectioned bundle 
										/*
										bundleHtml += '<div class="bndlr-sections-progress-line">';
											for(var n = 0; n < bundle.sections.length; n++) {
												bundleHtml += '<div class="bndlr-section-title-dot">' + bundle.sections[n].name + '</div>';
											}											
										bundleHtml += '</div>';
										*/
										
										bundleHtml += '<div class="bndlr-sections-main-container" data-bundler-active-section="0">';
											
											bundleHtml += '<div class="bndlr-sections-container">';
											
												bundleHtml += '<div class="b--ndlr-inner-products-container">';
													
													for(var n = 0; n < bundle.sections.length; n++) {
														var orderedProducts = this.objectToArray(bundle.sections[n].products);
														
														bundleHtml += '<div class="bndlr-sectioned-section" data-bundler-section="' + n + '">';
														
															bundleHtml += '<h2 class="bndlr-section-main-title" role="heading">'+bundle.sections[n].name+'</h2>';
															bundleHtml += '<div class="bndlr-section-description">' + bundle.sections[n].description + '</div>';
											
														
															bundleHtml += '<div class="bndlr-sectioned-available-products" data-bundler-section="' + n + '">';

																for (var p = 0; p < orderedProducts.length; p++) {
																	var productId = orderedProducts[p].id;

																	if (typeof sectionedBundlesProducts[n][productId] !== 'undefined') {

                                                                        var isRequired = false;
                                                                        if (typeof bundle.sections[n].products[productId].required !== 'undefined') {
                                                                            if (bundle.sections[n].products[productId].required === 1) {
                                                                                isRequired = true
                                                                            }
                                                                        }

                                                                        var productHtml = this.getSectionedProductHtml(sectionedBundlesProducts[n][productId], bundle, n, isRequired);
                                                                        bundleHtml += productHtml;
                                                                    }
																}
															
															bundleHtml += '</div>';
														if (n < bundle.sections.length - 1) {
															// sectioned_move_to_next_section_text
															bundleHtml += '<span class="sr-only bndlr-sr-only">Activating this element will cause content on the page to be updated.</span>'; // grovia
															bundleHtml += '<div class="bndlr-next-section bndlr-shine-animation">Move to next section</div>';
														}

                                                        bundleHtml += '<div class="bndlr-sectioned-required-instructions-text bndlr-mnm-instructions-text">';
                                                            bundleHtml += this.sectionedGetRequiredInstructionsText(bundleKey, n);
                                                        bundleHtml += '</div>';

														bundleHtml += '</div>';
													}

												bundleHtml += '</div>';
											bundleHtml += '</div>';
											
											
											bundleHtml += '<div class="bndlr-sections-status-container" role="complementary">';
											
																								
													// List each section and it's products
													for(var n = 0; n < bundle.sections.length; n++) {
														bundleHtml += '<div class="bndlr-sectioned-section-status" data-bundler-section-status="' + n + '" data-requirements-fulfilled="false">';
															bundleHtml += '<span class="sr-only bndlr-sr-only">Activating this element will cause content on the page to be updated.</span>'; // grovia
															bundleHtml += '<div class="bndlr-sectioned-section-name" role="button" tabindex="0">';
																bundleHtml += '<span class="bndlr-section-name-number">'+(n+1)+'</span>';
																bundleHtml += ' <span class="bndlr-section-name-text" role="button">'+bundle.sections[n].name+'</span>';
																bundleHtml += '<span class="bndlr-section-name-checkmark">'+htmlUtils.svgCheckmark+'</span>';
																bundleHtml += '<span class="bndlr-section-name-line"></span>';
															bundleHtml += '</div>';
															bundleHtml += '<div class="bndlr-sectioned-section-products">';
															bundleHtml += '</div>';
															bundleHtml += '<div class="bndlr-section-name-connector-line">';
																bundleHtml += '<svg class="bndlr-dashed-line" height="100%" role="img" aria-label="dashed line">';
																	bundleHtml += '<line y1="0" x1="0" x2="0" y2="100%"></line>';
																bundleHtml += '</svg>';
															bundleHtml += '</div>';
														bundleHtml += '</div>';
													}
												
													
													
													/*
													bundleHtml += '<div class="bndlr-mnm-selected-products-title bndlr-hidden bndlr-toggle">';
														bundleHtml += 'Your bundle:';
													bundleHtml += '</div>';
												
													bundleHtml += '<div class="bndlr-mnm-selected-products bndlr-hidden bndlr-toggle">';
													bundleHtml += '</div>';
													
													bundleHtml += '<div class="bndlr-mnm-add-to-cart-wrapper">';
														bundleHtml += '<span class="bndlr-mnm-instructions-text">';
															bundleHtml += this.MixNMatch.getInstructionsText(bundle, 0, true);
														bundleHtml += '</span>';
														
																													var acAttr = '';
																															acAttr = 'data-ac-enabled="true"';
																														bundleHtml += '<div class="sealsubs-target-element-bundle sealsubs-target-element" style="display:none" data-product-handles="" '+acAttr+'></div>';
																												
														if (bundle.total_price_text !== '') {
															bundleHtml += '<div class="bndlr-mnm-total-price bndlr-hidden"></div>';
														}
														
														var addToCartButtonText = bundle.button_text;										
														bundleHtml += '<div class="bndlr-add-bundle-to-cart bndlr-hidden" title="'+addToCartButtonText.replace('"', '')+'" data-active="'+this.widgetCanBeDisplayed.toString()+'" tabindex="0" role="button">' + addToCartButtonText + '</div>';
														bundleHtml += '<div class="bndlr-bundle-checkout-warning bndlr-hidden">'+ bundle.discount_warning +'</div>';
														
													bundleHtml += '</div>';
													*/
													
													bundleHtml += '<div class="bndlr-sectioned-instructions-text">';
														bundleHtml += this.sectionedGetInstructionsText();
													bundleHtml += '</div>';
													
																											var acAttr = '';
																													acAttr = 'data-ac-enabled="true"';
																												bundleHtml += '<div class="sealsubs-target-element-bundle sealsubs-target-element" style="display:none" data-product-handles="" '+acAttr+'></div>';
																										
													if (bundle.total_price_text !== '') {
														bundleHtml += '<div class="bndlr-sectioned-total-price bndlr-hidden"></div>';
													}
												
													var addToCartButtonText = bundle.button_text;
													bundleHtml += '<div class="bndlr-add-sectioned-bundle-to-cart bndlr-disabled" title="'+addToCartButtonText.replace('"', '')+'" data-active="'+this.widgetCanBeDisplayed.toString()+'" tabindex="0" role="button">' + addToCartButtonText + '</div>';
													bundleHtml += '<div class="bndlr-warning-container" style="display:none;"></div>';
													bundleHtml += '<div class="bndlr-bundle-checkout-warning bndlr-hidden">'+ bundle.discount_warning +'</div>';
											
																								
											
											bundleHtml += '</div>';
										bundleHtml += '</div>';
										
									bundleHtml += '</div>';
								bundleHtml += '</div>';
							
							var htmlSelector = '.bundler-target-element[data-bundle="'+bundle.id+'"]';
						
						} catch(e) {
							bundlerConsole.log(e);
							canDisplayBundle = false;
						}
						
					} else {
					
						try {
							var bundleHtml = ''+
								'<div id="_bndl_'+bundleKey+'" class="bndlr-container" data-bndlr-key="'+bundleKey+'" data-bundle-name="'+ bundleName +'">' + 
									'<div class="bndlr-products-container">';
										bundleHtml += widgetView.getBundleTitle(bundle.title, bundle.name, bundle.id);
										
										bundleHtml += '<div class="bndlr-bundle-description">' + this.replacePricePlaceholders(bundle.description, bundle, bundleKey) + '</div>';
										
										bundleHtml += '<div class="bndlr-inner-products-container">';
											
											if (bundle.product_level == 'variant' && bundle.bundle_image !== '') {
												// Show custom bundle image
												bundleHtml += widgetView.getBundleImage(bundle.bundle_image, bundle.title, bundle.name, bundle.id);
											}
											
											var style = ''
											if (bundle.product_level == 'variant' && bundle.bundle_image !== '' && hideProductsIfImageIsSet) {
												// Hide products because we will show custom bundle image
												style='display:none;';
											}

											bundleHtml += '<div style="'+style+'">';

												for (var p = 0; p < bundleRequiredProducts.length; p++) {
													var productId = bundleRequiredProducts[p].id;
													if (typeof requiredProducts[productId] !== 'undefined') {

														var productHtml = this.getProductHtml(requiredProducts[productId], bundle, true);
														
														bundleHtml += productHtml;
													}
												}
											
												for (var p = 0; p < orderedProducts.length; p++) {
													var productId = orderedProducts[p].id;
													if (typeof discountedProducts[productId] !== 'undefined') {

														var productHtml = this.getProductHtml(discountedProducts[productId], bundle);
														
														bundleHtml += productHtml;
													}
												}
												
											bundleHtml += '</div>';

											

											if (bundle.product_level == 'variant' && bundle.bundle_image !== '' && bundle.list_product_names === 'true' && hideProductsIfImageIsSet) {
												// Add list of product names
												bundleHtml += '<div class="bndlr-product-names-list">';
												
													var listSeparator = ', ';
																									
													// Get required and bundle products and show their names!
													for (var p = 0; p < orderedProducts.length; p++) {
														var productId = orderedProducts[p].id;
														if (typeof discountedProducts[productId] !== 'undefined') {

															var productHtml = this.getProductListName(discountedProducts[productId], bundle, false, bundleKey);
															
															bundleHtml += productHtml + listSeparator;
														}
													}
													
													for (var p = 0; p < bundleRequiredProducts.length; p++) {
														var productId = bundleRequiredProducts[p].id;
														if (typeof requiredProducts[productId] !== 'undefined') {

															var productHtml = this.getProductListName(requiredProducts[productId], bundle, true, bundleKey);

															bundleHtml += productHtml + listSeparator;
														}
													}
													
													// Strip last comma
													bundleHtml = bundleHtml.replace(/,\s*$/, '').replace(/,<br \/>$/, '');

												bundleHtml += '</div>';
											}

																						
												var combinedProducts = {};
												for (var p = 0; p < orderedProducts.length; p++) {
													var productId = orderedProducts[p].id;
													if (typeof allProducts[productId] !== 'undefined') {
														var productHandle = allProducts[productId].handle;
														combinedProducts[productHandle] = allProducts[productId];
													}
												}
												
												for (var p = 0; p < bundleRequiredProducts.length; p++) {
													var productId = bundleRequiredProducts[p].id;
													if (typeof allProducts[productId] !== 'undefined') {
														var productHandle = allProducts[productId].handle;
														combinedProducts[productHandle] = allProducts[productId];
													}
												}
												
												var acAttr = '';
																									acAttr = 'data-ac-enabled="true"';
												
												var isProductSellingPlanOnly = this.getIfSellingPlan(productId, bundle);									
												bundleHtml += '<div class="sealsubs-target-element-bundle sealsubs-target-element" data-product-handles="'+utils.getListOfValues(combinedProducts, 'handle')+'" data-subscription-only="'+isProductSellingPlanOnly+'"  '+acAttr+'></div>';
												
																						
											
											if (bundle.total_price_text !== '') {
												bundleHtml += '<div class="bndlr-total-price">' + this.getTotalPriceText(bundle, bundleKey) + '</div>';
												
												
												
																							}
											
											var addToCartButtonText = bundle.button_text;
																							if (this.widgetCanBeDisplayed === false) {
													addToCartButtonText = 'Out of stock';
												}
																						
											
											addToCartButtonText = this.replacePricePlaceholders(addToCartButtonText, bundle, bundleKey);
											
																						
																									bundleHtml += '<div class="bndlr-add-to-cart" title="'+addToCartButtonText.replace(/"/g, '')+'" data-active="'+this.widgetCanBeDisplayed.toString()+'" tabindex="0" role="button">' + addToCartButtonText + '</div>';
																																		
											
											
											
										bundleHtml += '</div>';
							
										
										bundleHtml += '<div class="bndlr-bundle-checkout-warning">'+ bundle.discount_warning +'</div>';
										
																				
							
									bundleHtml += '</div>';
								bundleHtml += '</div>';
							
							var htmlSelector = '.bundler-target-element[data-bundle="'+bundle.id+'"]';
						
						} catch(e) {
							bundlerConsole.log(e);
							canDisplayBundle = false;
						}
					
					}
					
					if (canDisplayBundle === false) {
						bundlerConsole.log('Skipping bundle', bundle.name);
						return true;
					}
					
					if (typeof keySelector === 'string') {
						$element = $(keySelector);
					} else {
						$element = $(htmlSelector);
					}
					
										
					if ($element.length > 0) {
						
						var $bundle = $(bundleHtml);
													if (this.widgetCanBeDisplayed === false) {
								$bundle.attr('data-available', 'false');
							}
												
						var $addtcButton = $bundle.find('.bndlr-add-to-cart');
						$addtcButton.off('click');
						$addtcButton.click(function(e) {
							bndlr.addToCart($(this));
							e.stopPropagation();
						});
						
						$element.html($bundle);
						bndlr.renderedBundles[bundleKey] = true;
						
						// Calculate the perfect product width
													this.setProductWidth(htmlSelector, $element);
											}					
					
					idleCallback(function() {
						/*
						if (bndlr.repositionPlusSignsTimeout != false) {
							clearTimeout(bndlr.repositionPlusSignsTimeout);
						}
						var self = this;
						bndlr.repositionPlusSignsTimeout = setTimeout(function() {
							self.repositionPlusSigns('#_bndl_'+bundleKey);
						}, 200);*/
						var self = this;
						debounce('reposition-plus-signs'+bundleKey, function() { // Add bundle key, as we call this for each bundle separately.
							self.repositionPlusSigns('#_bndl_'+bundleKey, $bundle);
						}, 200);
						
						$(document).trigger('bundler_bundle_widget_created');
					
						try {
							var event = new CustomEvent("bundler:bundle_widget_created", {
								detail: {
									products: JSON.parse(JSON.stringify(allProducts))
								}
							});
							document.dispatchEvent(event);
						} catch(e) {
							bundlerConsole.log(e);
						}
						
						if (bundle.minimum_requirements === 'sectioned_n_products') {
							this.sectionedMarkRequirementsFulfilled(bundleKey, bundle);
						}
						
					}.bind(bndlr));
					
					
					
					// Select the preselected products
					/*
					if (bundle.mix_and_match_display === 'true' && bundle.minimum_requirements === 'n_products') {
						bndlr.MixNMatch.addPreselectedProductsToBundle($(htmlSelector));
					}*/
				},
				repositionPlusSignsTimeout: false,
				repositionPlusSigns: function(selector, $element) {
					
					// Reposition plus signs if the total height of elements is the same as height of their's container element
					if (typeof $element !== 'undefined') {
						if ($element.length > 0) {
							this.repositionPlusSign($element);
							this.repositionPlusSignForMixNMatch($element);
						}
					} else if (typeof selector !== 'undefined') {
						var el = $(selector);
						if (el.length > 0) {
							this.repositionPlusSign(el);
							this.repositionPlusSignForMixNMatch(el);
						}
						
					} else {
						$('.bundler-target-element .bndlr-container').each(function(key, el) {
							bndlr.repositionPlusSign($(el));
						});
						
						// Check the selected products for mix&match bundles
						$('.bundler-target-element .bndlr-mnm-selected-products').each(function(key, el) {
							bndlr.repositionPlusSignForMixNMatch($(el));
						});
					}					
				},
				repositionPlusSign: function($el) {
					
					if ($el.hasClass('bndlr-mixnmatch') || $el.find('.bndlr-mixnmatch').length) {
						// This is a mix&match bundle widget
						// Skip it.
						return true;
					}
					var totalHeight = 0;
					$el.find('.bndlr-product').each(function(key, el) {
						totalHeight += $(el).outerHeight(true);
					});
					
					if (Math.floor(totalHeight) == Math.floor($el.find('.bndlr-inner-products-container div').first().height())) {
						$el.find('.bndlr-inner-products-container').addClass('bndlr-break-plus-signs');
					} else {
						$el.find('.bndlr-inner-products-container').removeClass('bndlr-break-plus-signs');
					}
				},
				repositionPlusSignForMixNMatch: function($el) {
					var totalHeight = 0;
					$el = $el.find('.bndlr-mnm-selected-products').first();
					if (typeof $el !== 'undefined') {
						$el.find('.bndlr-product').each(function(key, el) {
							totalHeight += $(el).outerHeight(true);
						});

						if (Math.floor(totalHeight) == Math.floor($el.height())) {
							$el.closest('.bndlr-inner-products-container').addClass('bndlr-break-plus-signs');
						} else {
							$el.closest('.bndlr-inner-products-container').removeClass('bndlr-break-plus-signs');
						}
					}
				},
				setProductWidth: function(bundleSelector, $element) {
					
																	
						// NON compressed version
						if (typeof $element === 'undefined') {
							$element = $(bundleSelector);
						}
						
						if ($element.length === 0) {
							return;
						}

						var boundingClientWidth = $element[0].getBoundingClientRect().width;
						var paddingValue 		= 14; // 7px padding on both sides
						
												
						var isInPopup = false
						if ($element.closest('.bundles-bundler-hop-full-page-overlay').length > 0) {
							// The bundle is in the promotion popup
							// Take max allowed width
							
							var bodyWidth = $('body')[0].getBoundingClientRect().width;
							
							if (bodyWidth < 400) {
								// We are on a smaller device
								boundingClientWidth = bodyWidth*0.9-18;
								
								// On iOS on iPhone, it can happen that the width is returned as 0
								if (boundingClientWidth < 70) {
									boundingClientWidth = $('body')[0].offsetWidth*0.9-18;
								}
								isInPopup = true;
							} else {
								boundingClientWidth = bodyWidth*0.9-18;
								isInPopup 			= true;
							}
							paddingValue = 0; // We don't have any padding in popup
						}
						
						if (boundingClientWidth > 0) {
							// Only size products in visible elements
						
							boundingClientWidth -= paddingValue; // Substract 7px padding on both sides
							var productsNum = $(bundleSelector + ' .bndlr-product').length;

							if (productsNum >= 2) {
								// Check if we need big or small images
								if (typeof window.BndlrIsBundleLandingPage !== 'undefined' && window.BndlrIsBundleLandingPage) {
									var productWidth = 340; // For border-box sizing. This is width (318px + 10px padding + 2px border = 330px) + margin (5px) on both sides.
									
									if (typeof clientSpecifics['product_dimensions'] !== 'undefined') {
										productWidth = clientSpecifics['product_dimensions'].getLadingPageWidth()+10; // Add margin (10px)
									}
									
								} else {
									var productWidth = 240; // For border-box sizing. This is width (218px + 10px padding + 2px border = 230px) + margin (5px) on both sides.
									
									if (typeof clientSpecifics['product_dimensions'] !== 'undefined') {
										productWidth = clientSpecifics['product_dimensions'].getStandardWidth()+10; // Add margin (10px)
									}
								}
								
								var minProducts = 2; // Minimum number of products that have to fit in the box.
								var minProductWidth = 140;
								
								
								
								if (boundingClientWidth <= 550) {
									// decrease the minimum product width for tight displays
									minProductWidth = 120;
								}
								
																
																
																
								if (isInPopup) {
									minProductWidth = 100; // Increased from 70 to 100 on 2023-03-01 because the 70px is way too small.
																	}
								
								if (productsNum > 6) {
									minProducts = 6;
									
																	} else {
									minProducts = productsNum;
								}
								
																
								
								if (productWidth*minProducts > boundingClientWidth) {
									// We can't fit N products in this box. Make products smaller
									var perfectWidth = boundingClientWidth/minProducts - 10;
									var $products = $element.find('.bndlr-product');
									
									if (perfectWidth > minProductWidth && perfectWidth < productWidth) {
										$products.css({'max-width': Math.floor(perfectWidth)});
									} else {
										var widthFound = false;
										
										if (minProducts%2 === 0) {
											// Even number of products. Try to fit two in a row.
											perfectWidth = boundingClientWidth/2 - 10;

											if (perfectWidth > minProductWidth && perfectWidth < 220) {
												$products.css({'max-width': Math.floor(perfectWidth)});
												widthFound = true;
											}
										}
										
										var currentProductsNum = minProducts - 1;
										while (widthFound === false && currentProductsNum >=1) {
											perfectWidth = boundingClientWidth/currentProductsNum - 10;

											if (perfectWidth > minProductWidth && perfectWidth < productWidth) {
												$products.css({'max-width': Math.floor(perfectWidth)});
												widthFound = true;
											} else {
												currentProductsNum--;
											}
										}
										
										if (widthFound === false) {
											$products.css({'max-width': Math.floor(minProductWidth - 10)});
										}
									}							
								}
							}
						}

									},
				// Calculates total price and replaces total price text with old and new price
				sectionedGetTotalPriceText: function(bundle, sections) {
					var pricesHtmls = this.getSectionedPricesHtmls(sections);
					
					var modifiedText 	= bundle.total_price_text;
					
					if (pricesHtmls.raw_original_price <= pricesHtmls.raw_discounted_price) {
						// Remove {original_price} placeholder, as the original price is the same as discounted price
						modifiedText = modifiedText.replace(/{original_price}\s{0,1}/g, '');
					}
					
					modifiedText 		= modifiedText.replace(/{original_price}/g, pricesHtmls.original_price_html);
					modifiedText 		= modifiedText.replace(/{discounted_price}/g, pricesHtmls.discounted_price_html);
					modifiedText 		= modifiedText.replace(/{savings}/g, pricesHtmls.savings_html);

					return modifiedText;
				},
				// Calculates total price and replaces total price text with old and new price
				getTotalPriceText: function(bundle, bundleKey) {
					// calculate total price
					// calculate discounted price
					// replace text with prices
					// update this text on variant select change
					var pricesHtmls = this.getPricesHtmls(bundle, bundleKey);
					
					var modifiedText 	= bundle.total_price_text;
					
					if (pricesHtmls.raw_original_price <= pricesHtmls.raw_discounted_price) {
						// Remove {original_price} placeholder, as the original price is the same as discounted price
						modifiedText = modifiedText.replace(/{original_price}\s{0,1}/g, '');
					}
					
					modifiedText 		= modifiedText.replace(/{original_price}/g, pricesHtmls.original_price_html);
					modifiedText 		= modifiedText.replace(/{discounted_price}/g, pricesHtmls.discounted_price_html);
					modifiedText 		= modifiedText.replace(/{savings}/g, pricesHtmls.savings_html);

					return modifiedText;
				},
				// Calculates total price and replaces total price text with old and new price
				getMixNMatchTotalPriceText: function(bundle, products) {
					var pricesHtmls = this.getPricesHtmls(null, null, products);
					
					var modifiedText 	= bundle.total_price_text;
					
					if (pricesHtmls.raw_original_price <= pricesHtmls.raw_discounted_price) {
						// Remove {original_price} placeholder, as the original price is the same as discounted price
						modifiedText = modifiedText.replace(/{original_price}\s{0,1}/g, '');
					}
					
					modifiedText 		= modifiedText.replace(/{original_price}/g, pricesHtmls.original_price_html);
					modifiedText 		= modifiedText.replace(/{discounted_price}/g, pricesHtmls.discounted_price_html);
					modifiedText 		= modifiedText.replace(/{savings}/g, pricesHtmls.savings_html);

					return modifiedText;
				},
				// Replaces placeholders {discounter_price}, {original_price}, {savings} with actual values from the bundle
				replacePricePlaceholders: function(string, bundle, bundleKey) {
					var pricesHtmls = this.getPricesHtmls(bundle, bundleKey);
					
					var modifiedText 	= string.replace(/{original_price}/g, pricesHtmls.original_price_html);
					modifiedText 		= modifiedText.replace(/{discounted_price}/g, pricesHtmls.discounted_price_html);
					modifiedText 		= modifiedText.replace(/{savings}/g, pricesHtmls.savings_html);

					return modifiedText;
				},
				getPricesHtmls: function(bundle, bundleKey, products) {
					// Returns all total prices html
					// If you set the third parameter (products), then it will calculate prices just based on the values in this object

					var originalPrice = 0;
					var discountedPrice = 0;
					
					if (typeof products === 'undefined') {
						// Normal bundles
						var bundleId = bundle.id;
						
						var discountedProducts = Library.DiscountedProducts.get(bundleId);

						for(var productId in discountedProducts) {
							if (discountedProducts.hasOwnProperty(productId) && Object.keys(discountedProducts[productId]).length > 0) {
								var product = discountedProducts[productId];
								discountedPrice += this.getSelectedVariantPrice(product, bundleKey, bundleId);
								originalPrice 	+= this.getSelectedVariantOldPrice(product, bundleKey, bundleId);
							}
						}
						
						var requiredProducts = Library.RequiredProducts.get(bundleId);
						
						for(var productId in requiredProducts) {
							if (requiredProducts.hasOwnProperty(productId)) {
								var product = requiredProducts[productId];
								/*
								var price = this.getSelectedVariantOldPrice(product, bundleKey, bundleId, true);
								console.log(price);
								discountedPrice += price;
								originalPrice += price;
								*/
								// Use the same logic as for any other product, as if we use the "compare at price" as base price,
								// then even the required non-discounted product can "have a discount."
								discountedPrice += this.getSelectedVariantPrice(product, bundleKey, bundleId, true);
								originalPrice 	+= this.getSelectedVariantOldPrice(product, bundleKey, bundleId, true);
							}
						}
						
					} else {
						// For mix and match bundles
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var dPrice = 0;
								var oPrice = 0;
								
								var productVariant = products[key].variants[0];
								
								oPrice = this.getVariantOldPrice(productVariant);
								dPrice = this.getVariantDiscountedPrice(productVariant);
								
								discountedPrice += dPrice;
								originalPrice 	+= oPrice;
							}
						}
					}

					//console.log('discountedPrice', discountedPrice);
					//console.log('originalPrice', originalPrice);

					var savings = originalPrice - discountedPrice;
					if (savings < 0) {
						savings = 0;
					}
					
					var currency = this.getDefaultCurrency();

					var originalPriceHtml = this.formatPrice(originalPrice);
					originalPriceHtml = htmlUtils.moneySpan(originalPriceHtml, currency.toLowerCase(), 'bndlr-old-price', '', originalPrice);
					
					var discountedPriceHtml = this.formatPrice(discountedPrice, undefined, 'down');
					discountedPriceHtml = htmlUtils.moneySpan(discountedPriceHtml, currency.toLowerCase(), 'bndlr-new-price', '', discountedPrice);
					
					var savingsHtml = this.formatPrice(savings);
					savingsHtml = htmlUtils.moneySpan(savingsHtml, currency.toLowerCase(), 'bndlr-savings', '', savings);
					
					return {
						'original_price_html' 	: originalPriceHtml,
						'discounted_price_html' : discountedPriceHtml,
						'savings_html' 			: savingsHtml,
						'raw_original_price'	: originalPrice,
						'raw_discounted_price'	: discountedPrice
					};
				},
				getSectionedPricesHtmls: function(sections) {
					// Returns all total prices html
					// If you set the third parameter (products), then it will calculate prices just based on the values in this object

					var originalPrice = 0;
					var discountedPrice = 0;
					
					for (var sectionId in sections) {
						var products = sections[sectionId];
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var dPrice = 0;
								var oPrice = 0;
								
								var productVariant = products[key].variants[0];
								
								oPrice = this.getVariantOldPrice(productVariant);
								dPrice = this.getVariantDiscountedPrice(productVariant);
								
								/*
								console.log('oPrice', oPrice);
								console.log('dPrice', dPrice);
								console.log('----');*/
								
								discountedPrice += dPrice;
								originalPrice 	+= oPrice;
							}
						}
					}
					
					//console.log('discountedPrice', discountedPrice);
					//console.log('originalPrice', originalPrice);

					var savings = originalPrice - discountedPrice;
					if (savings < 0) {
						savings = 0;
					}
					
					var currency = this.getDefaultCurrency();

					var originalPriceHtml = this.formatPrice(originalPrice);
					originalPriceHtml = htmlUtils.moneySpan(originalPriceHtml, currency.toLowerCase(), 'bndlr-old-price', '', originalPrice, 'Original price: ');
					
					var discountedPriceHtml = this.formatPrice(discountedPrice, undefined, 'down');
					discountedPriceHtml = htmlUtils.moneySpan(discountedPriceHtml, currency.toLowerCase(), 'bndlr-new-price', '', discountedPrice, 'Current price: ');
					
					var savingsHtml = this.formatPrice(savings);
					savingsHtml = htmlUtils.moneySpan(savingsHtml, currency.toLowerCase(), 'bndlr-savings', '', savings);
					
					return {
						'original_price_html' 	: originalPriceHtml,
						'discounted_price_html' : discountedPriceHtml,
						'savings_html' 			: savingsHtml,
						'raw_original_price'	: originalPrice,
						'raw_discounted_price'	: discountedPrice
					};
				},
				getSelectedVariant: function(productId, bundleKey, bundleId, forRequiredProduct, sectionId) {
					
					if (typeof forRequiredProduct === 'undefined') {
						forRequiredProduct = false;
					}
					
					if (typeof sectionId === 'undefined') {
						sectionId = '';
					}
					
					var reqProductSelector = '';
					if (forRequiredProduct) {
						reqProductSelector = '.bndlr-product[data-required="true"]';
					} else {
						reqProductSelector = '.bndlr-product[data-required="false"]';
					}
					
					var additionalSelector = reqProductSelector
					
					var sectionSelector = '';
					if (sectionId !== '') {
						sectionSelector = '[data-bundler-section="'+ sectionId +'"]';
						
						additionalSelector = sectionSelector;
					}
					
					if (typeof this.renderedBundles[bundleKey] !== 'undefined') {
						if (typeof bundleKey !== 'undefined' && bundleKey !== '') {
							// Get selected variant id by bundle key
							var variantId = $('#_bndl_'+bundleKey).find(additionalSelector+' select.bndlr-select-variant.id_'+productId+' option:selected').val();
						} else if(typeof bundleId !== 'undefined' && bundleId !== '') {
							console.log('Retrieving selected variant id by bundle id'); // Shouldn't happen at all
							// Get selected variant id by bundle id
							var variantId = $('[data-bundle="'+bundleId+'"] '+additionalSelector+' select.bndlr-select-variant.id_'+productId+' option:selected').val();
						} else {
							// Get one of the selected variant ids (Shouldn't happen).
							bundlerConsole.log('bundle id and bundle key are missing');
							
							var variantId = $(additionalSelector+' select.bndlr-select-variant.id_'+productId+' option:selected').val();
						}
					}

/*
					if (typeof bundleKey !== 'undefined' && bundleKey !== '') {
						// Get selected variant id by bundle key
						var variantId = $('[data-bndlr-key="'+bundleKey+'"] '+reqProductSelector+' select.bndlr-select-variant.id_'+productId+' option:selected').val();
					} else if(typeof bundleId !== 'undefined' && bundleId !== '') {
						// Get selected variant id by bundle id
						var variantId = $('[data-bundle="'+bundleId+'"] '+reqProductSelector+' select.bndlr-select-variant.id_'+productId+' option:selected').val();
					} else {
						// Get one of the selected variant ids (Shouldn't happen).
						bundlerConsole.log('bundle id and bundle key are missing');
						
						var variantId = $(reqProductSelector+' select.bndlr-select-variant.id_'+productId+' option:selected').val();
					}*/
					
					if (typeof variantId === 'undefined') {
						/* Variant selector doesn't exist yet. Return first variant id which is discounted in the bundle. */
						/* discountedBundleProducts are already retrieved products from Shopify */
						/* activeBundle is active bundle with variant definition */
						var bundle = this.getBundleById(bundleId);
						
						/*
						if (sectionId === '') {
							console.trace();
						}*/
						
						if (bundle.minimum_requirements === 'sectioned_n_products' && sectionId !== '') {
							var sectionedBundlesProducts = Library.SectionedBundlesProducts.get(bundleId);
							
							if (typeof sectionedBundlesProducts[sectionId] !== 'undefined') {
								var productsLib = sectionedBundlesProducts[sectionId];
							}
							
							sectionSelector = '[data-bundler-section="'+ sectionId +'"]';
						} else {
						
							if (forRequiredProduct) {
								var productsLib = Library.RequiredProducts.get(bundleId);
							} else {
								var productsLib = Library.DiscountedProducts.get(bundleId);
							}
						}
						
						if (productsLib[productId] !== 'undefined' 
								&& (
									(
										forRequiredProduct === false
										&& typeof bundle.products !== 'undefined' 
										&& typeof bundle.products[productId] !== 'undefined'
									) || (
										forRequiredProduct
										&& typeof bundle.required_products !== 'undefined' 
										&& typeof bundle.required_products[productId] !== 'undefined'
									) || (
										bundle.minimum_requirements === 'sectioned_n_products'
										&& typeof bundle.sections !== 'undefined' 
										&& typeof bundle.sections[sectionId] !== 'undefined'
										&& typeof bundle.sections[sectionId].products[productId] !== 'undefined'
									)
								)
							) {

							var productVariants = productsLib[productId].variants;

							if (bundle.minimum_requirements === 'sectioned_n_products' && sectionId !== '') {

								var productFromBundle = bundle.sections[sectionId].products[productId];

							} else {
								if (forRequiredProduct) {
									var productFromBundle = bundle.required_products[productId];
								} else {
									var productFromBundle = bundle.products[productId];
								}
							}
							
							for (var vi = 0; vi < productVariants.length; vi++) {
								// Loop through all variants
								
																
								if (typeof productFromBundle.variants[productVariants[vi].id] !== 'undefined') {
									// Variant found	
									
									return productVariants[vi].id;
								}
							}
						}

						return false;
					} else {
						return variantId;
					}
				},
				getPrice: function(price) {
					if (typeof price.indexOf === 'function' && price.indexOf('.') !== -1) {
						// Price has decimals in it
						// Multiply to get without decimals
						price = Math.round(price * 100); // Added round on 2023-04-25 to avoide the rounding issue (because of floating point numbers)
					}
					
					return price;
				},
				getTotalOriginalAmount: function(bundle, products, fromPOS, bundleKey) {
					
					var totalOriginalAmount = 0;
					for(var key in products) {
						if (products.hasOwnProperty(key)) {
							var productId = products[key].product_id;

							if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
								// Skip this product, as it is required and can't be discounted.
								continue;
							}
							
							if (typeof bundle.products[productId] !== 'undefined' || 
								(bundle.product_target_type === 'all_products' && bundle.minimum_requirements === 'volume_discounts')) {

								var selectedVariant = fromPOS ? false : this.getSelectedVariant(productId, bundleKey, bundle.id);
								
								if (bundle.product_target_type === 'all_products' && bundle.minimum_requirements === 'volume_discounts') {
									var quantity = products[key].quantity;
								} else {
									var quantity = bundle.products[productId].quantity;
								}
								
								if (fromPOS) {
									quantity = products[key].quantity;
								}
								
								if (selectedVariant === false) {
									// Use value of first variant
									// Used in POS
									// Or if the configured variant_id doesn't exist anymore
									
																		
									totalOriginalAmount += this.getPrice(products[key].variants[0].price)*quantity;
									//totalOriginalAmount += this.getPrice(this.getFirstNonUndefined(products[key].variants[0][priceKeySelector], products[key].variants[0].price))*quantity;
									
								} else {
									for (var i = 0; i < products[key].variants.length; i++) {
										if (selectedVariant == products[key].variants[i].id) {
											//totalOriginalAmount += this.getPrice(this.getFirstNonUndefined(products[key].variants[i][priceKeySelector], products[key].variants[i].price))*quantity;
											
																						
											totalOriginalAmount += this.getPrice(products[key].variants[i].price)*quantity;
										}
									}
								}
							}
						}
					}
					
					return totalOriginalAmount;
				},
				applyPercentageDiscount: function(bundle, products, discountRatio, fromPOS, bundleKey, onlyToSelectedVariant) {
					var totalAppliedAmount = 0;

					for(var key in products) {
						if (products.hasOwnProperty(key)) {
							var productId = products[key].product_id;
							
							if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
								// Skip this product, as it is required and can't be discounted.
								continue;
							}
							
							
							if (typeof bundle.products[productId] !== 'undefined' || 
								(bundle.product_target_type === 'all_products' && bundle.minimum_requirements === 'volume_discounts') ||
								bundle.minimum_requirements === 'sectioned_n_products'
							) {
								// Only go in if the product is in the bundle or the bundle is a volume bundle targeting all products
								
								if (bundle.product_target_type === 'all_products' && bundle.minimum_requirements === 'volume_discounts') {
									var quantity = products[key].quantity;
								} else if (bundle.minimum_requirements === 'sectioned_n_products') {
									var quantity = 1;
									
								} else {
									var quantity = bundle.products[productId].quantity;
								}

								if (fromPOS) {
									quantity = products[key].quantity;
								} else if(bundle.mix_and_match_display === 'true' && (bundle.minimum_requirements === 'n_products' || bundle.minimum_requirements === 'tiered_n_products')) {
									quantity = 1;
								}
								
								var selectedVariant = false;
								if (onlyToSelectedVariant) {
									selectedVariant = fromPOS ? false : this.getSelectedVariant(productId, bundleKey, bundle.id);
									
									if (selectedVariant === false) {
										// Get the first selected variant
										selectedVariant = products[key].variants[0].id;
									}
								}
								
								var atLeastOneVariantWasConfigured = false;
								for (var i = 0; i < products[key].variants.length; i++) {
									
									if (onlyToSelectedVariant === false || selectedVariant == products[key].variants[i].id) {
									
										var productPrice		= this.getPrice(products[key].variants[i].price);
										var price 				= this.getPrice(products[key].variants[i].price)*quantity;
										var compareAtLinePrice 	= this.priceOrZero(products[key].variants[i].compare_at_price)*quantity;
										
										// Assign total original price with quantity
										products[key].variants[i].linePrice		 		= price;
										products[key].variants[i].compareAtLinePrice	= compareAtLinePrice;

										// The discount has to be applied and rounded on product level, as this is how we also apply it in the draft order.
										// It can be multiplied by quantity AFTER that.
										var discountAm = Math.round(productPrice * discountRatio)*quantity;
										
										if (fromPOS && typeof window.bndlrNoDecimalsInDiscount !== 'undefined' && window.bndlrNoDecimalsInDiscount) {
											// Remove any decimals from the discount. This is resolving the case in Shopify POS for LAK currency (la-foodpanda-shop).
											discountAm = Math.round(discountAm/100)*100;
										}
										
										products[key].variants[i].discountedPrice 			= price - discountAm;
										
										if (typeof products[key].variants[i].deliveriesNum === 'number' && products[key].variants[i].deliveriesNum>1) {
											// Increase the discounted price for the number of deliveries (pre-paid subscriptions)
											products[key].variants[i].discountedPrice *= products[key].variants[i].deliveriesNum;
										}
										
										// Quantity which was used when calculating the discounted price
										products[key].variants[i].discountedPriceQuantity 	= quantity;
										
										totalAppliedAmount += discountAm;
										
										if (onlyToSelectedVariant === true) {
											// Break the loop
											i = products[key].variants.length;
										}
										
										atLeastOneVariantWasConfigured = true;
									}
								}
								
								if (atLeastOneVariantWasConfigured === false) {
									bundlerConsole.log('Could not configure the discount and prices for the product '+products[key].title+' in bundle '+bundle.name+'. Try to remove the product from the bundle, add it back to it and save the bundle to resolve the issue.');
								}
							} else {
								bundlerConsole.log('Could not configure the discount and prices for the product '+products[key].title+' in bundle '+bundle.name+'. Try to remove the product from the bundle, add it back to it and save the bundle to resolve the issue.');
							}
						}
					}
					
					return totalAppliedAmount;
				},
				applyRemainingDiscount: function(bundle, products, fromPOS, bundleKey, maxDiscount, appliedAmount) {
					// Loop again through products and apply any remaining discount amount
					if (appliedAmount !== maxDiscount) {
						var discountDifference = maxDiscount - appliedAmount;
						
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var productId = products[key].product_id;
								
								if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
									// Skip this product, as it is required and can't be discounted.
									continue;
								}
								
								if (typeof bundle.products[productId] !== 'undefined') {
						
									var selectedVariant = fromPOS ? false : this.getSelectedVariant(productId, bundleKey, bundle.id);
									
									if (selectedVariant === false) {
										// Get the first selected variant
										selectedVariant = products[key].variants[0].id;
									}
									
									// Calculate price for the selected variant
									for (var i = 0; i < products[key].variants.length; i++) {
										if (selectedVariant == products[key].variants[i].id) {											
											// Add the difference only if the difference is divisible by the variant quantity?
											//if (products[key].variants[i].discountedPrice > discountDifference && discountDifference%products[key].variants[i].discountedPriceQuantity === 0) {
											if (products[key].variants[i].discountedPrice > discountDifference) {
												products[key].variants[i].discountedPrice -= discountDifference;
												discountDifference -= discountDifference;
											}
											// Break the loop
											i = products[key].variants.length;
										}
									}
									
								}
							}
						}
					}
				},
				sectionedApplyRemainingDiscount: function(bundle, sections, fromPOS, maxDiscount, appliedAmount) {
					// Loop again through products and apply any remaining discount amount
					if (appliedAmount !== maxDiscount) {
						var discountDifference = maxDiscount - appliedAmount;
						
						for (var sectionId in sections) {
							var products = sections[sectionId];
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									var productId = products[key].product_id;
									
									if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
										// Skip this product, as it is required and can't be discounted.
										continue;
									}
							
									// We already have the selected variant in the product itself, so we don't have to retrieve it from the bundle.
									var selectedVariant = products[key].variants[0].id;
									
									// Calculate price for the selected variant
									for (var i = 0; i < products[key].variants.length; i++) { // THere should always be just one variant, so no need ot loop here
										if (selectedVariant == products[key].variants[i].id) {											
											// Add the difference only if the difference is divisible by the variant quantity?
											//if (products[key].variants[i].discountedPrice > discountDifference && discountDifference%products[key].variants[i].discountedPriceQuantity === 0) {
											if (products[key].variants[i].discountedPrice > discountDifference) {
												products[key].variants[i].discountedPrice -= discountDifference;
												discountDifference -= discountDifference;
											}
											// Break the loop
											i = products[key].variants.length;
										}
									}
								}
							}
						}
					}
				},
				getSectionedTotalOriginalAmount(bundle, sections) {
					var totalOriginalAmount = 0;
					for (var sectionId in sections) {
						var products = sections[sectionId];
						
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var productId = products[key].product_id;
								
								if (typeof bundle.sections[sectionId].products[productId] !== 'undefined') {

									//var selectedVariant = fromPOS ? false : this.getSelectedVariant(productId, bundleKey, bundle.id);
									
									/*
									if (fromPOS) {
										quantity = products[key].quantity;
									}
									*/
									
									quantity = products[key].quantity;
									
									totalOriginalAmount += this.getPrice(products[key].variants[0].price)*quantity;
								}
							}
						}
					}
					
					return totalOriginalAmount;
				},
				sectionedModifyProductsPrices: function(bundle, sections, fromPOS) { // TODO: ADD FromPOS variable 
					if (typeof fromPOS === 'undefined') {
						fromPOS = false;
					}
					
					// This is meant to apply the discount on the already selected/built sectioned bundles, where we already know which variant is in each section 
				
					// Local function used to set discounted keys such as (linePrice, discountedPrice, etc.)
					function setDiscountedKeysFixedAmount(self, variant, quantity, totalOriginalAmount, maxDiscount, totalDiscountedAmount) {
						var price = self.getPrice(variant.price)*quantity;
						var discountablePrice = price;
						
						var compareAtLinePrice 	= self.priceOrZero(variant.compare_at_price)*quantity;
						
						if (price > compareAtLinePrice) {
							compareAtLinePrice = price;
						}
						
						// Assign total original price with quantity
						variant.linePrice 			= price;
						variant.compareAtLinePrice 	= compareAtLinePrice;
						
						if (totalOriginalAmount <= maxDiscount) {
							// Original amount is bigger than total amount
							// Give 100% discount
							variant.discountedPrice = 0;
						} else {
							var discountAmount 		= Math.round((discountablePrice/totalOriginalAmount) * maxDiscount);													
							variant.discountedPrice = discountablePrice - discountAmount;
							
							totalDiscountedAmount += discountAmount;
						}
						
						if (typeof variant.deliveriesNum === 'number' && variant.deliveriesNum>1) {
							// Increase the discounted price for the number of deliveries (pre-paid subscriptions)
							variant.discountedPrice *= variant.deliveriesNum;
						}
						
						// Quantity which was used when calculating the discounted price
						variant.discountedPriceQuantity 	= quantity;
						
						return totalDiscountedAmount;
					}
					
					function applyPercentageDiscount(bundle, sections, discountRatio) {
						var totalAppliedAmount = 0;

						for (var sectionId in sections) {
							var products = sections[sectionId];
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									var productId = products[key].product_id;

									if (typeof bundle.sections[sectionId].products[productId] !== 'undefined') {
										// Only go in if the product is in the bundle section 
										
										var quantity = products[key].quantity;

										for (var i = 0; i < products[key].variants.length; i++) {

											var productPrice		= bndlr.getPrice(products[key].variants[i].price);
											var price 				= bndlr.getPrice(products[key].variants[i].price)*quantity;
											var compareAtLinePrice 	= bndlr.priceOrZero(products[key].variants[i].compare_at_price)*quantity;
											
											// Assign total original price with quantity
											products[key].variants[i].linePrice		 		= price;
											products[key].variants[i].compareAtLinePrice	= compareAtLinePrice;

											// The discount has to be applied and rounded on product level, as this is how we also apply it in the draft order.
											// It can be multiplied by quantity AFTER that.
											var discountAm = Math.round(productPrice * discountRatio)*quantity;
											
											/*
											if (fromPOS && typeof window.bndlrNoDecimalsInDiscount !== 'undefined' && window.bndlrNoDecimalsInDiscount) {
												// Remove any decimals from the discount. This is resolving the case in Shopify POS for LAK currency (la-foodpanda-shop).
												discountAm = Math.round(discountAm/100)*100;
											}*/
											
											products[key].variants[i].discountedPrice 			= price - discountAm;
											
											if (typeof products[key].variants[i].deliveriesNum === 'number' && products[key].variants[i].deliveriesNum > 1) {
												// Increase the discounted price for the number of deliveries (pre-paid subscriptions)
												products[key].variants[i].discountedPrice *= products[key].variants[i].deliveriesNum;
											}
											
											// Quantity which was used when calculating the discounted price
											products[key].variants[i].discountedPriceQuantity 	= quantity;
											
											totalAppliedAmount += discountAm;
										}
									} else {
										bundlerConsole.log('Could not configure the discount and prices for the product '+products[key].title+' in bundle '+bundle.name+'. Try to remove the product from the bundle, add it back to it and save the bundle to resolve the issue.');
									}
								}
							}
						}
						
						return totalAppliedAmount;
					}

					
			
					if (bundle.discount_type == 'percentage') {
						var ratio = bundle.percentage_value/100;
						
						// We are using the local method of applying this here because this is all more specific for sectioned bundles 
						applyPercentageDiscount(bundle, sections, ratio);
						
					} else if(bundle.discount_type == 'fixed_amount') {
						var maxDiscount = bundle.fixed_amount_value * 100;

						var totalOriginalAmount = this.getSectionedTotalOriginalAmount(bundle, sections);

						var totalDiscountedAmount = 0;
						
						for (var sectionId in sections) {
							var products = sections[sectionId];
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									var productId = products[key].product_id;
									
									/*
									if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
										// Skip this product, as it is required and can't be discounted.
										continue;
									}*/

									if (typeof bundle.sections[sectionId].products[productId] !== 'undefined') {


										var quantity = products[key].quantity;
										
										totalDiscountedAmount = setDiscountedKeysFixedAmount(this, products[key].variants[0], quantity, totalOriginalAmount, maxDiscount, totalDiscountedAmount);
									}
								}
							}
						}
						
						// Loop again through products and apply any remaining discount amount
						this.sectionedApplyRemainingDiscount(bundle, sections, true, maxDiscount, totalDiscountedAmount); // This isn't yet enabled because we couldn't yet test it out. 
						
					} else if(bundle.discount_type == 'fixed_price') {
						// Calculate the total discount in percentage and apply it to the bundle
						var finalPrice 			= bundle.fixed_price_value * 100;

						// Set fixed num of decimals, otherwise we get something like 20.40 -> 2039.9999999999998
						var fnum = (bundle.fixed_price_value+'').length - 5; // Subtract 5 because 20.40 is 5 chars long. If theres is anything longer, we want to keep the same number of decimal places.
						if (fnum < 0) {
							fnum = 0;
						}
						finalPrice = finalPrice.toFixed(fnum)*1;
						
						var totalOriginalAmount = this.getSectionedTotalOriginalAmount(bundle, sections);
						var discountAmount 		= totalOriginalAmount - finalPrice;

						if (discountAmount < 0) {
							discountAmount = 0;
						}
						
						var discountRatio = discountAmount/totalOriginalAmount;
						
						// Apply discounts to products by reference
						var totalAppliedAmount = applyPercentageDiscount(bundle, sections, discountRatio);

						// Check if the price is really the same as it was specified. The discount is changed by reference.
						this.sectionedApplyRemainingDiscount(bundle, sections, fromPOS, discountAmount, totalAppliedAmount);
						
					} else if (bundle.discount_type == 'products_discounts') {
						
						for (var sectionId in sections) {
							var products = sections[sectionId];
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									var productId = products[key].product_id;
									
									/*
									if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
										continue;
									}
									*/
									
									if (typeof bundle.sections[sectionId].products[productId] !== 'undefined') {

										var quantity = products[key].quantity;
										
										/* 
										if (fromPOS) {
											quantity = products[key].quantity;
										}*/

										for (var i = 0; i < products[key].variants.length; i++) {
											var price 				= this.getPrice(products[key].variants[i].price)*quantity;
											var compareAtLinePrice 	= this.priceOrZero(products[key].variants[i].compare_at_price)*quantity;
											
											var finalDiscount = bundle.sections[sectionId].products[productId].discount_amount*100;
											
											finalDiscount = finalDiscount*quantity;
											
											if (finalDiscount<0) {
												finalDiscount = 0;
											}
											
											// Assign total original price with quantity
											products[key].variants[i].linePrice		 		= price;
											products[key].variants[i].compareAtLinePrice	= compareAtLinePrice;
											
											var finalPrice = Math.round(price - finalDiscount);
											if (finalPrice < 0) {
												finalPrice = 0;
											}
											products[key].variants[i].discountedPrice 	= finalPrice;
											
											if (typeof products[key].variants[i].deliveriesNum === 'number' && products[key].variants[i].deliveriesNum>1) {
												// Increase the discounted price for the number of deliveries (pre-paid subscriptions)
												products[key].variants[i].discountedPrice *= products[key].variants[i].deliveriesNum;
											}
											
											// Quantity which was used when calculating the discounted price
											products[key].variants[i].discountedPriceQuantity 	= quantity;
										}
									}
								}
							}
						}
					}
					
					return sections;
				},
								modifyProductsPrices: function(bundle, products, fromPOS, bundleKey, sectionId) { // bundleKey is used when applying percentage discount (etc. on bundles).
				
					// Local function used to set discounted keys such as (linePrice, discountedPrice, etc.)
					function setDiscountedKeysFixedAmount(self, variant, quantity, totalOriginalAmount, maxDiscount, totalDiscountedAmount) {
						var price = self.getPrice(variant.price)*quantity;
						var discountablePrice = price;
						
						var compareAtLinePrice 	= self.priceOrZero(variant.compare_at_price)*quantity;
						
						if (price > compareAtLinePrice) {
							compareAtLinePrice = price;
						}
						
						// Assign total original price with quantity
						variant.linePrice 			= price;
						variant.compareAtLinePrice 	= compareAtLinePrice;
						
						if (totalOriginalAmount <= maxDiscount) {
							// Original amount is bigger than total amount
							// Give 100% discount
							variant.discountedPrice = 0;
						} else {
							var discountAmount 		= Math.round((discountablePrice/totalOriginalAmount) * maxDiscount);													
							variant.discountedPrice = discountablePrice - discountAmount;
							
							totalDiscountedAmount += discountAmount;
						}
						
						if (typeof variant.deliveriesNum === 'number' && variant.deliveriesNum>1) {
							// Increase the discounted price for the number of deliveries (pre-paid subscriptions)
							variant.discountedPrice *= variant.deliveriesNum;
						}
						
						// Quantity which was used when calculating the discounted price
						variant.discountedPriceQuantity 	= quantity;
						
						return totalDiscountedAmount;
					}
					
					var isDynamicMixAndMatchBundle = false;
					if (bundle.mix_and_match_display === 'true' && bundle.minimum_requirements === 'n_products') {
						isDynamicMixAndMatchBundle = true;
					}
					
					
					var isTieredMixNMatchBundle = false;
					if (bundle.minimum_requirements === 'tiered_n_products') {
						isTieredMixNMatchBundle = true;
					}

					if (isDynamicMixAndMatchBundle && fromPOS !== true && bundle.discount_type != 'percentage' && bundle.discount_type != 'products_discounts') {
						// Prepare products with the original prices, as we have a mix and match display AND we are not in POS
						// And, we are either applying a fixed bundle price, a fixed discount or no discount at all.
						// But overall, if we apply either percentage discount or a discount on each product, go through the rest of the logic and actually apply the discount
						// so that we can show it in the widget.
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var productId = products[key].product_id;

								if (typeof bundle.products[productId] !== 'undefined') {
									var quantity = bundle.products[productId].quantity;
									
									for (var i = 0; i < products[key].variants.length; i++) {
										var price 				= this.getPrice(products[key].variants[i].price);
										
										var compareAtLinePrice 	= this.priceOrZero(products[key].variants[i].compare_at_price);
										
										if (price > compareAtLinePrice) {
											compareAtLinePrice = price;
										}
										
										// Assign total original price with quantity
										products[key].variants[i].linePrice		 			= price;
										products[key].variants[i].compareAtLinePrice		= price;

										products[key].variants[i].discountedPrice 			= price;
										
										// Quantity which was used when calculating the discounted price
										products[key].variants[i].discountedPriceQuantity 	= 1;
									}
								}
							}
						}
					} else if (bundle.minimum_requirements === 'sectioned_n_products' && bundle.discount_type != 'percentage' && bundle.discount_type !== 'products_discounts' && fromPOS !== true) {
						// Prepare products with the original prices, as we have a mix and match display AND we are not in POS
						
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var productId = products[key].product_id;
								
								for (var i = 0; i < products[key].variants.length; i++) {
									var price 				= this.getPrice(products[key].variants[i].price);
									
									var compareAtLinePrice 	= this.priceOrZero(products[key].variants[i].compare_at_price);
									
									if (price > compareAtLinePrice) {
										compareAtLinePrice = price;
									}
									
									// Assign total original price with quantity
									products[key].variants[i].linePrice		 			= price;
									products[key].variants[i].compareAtLinePrice		= price;

									products[key].variants[i].discountedPrice 			= price;
									
									// Quantity which was used when calculating the discounted price
									products[key].variants[i].discountedPriceQuantity 	= 1;
								}
							}
						}
					} else if (bundle.minimum_requirements === 'sectioned_n_products' && bundle.discount_type === 'products_discounts' && typeof sectionId !== 'undefined' && fromPOS !== true) {
						
						// We are in sectioned Mix & Match bundle where prices are set on each product separately 
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								var productId = products[key].product_id;
								
								for (var i = 0; i < products[key].variants.length; i++) {
									var price 				= this.getPrice(products[key].variants[i].price);
									
									var compareAtLinePrice 	= this.priceOrZero(products[key].variants[i].compare_at_price);
									
									if (price > compareAtLinePrice) {
										compareAtLinePrice = price;
									}
									
									var quantity = 1;
									
									
									var finalDiscount = bundle.sections[sectionId].products[productId].discount_amount*100;
									
									if (finalDiscount<0) {
										finalDiscount = 0;
									}
									
																		
									// Assign total original price with quantity
									products[key].variants[i].linePrice		 		= price;
									products[key].variants[i].compareAtLinePrice	= compareAtLinePrice;
									
									var finalPrice = Math.round(price - finalDiscount);
									if (finalPrice < 0) {
										finalPrice = 0;
									}
									products[key].variants[i].discountedPrice 	= finalPrice;
									
																		
									// Quantity which was used when calculating the discounted price
									products[key].variants[i].discountedPriceQuantity 	= quantity;
								}
							}
						}
						
					} else if(isTieredMixNMatchBundle === true && fromPOS !== true) { // fromPOS variable is set to false when initially rendering the widget, but it is set to true when we already have products selected.
						// Don't apply any discount as we have a tiered Mix & Match bundle. 
						// Instead, set a 0% discount so that we have all the required properties set up :) (trickster!)
						
						this.applyPercentageDiscount(bundle, products, 0, fromPOS, bundleKey, false);
						
					} else {
						
						if (fromPOS === true) {
														var volumeDiscount = [];
							
							for(var pkey in products) {
								if (products.hasOwnProperty(pkey)) {
									if (typeof products[pkey] !== 'undefined' && typeof products[pkey].volume_discount !== 'undefined') {
										discountType 	= products[pkey].volume_discount.discount_type;
										volumeDiscount 	= products[pkey].volume_discount;
										
										// Simulate the bundle discount for this volume discount
										bundle.discount_type 		= volumeDiscount.discount_type;
										bundle.percentage_value 	= volumeDiscount.discount_value;
										bundle.fixed_amount_value 	= volumeDiscount.discount_value;
										bundle.fixed_price_value 	= volumeDiscount.discount_value;
										
										//bundle.products = JSON.parse(JSON.sttringify(products));
										break;
									}
								}
							}							
						}
				
						if (bundle.discount_type == 'percentage') {
							var ratio = bundle.percentage_value/100;
							
							this.applyPercentageDiscount(bundle, products, ratio, fromPOS, bundleKey, false);
							
						} else if(bundle.discount_type == 'fixed_amount') {
							var maxDiscount = bundle.fixed_amount_value * 100;

							var totalOriginalAmount = this.getTotalOriginalAmount(bundle, products, fromPOS, bundleKey);

							var totalDiscountedAmount = 0;
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									var productId = products[key].product_id;
									
									if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
										// Skip this product, as it is required and can't be discounted.
										continue;
									}

									if (typeof bundle.products[productId] !== 'undefined' || 
										(bundle.product_target_type === 'all_products' && bundle.minimum_requirements === 'volume_discounts')) {

										var selectedVariant = fromPOS ? false : this.getSelectedVariant(productId, bundleKey, bundle.id);
										
										if (bundle.product_target_type === 'all_products' && bundle.minimum_requirements === 'volume_discounts') {
											var quantity = products[key].quantity;
										} else {
											var quantity = bundle.products[productId].quantity;
										}
										
										if (fromPOS) {
											quantity = products[key].quantity;
										}
										
										if (selectedVariant === false) { // Used in POS
										
											totalDiscountedAmount = setDiscountedKeysFixedAmount(this, products[key].variants[0], quantity, totalOriginalAmount, maxDiscount, totalDiscountedAmount);
											
										} else {
											// Calculate price for the selected variant
											for (var i = 0; i < products[key].variants.length; i++) {
												if (selectedVariant == products[key].variants[i].id) {
													totalDiscountedAmount = setDiscountedKeysFixedAmount(this, products[key].variants[i], quantity, totalOriginalAmount, maxDiscount, totalDiscountedAmount);
												}
											}
											
										}
									}
								}
							}
							
							// Loop again through products and apply any remaining discount amount
							this.applyRemainingDiscount(bundle, products, fromPOS, bundleKey, maxDiscount, totalDiscountedAmount);
							
						} else if(bundle.discount_type == 'fixed_price') {
							// Calculate the total discount in percentage and apply it to the bundle
							var finalPrice 			= bundle.fixed_price_value * 100;

							// Set fixed num of decimals, otherwise we get something like 20.40 -> 2039.9999999999998
							var fnum = (bundle.fixed_price_value+'').length - 5; // Subtract 5 because 20.40 is 5 chars long. If theres is anything longer, we want to keep the same number of decimal places.
							if (fnum < 0) {
								fnum = 0;
							}
							finalPrice = finalPrice.toFixed(fnum)*1;
							
							var totalOriginalAmount = this.getTotalOriginalAmount(bundle, products, fromPOS, bundleKey);
							var discountAmount 		= totalOriginalAmount - finalPrice;

							if (discountAmount < 0) {
								discountAmount = 0;
							}
							
							var discountRatio = discountAmount/totalOriginalAmount;
							
							// Apply discounts to products by reference
							var totalAppliedAmount = this.applyPercentageDiscount(bundle, products, discountRatio, fromPOS, bundleKey, true);

							// Check if the price is really the same as it was specified. The discount is changed by reference.
							this.applyRemainingDiscount(bundle, products, fromPOS, bundleKey, discountAmount, totalAppliedAmount);
							
						} else if (bundle.discount_type == 'products_discounts') {
							
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									var productId = products[key].product_id;
									
									if (fromPOS && typeof products[key].type !== 'undefined' && products[key].type === 'required') {
										continue;
									}
									
									if (typeof bundle.products[productId] !== 'undefined') {

										var quantity = bundle.products[productId].quantity;
										
										if (fromPOS) {
											quantity = products[key].quantity;
										} else if(isDynamicMixAndMatchBundle) {
											quantity = 1;
										}
										
										

										for (var i = 0; i < products[key].variants.length; i++) {
											var price 				= this.getPrice(products[key].variants[i].price)*quantity;
											var compareAtLinePrice 	= this.priceOrZero(products[key].variants[i].compare_at_price)*quantity;
											
											var finalDiscount = bundle.products[productId].discount_amount*100;
											
											if (bundle.minimum_requirements === 'n_products') {
												finalDiscount = finalDiscount*quantity;
											}
											
											if (finalDiscount<0) {
												finalDiscount = 0;
											}
											
																						
											// Assign total original price with quantity
											products[key].variants[i].linePrice		 		= price;
											products[key].variants[i].compareAtLinePrice	= compareAtLinePrice;
											
											var finalPrice = Math.round(price - finalDiscount);
											if (finalPrice < 0) {
												finalPrice = 0;
											}
											products[key].variants[i].discountedPrice 	= finalPrice;
											
											if (typeof products[key].variants[i].deliveriesNum === 'number' && products[key].variants[i].deliveriesNum>1) {
												// Increase the discounted price for the number of deliveries (pre-paid subscriptions)
												products[key].variants[i].discountedPrice *= products[key].variants[i].deliveriesNum;
											}
											
											// Quantity which was used when calculating the discounted price
											products[key].variants[i].discountedPriceQuantity 	= quantity;
										}
									}
								}
							}
						}
					}
					
					return products;
				},
				isVariantAvailable: function(variantId, productId, bundle, fromRequiredProducts, sectionId) {
					var arrayKey = 'products';
					if (fromRequiredProducts) {
						arrayKey = 'required_products';
					}
					
					if (typeof sectionId !== 'undefined') {
						// We are checking this for the sectioned bundle 
						if (typeof bundle['sections'][sectionId]['products'][productId] !== 'undefined') {
							if (typeof bundle['sections'][sectionId]['products'][productId].variants[variantId] !== 'undefined') {
								return true;
							}
						}
					} else {					
						if (typeof bundle[arrayKey][productId] !== 'undefined') {
							if (typeof bundle[arrayKey][productId].variants[variantId] !== 'undefined') {
								return true;
							}
						}
					}
					
					return false;
				},
				getMixAndMatchProductHtml: function(product, bundle, isRequired) {

					if (Object.keys(product).length === 0) {
						// This product wasn't retrieved,  probably because it isn't published anymore
						return '';
					}

					var variantSelectDisplay = '';
					var options = '';
									
					var variants = '<select class="bndlr-select-variant id_'+product.id+'" aria-label="variant" name="variant_id" ';

					var numberOfAvailableVariants = 0;
					var allowedVariants = [];
					for(var i = 0; i < product.variants.length; i++) {		
						if (this.isVariantAvailable(product.variants[i].id, product.id, bundle, false)) {
							
														
							if (product.variants[i].available !== false) {
								numberOfAvailableVariants++;
							}
							
							allowedVariants.push(product.variants[i]);
						}
					}
					
					var variantsAreAvailable = true;
					if (numberOfAvailableVariants === 0) {
						this.widgetCanBeDisplayed = false;
						variantsAreAvailable = false;
						console.warn('Bundler: The configured variants for product "' + product.title + '" are not available. If you set the app to hide unavailable variants, then please make sure that the selected variants are in stock. If the issue persists, try to edit the bundle, select the products again and save the bundle.');
					}
					
					/*
					if (product.title === 'Spinach Dip (470g)') {
						console.log('product', product);
						console.log('numberOfAvailableVariants', numberOfAvailableVariants);
					}*/
					
					if (allowedVariants.length <= 1) {
						variantSelectDisplay = 'display:none;';
					}
					variants += 'style="'+variantSelectDisplay+'"';
					variants += '>';
					
					for(var i = 0; i < allowedVariants.length; i++) {
						var name = this.getVariantTitle(allowedVariants[i]);
						
						var dataAttrs = '';
												
						variants += '<option value="' + allowedVariants[i].id + '" '+dataAttrs+'>' + name + '</option>';
					}
					variants += '</select>';

					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;
					
					// Get featured image for the currently selected variant
					var featuredImage = this.getFeaturedImage(product, '', bundle.id);
					
											var linkTarget = 'target="_blank"';
										
					var productTitle = product.title;
					
					if (bundle.product_level === 'variant') {
						// If this is true we will only show variant name
											}
					
					
					var productTitleAttr = productTitle.replace('"', '').replace(/<[^>]*>?/gm, '');
					
										
					
										
					
					var addToBundleText			= 'Add to bundle';
					var addToBundleButtonClass 	= '';
					
											if (variantsAreAvailable === false) {
							addToBundleText 		= 'Out of stock';
							addToBundleButtonClass 	= 'bndlr-no-click';
						}
										
					var imageDimensions = this.getImageDimensions(featuredImage, product); 										var html = '' + 
						'<div class="bndlr-product bndlr-mix-and-match bndlr-no-plus-sign" '+
								'data-quantity="1" ' +
								'data-required="false" '+
								'data-mnm-required="'+isRequired.toString()+'" '+
								'data-available="'+ variantsAreAvailable.toString() +'" '+
								'data-product-id="'+product.id+'" ' +
								'>';
															html += '' +
								'<a href="'+ productUrl +'" class="bndlr-product-image-url" '+linkTarget+'>' +
									'<img title="' + productTitleAttr + '" class="bndlr-product-image id_'+product.id+'" src="'+ this.getProductImage(featuredImage, '500X500') +'" '+ this.getSrcSet(featuredImage) +' '+imageDimensions+'>' +
								'</a>';
							
							html += ''+ 
							'<div class="bndlr-product-qn-container">';

																	html += '' +
									'<a href="'+ productUrl +'" class="bndlr-product-title" '+linkTarget+' title="' + productTitleAttr + '">' + productTitle + '</a>';
															
							html += '' +
							'</div>' +
							'<div class="bndlr-product-price id_'+product.id+'">' +
								this.getProductPriceHtml(product, '', bundle.id, true) +
							'</div>';
														
														
														
														
							html += '<div class="bndlr-bottom-pusher"></div>' +
							options +
							variants;
							
																							html += '<div class="bndlr-add-to-bundle-container">';
							
								
								html += '<div class="bndlr-add-to-bundle ' + addToBundleButtonClass + '" title="'+addToBundleText+'" tabindex="0" role="button">'+addToBundleText+'</div>';
								
															html += '</div>';
							
						html += '</div>';
					html +=  '';
					
					return html;
				},
				getInitialMaxQuantityForProduct: function(product, bundle) {
					var maxQuantity = 0;
					
					for (const key in bundle.products) {
						if (bundle.products.hasOwnProperty(key)) {
							const prod = bundle.products[key];
							if (product.id == prod.id) {
								maxQuantity = prod.quantity;
								return maxQuantity;
							}
						}
					}
	
				},
				getSectionedProductHtml: function(product, bundle, sectionId, isRequired) {

					if (Object.keys(product).length === 0) {
						// This product wasn't retrieved,  probably because it isn't published anymore
						return '';
					}

					var variantSelectDisplay = '';
					var options = '';
									
					var variants = '<select class="bndlr-select-variant id_'+product.id+'" aria-label="variant" name="variant_id" ';

					var numberOfAvailableVariants = 0;
					var allowedVariants = [];
					for(var i = 0; i < product.variants.length; i++) {

						if (this.isVariantAvailable(product.variants[i].id, product.id, bundle, false, sectionId)) {

														
															
								if (product.variants[i].available !== false) {
									numberOfAvailableVariants++;
								}
														
							allowedVariants.push(product.variants[i]);
						}
					}
					
					var variantsAreAvailable = true;
					if (numberOfAvailableVariants === 0) {
						this.widgetCanBeDisplayed = false;
						variantsAreAvailable = false;
						console.warn('Bundler: The configured variants for product "' + product.title + '" are not available. If you set the app to hide unavailable variants, then please make sure that the selected variants are in stock. If the issue persists, try to edit the bundle, select the products again and save the bundle.');
					}
					
					if (allowedVariants.length <= 1) {
						variantSelectDisplay = 'display:none;';
					}
					variants += 'style="'+variantSelectDisplay+'"';
					variants += '>';
					
					for(var i = 0; i < allowedVariants.length; i++) {
						var name = this.getVariantTitle(allowedVariants[i]);
						
						var dataAttrs = '';
												
						variants += '<option value="' + allowedVariants[i].id + '" '+dataAttrs+'>' + name + '</option>';
					}
					variants += '</select>';

					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;
					
					// Get featured image for the currently selected variant
					var featuredImage = this.getFeaturedImage(product, '', bundle.id, false, sectionId);
					
											var linkTarget = 'target="_blank"';
										
					var productTitle = product.title;		


										
					var productTitleAttr = productTitle.replace('"', '').replace(/<[^>]*>?/gm, '');
					
					var addToBundleText			= 'Add to bundle';
					var addToBundleButtonClass 	= '';
					
											if (variantsAreAvailable === false) {
							addToBundleText 		= 'Out of stock';
							addToBundleButtonClass 	= 'bndlr-no-click';
						}
										
					var imageDimensions = this.getImageDimensions(featuredImage, product); 										var html = '' + 
						'<div class="bndlr-product bndlr-mix-and-match bndlr-sectioned-product bndlr-no-plus-sign" '+
								'data-quantity="1" ' +
								'data-required="false" '+
								'data-mnm-required="'+isRequired.toString()+'" '+
								'data-available="'+ variantsAreAvailable.toString() +'" '+
								'data-product-id="'+product.id+'" ' +
								'role="group" aria-label="product"' +
								'>';
															html += '' +
								'<a href="'+ productUrl +'" class="bndlr-product-image-url" '+linkTarget+'>' +
									'<img title="' + productTitleAttr + '" class="bndlr-product-image id_'+product.id+'" src="'+ this.getProductImage(featuredImage, '500X500') +'" '+ this.getSrcSet(featuredImage) +' '+imageDimensions+'>' +
								'</a>';
							
							html += ''+ 
							'<div class="bndlr-product-qn-container">';

																	html += '' +
									'<a href="'+ productUrl +'" class="bndlr-product-title" '+linkTarget+' title="' + productTitleAttr + '">' + productTitle + '</a>';
															
							html += '' +
							'</div>';
							
															html += '<div class="bndlr-product-price id_'+product.id+'">' +
									this.getProductPriceHtml(product, '', bundle.id, true, sectionId) +
								'</div>';
														
														html += '<div class="bndlr-bottom-pusher"></div>';
							
														
														
														
							html += options +
							variants +
							'<div class="bndlr-add-to-sectioned-bundle ' + addToBundleButtonClass + '" title="'+addToBundleText+'" tabindex="0" role="button">'+addToBundleText+'</div>' +
						'</div>' +
					'';
					
					return html;
				},
				getStatusBoxProductHtml: function(lineItem, product, bundle) {
					
					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;
					
					var variantName = '';
					
					// Get featured image for the currently selected variant
					var featuredImage = '';

					// Get the product image and variant name
					for (var i = 0; i < product.variants.length; i++) {

						if (lineItem.variant_id == product.variants[i].id) {

							if (typeof product.variants[i].featured_image !== 'undefined' && 
								product.variants[i].featured_image !== null) {

								featuredImage = product.variants[i].featured_image.src;
							} else {
								// When you request json format, the featured_image is missing
								featuredImage = this.getVariantsFeaturedImage(product, product.variants[i]);
							}
							variantName = product.variants[i].name;
						}
					}
					
					// Get featured image of the product (if set)
					var customProductImage = this.getCustomProductImage(bundle.id, product.id);
					if (customProductImage !== '') {
						featuredImage = customProductImage;
					}
					
					
											var linkTarget = 'target="_blank"';
					
					var variantNameAttr	= variantName.replace('"', '').replace(/<[^>]*>?/gm, '');
					
					var html = '' + 
						'<div class="bndlr-status-box-product">';
							if (lineItem.quantity > 1) {
								html += '<div class="bndlr-status-box-product-quantity">'+lineItem.quantity+'x'+'</div>';
							}
															html += '' +
								'<a href="'+ productUrl +'" class="bndlr-status-box-product-url" '+linkTarget+'>' +
									'<img title="' + variantNameAttr + '" class="bndlr-status-box-product-image addtc-np" src="'+ this.getProductImage(featuredImage, '500X500') +'" '+ this.getSrcSet(featuredImage) +'>' +
								'</a>';
													html += '</div>';

					return html;
				},
				getSectionedBundleSelectedProductHtml: function(lineItem, product, bundle, lineItemKey, sectionId) {
					
					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;
					
					var variantName = '';
					
					// Get featured image for the currently selected variant
					var featuredImage = '';

					// Get the product image and variant name
					for (var i = 0; i < product.variants.length; i++) {

						if (lineItem.variant_id == product.variants[i].id) {

							if (typeof product.variants[i].featured_image !== 'undefined' && 
								product.variants[i].featured_image !== null) {

								featuredImage = product.variants[i].featured_image.src;
							} else {
								// When you request json format, the featured_image is missing
								featuredImage = this.getVariantsFeaturedImage(product, product.variants[i]);
							}
							variantName = product.variants[i].name;
						}
					}
					
					// Get featured image of the product (if set)
					var customProductImage = this.getCustomProductImage(bundle.id, product.id);
					if (customProductImage !== '') {
						featuredImage = customProductImage;
					}
					
					
											var linkTarget = 'target="_blank"';
					
					var variantNameAttr	= variantName.replace('"', '').replace(/<[^>]*>?/gm, '');
					
											var acAttr = '';
													acAttr = 'data-ac-enabled="true"';
																
					var html = '' + 
						'<div class="bndlr-sectioned-status-box-product" data-line-item-key="'+lineItemKey+'" data-section-id="'+sectionId+'" data-variant-id="'+lineItem.variant_id+'" role="group" arial-label="product">';
							if (lineItem.quantity > 1) {
								html += '<div class="bndlr-sectioned-status-box-product-quantity">'+lineItem.quantity+'x'+'</div>';
							}
															html += '' +
								'<a href="'+ productUrl +'" class="bndlr-status-box-product-url" '+linkTarget+'>' +
									'<img title="' + variantNameAttr + '" class="bndlr-sectioned-status-box-product-image addtc-np" src="'+ this.getProductImage(featuredImage, '500X500') +'" '+ this.getSrcSet(featuredImage) +'>' +
								'</a>';
														html += '<div class="bndlr-close" tabindex="0" role="button" aria-label="Remove ' + variantNameAttr + '"></div>';
							
															html += '<div class="sealsubs-target-element" data-handle="'+product.handle+'" '+acAttr+'></div>';
													html += '</div>';

					return html;
				},
				getSelectedProductHtml: function(lineItem, product, bundle, lineItemKey) {

					var maxQuantityForProduct = this.getInitialMaxQuantityForProduct(product, bundle)
					if (lineItem.quantity > maxQuantityForProduct) {
						lineItem.quantity = maxQuantityForProduct
					}

					var variantSelectDisplay = '';
					var options = '';

					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;
					
					var variantName = '';
					
					// Get featured image for the currently selected variant
					var featuredImage = '';

					// Get the product image and variant name
					for (var i = 0; i < product.variants.length; i++) {

						if (lineItem.variant_id == product.variants[i].id) {

							if (typeof product.variants[i].featured_image !== 'undefined' && 
								product.variants[i].featured_image !== null) {

								featuredImage = product.variants[i].featured_image.src;
							} else {
								// When you request json format, the featured_image is missing
								featuredImage = this.getVariantsFeaturedImage(product, product.variants[i]);
							}
							
							variantName = product.variants[i].name;
														
														
							if (variantName.indexOf('Default Title') !== -1) {
								// The variant name contains the "default title" 
								// Use simply the product name as this is obviously a product with only one variant 
								variantName = product.title;
							}
						}
					}
					
					// Get featured image of the product (if set)
					var customProductImage = this.getCustomProductImage(bundle.id, product.id);
					if (customProductImage !== '') {
						featuredImage = customProductImage;
					}
					
					
											var linkTarget = 'target="_blank"';
					
					var variantNameAttr	= variantName.replace('"', '').replace(/<[^>]*>?/gm, '');
					
											var acAttr = '';
													acAttr = 'data-ac-enabled="true"';
											
					var html = '' + 
						'<div class="bndlr-product bndlr-mix-and-match" data-line-item-key="'+lineItemKey+'" data-variant-id="'+lineItem.variant_id+'">';
															html += '' +
								'<a href="'+ productUrl +'" class="bndlr-product-image-url" '+linkTarget+'>' +
									'<img title="' + variantNameAttr + '" class="bndlr-product-image id_'+product.id+'" src="'+ this.getProductImage(featuredImage, '500X500') +'" '+ this.getSrcSet(featuredImage) +'>' +
								'</a>';
														
							html += '' +
							'<div class="bndlr-product-qn-container">' +
								'<div class="bndlr-product-quantity" product-quantity="' + lineItem.quantity + '">' + 
									lineItem.quantity+'x'+ 
								'</div>';
																	html += '' +
									'<a href="'+ productUrl +'" class="bndlr-product-title" '+linkTarget+' title="' + variantNameAttr + '">' + variantName + '</a>';
															html += '' +
							'</div>' +
															'<div class="sealsubs-target-element" data-handle="'+product.handle+'" '+acAttr+' data-variant-id="'+lineItem.variant_id+'"></div>' +
														
														
														
																 
							'<div class="bndlr-bottom-pusher"></div>' +
							'<div class="bndlr-close" tabindex="0" role="button" aria-label="Close"></div>' +
						'</div>' +
					'';
					
					return html;
				},
				// Creates product html to include it in the bundle
				getProductHtml: function(product, bundle, fromRequiredProducts) {

					var variantSelectDisplay = '';
					var options = '';
									
					var variants = '<select class="bndlr-select-variant id_'+product.id+'" aria-label="variant" name="variant_id" ';
					
					if (typeof fromRequiredProducts === 'undefined') {
						fromRequiredProducts = false;
					}

					var numberOfAvailableVariants = 0;
					var allowedVariants = [];
					for(var i = 0; i < product.variants.length; i++) {		
						if (this.isVariantAvailable(product.variants[i].id, product.id, bundle, fromRequiredProducts)) {
							
														
							if (product.variants[i].available !== false) {
								numberOfAvailableVariants++;
							}
							
							allowedVariants.push(product.variants[i]);
						}
					}

					var variantsAreAvailable = true;
					if (numberOfAvailableVariants === 0) {
						this.widgetCanBeDisplayed = false;
						variantsAreAvailable = false;
						console.warn('Bundler: The configured variants for product "' + product.title + '" in "'+bundle.name+'" bundle are not available. If you set the app to hide unavailable variants, then please make sure that the selected variants are in stock. If the issue persists, try to edit the bundle, select the products again and save the bundle.');
					}
					
					if (allowedVariants.length <= 1) {
						variantSelectDisplay = 'display:none;';
					}
					variants += 'style="'+variantSelectDisplay+'"';
					variants += '>';
					
					for(var i = 0; i < allowedVariants.length; i++) {
						var name = this.getVariantTitle(allowedVariants[i]);
						
						var dataAttrs = '';
												
						variants += '<option value="' + allowedVariants[i].id + '" '+dataAttrs+'>' + name + '</option>';
					}
					variants += '</select>';

					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;

					// Get featured image for the currently selected variant
					var featuredImage 		= this.getFeaturedImage(product, '', bundle.id, fromRequiredProducts);
					//var featuredImageData 	= this.getFeaturedImageData(product, featuredImage);
					
											var linkTarget = 'target="_blank"';
										
					var productTitle = product.title;
										
					if (bundle.product_level === 'variant') {
						// If this is true we will only show variant name
											}
					
					var productTitleAttr = productTitle.replace('"', '').replace(/<[^>]*>?/gm, '');
					
					var productQuantity = this.getProductQuantity(product.id, bundle, fromRequiredProducts);
					var isProductSellingPlanOnly = this.getIfSellingPlan(product.id, bundle);														  
					
											var acAttr = '';
													acAttr = 'data-ac-enabled="true"';
																
					var imageDimensions = this.getImageDimensions(featuredImage, product); 										
					var html = '' + 
						'<div class="bndlr-product" '+
								'data-quantity="'+productQuantity+'" '+
								'data-required="'+ fromRequiredProducts.toString() +'" '+
								'data-available="'+ variantsAreAvailable.toString() +'" '+
								'data-product-id="'+product.id+'" '+
								'>';
															
																	html += '' +
									'<a href="'+ productUrl +'" class="bndlr-product-image-url" '+linkTarget+'>' +
										'<img title="' + productTitleAttr + '" alt="' + productTitleAttr + '" class="bndlr-product-image id_'+product.id+'" src="'+ this.getProductImage(featuredImage, '500X500') +'" '+ this.getSrcSet(featuredImage) +
										//' style="'+ this.getWidthAndHeightParam(featuredImageData) +'" ' +
										' '+imageDimensions+'>' +
									'</a>';
																
								html += '' +
								'<div class="bndlr-product-qn-container">' +
									this.getQuantityHtml(productQuantity);
									
																			html += '' +
										'<a href="'+ productUrl +'" class="bndlr-product-title" '+linkTarget+' title="' + productTitleAttr + '">' + productTitle + '</a>';
																		
								html += '' +	
								'</div>' +
																	'<div class="sealsubs-target-element" data-handle="'+product.handle+'" data-subscription-only="'+isProductSellingPlanOnly+'" '+acAttr+'></div>' +
																
																
																
								'<div class="bndlr-product-price id_'+product.id+'">' +
									this.getProductPriceHtml(product, '', bundle.id, !fromRequiredProducts) +
								'</div>' +
																	 
								'<div class="bndlr-bottom-pusher"></div>';
								
																
																
																
								html += options +
								variants +
								
																
								'<div ' +
									'class="bndlr-product-overlay" '+
									'style="display: var(--preproduct-'+(fromRequiredProducts ? 'required-' : '')+product.id+'-overlay-display, none);" '+
								'>' +
									'<div ' +
									'class="bndlr-product-overlay-checkmark" '+
									'>'+htmlUtils.svgCheckmarkPreselected+'</div>' +
								'</div>';
													html += '</div>' +
					'';
					
					return html;
				},
				getProductListName: function(product, bundle, requiredProduct, bundleKey) {
					// bundleKey is used to get the discounted value of the price per unit

					var productUrl = nav.getRootUrl(true) + 'products/' + product.handle;
					var productTitleAttr = product.title.replace('"', '').replace(/<[^>]*>?/gm, '');
					
											var linkTarget = 'target="_blank"';
										
					var html = '' + 
						this.getProductQuantityHtml(product.id, bundle, requiredProduct) +
						'<a href="'+ productUrl +'" class="bndlr-product-title" '+linkTarget+' title="' + productTitleAttr + '">' + product.title + '</a>' +
					'';
					
										
					return html;
				},
				getProductImage: function(imageSrc, size) {

					if (imageSrc === null) {
						imageSrc = '//cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png?v=1530129081';
					} else {
						var resizeMatches = imageSrc.match(/_\d+x\d+\./gi);
						var resizeMatches2 = imageSrc.match(/\d+x\.(jpg|png|webp)\?/gi);
						if(imageSrc.indexOf('shopify') !== -1 && imageSrc.indexOf('@') === -1 && resizeMatches === null && resizeMatches2 === null) {
							
							imageSrc = imageSrc.replace(/\.jpg\?/, "_"+size+'.jpg?');
							imageSrc = imageSrc.replace(/\.jpeg\?/, "_"+size+'.jpeg?');
							imageSrc = imageSrc.replace(/\.png\?/, "_"+size+'.png?');
							imageSrc = imageSrc.replace(/\.webp\?/, "_"+size+'.webp?');
							
							imageSrc = imageSrc.replace(/\.JPG\?/, "_"+size+'.JPG?');
							imageSrc = imageSrc.replace(/\.JPEG\?/, "_"+size+'.JPEG?');
							imageSrc = imageSrc.replace(/\.PNG\?/, "_"+size+'.PNG?');
							imageSrc = imageSrc.replace(/\.WEBP\?/, "_"+size+'.WEBP?');
						}
					}
					
					return imageSrc;
				},
				getSrcSet: function(imageSrc, valueOnly) {
					
					if (typeof valueOnly === 'undefined') {
						valueOnly = false;
					}
					
					if (typeof window.BndlrIsBundleLandingPage !== 'undefined' && window.BndlrIsBundleLandingPage) {
						var sizes = [
							318, // This is the maximum size on landing pages
							//318*2,
							/*
							350,
							700,
							1400
							*/
						];
					} else {
						var sizes = [
							218, // This is the maximum size of the image in the element
							//218*2
							/*
							250,
							500,
							1000
							*/
						];
					}

					
					if (typeof clientSpecifics['image_dimensions'] !== 'undefined') {
						sizes = clientSpecifics['image_dimensions'].getSizes();
					}
					
					var srcset = '';
					var sizeMultiplier = 1;
					
										
										
					for (var i = 0; i < sizes.length; i++) {
						//srcset += this.getProductImage(imageSrc, sizes[i]+'X'+sizes[i]*2) + ' '+(i+1) + 'x,';
						srcset += this.getProductImage(imageSrc, sizes[i]*sizeMultiplier+'X'+sizes[i]*3*sizeMultiplier) + ' '+ sizes[i] + 'w,';
						//srcset += this.getProductImage(imageSrc, sizes[i]+'X'+sizes[i]*3) + ' '+ (i+1) + 'x,'; // Changed from w to 2x on 2021-11-12 because of retina displays
					}
					
					var sizesAttribute = ''; 
					sizesAttribute = sizes[0]+'px';
					
					srcset = srcset.replace(/,$/, '');
					
					if (valueOnly) {
						return srcset;
					} else {
						return 'srcset="'+srcset+'"'; 
						//return 'srcset="'+srcset+'" sizes="'+sizesAttribute+'"'; // This is the correct way for retina images, but Google Pagespeed doesn't understand it
					}
				},
				getProductPriceHtml: function(product, bundleKey, bundleId, canBeDiscounted, sectionId, isMixNMatch) {
					
					if (typeof canBeDiscounted === 'undefined') {
						canBeDiscounted = true;
					}
					
					if (typeof sectionId === 'undefined') {
						sectionId = '';
					}
					
					if (typeof isMixNMatch === 'undefined') {
						isMixNMatch = false;
					}
					
					var fromRequiredProducts = !canBeDiscounted; // Put this into another variable, so that we can then change the "canBeDiscounted" variable based on settings.
					
					
					// Returns html with product price
					var price 		= this.getSelectedVariantPrice(product, bundleKey, bundleId, fromRequiredProducts, false, sectionId, isMixNMatch);
					
					
					

					if (canBeDiscounted) {
						var oldPrice 	= this.getSelectedVariantOldPrice(product, bundleKey, bundleId, fromRequiredProducts, sectionId);
					} else {
						var oldPrice = price;
					}
					
										
					var showOldPrice = false;
					if (oldPrice > price) {
						showOldPrice = true;
					}

					var savings = oldPrice - price;

					var priceHtml 		= this.formatPrice(price);
					var oldPriceHtml 	= this.formatPrice(oldPrice);
					
										
					var currency = this.getDefaultCurrency();
					
					if (showOldPrice) {
													var priceHtml = '' +
								htmlUtils.moneySpan(oldPriceHtml, 	currency.toLowerCase(), 'bndlr-old-price', 'aria-label="Original price"', oldPrice, 'Original price: ')+' ' + /* Space is essential here */
								htmlUtils.moneySpan(priceHtml, 		currency.toLowerCase(), 'bndlr-new-price', 'data-savings="'+savings+'" aria-label="Current price"', price, 'Current price: ');
								//(value, currency, classes, customAttribute, numericValue)
														
					} else {
						var priceHtml = htmlUtils.moneySpan(priceHtml, currency.toLowerCase(), 'bndlr-new-price', 'data-savings="'+savings+'" aria-label="Current price"', price, 'Current price: ');
					}

					return priceHtml;
				},
				getVariantData: function(product, variantId) {
					for (var i = 0; i < product.variants.length; i++) {
						if (variantId === false) {
							return product.variants[i]
						} else {
							if (product.variants[i].id == variantId) {
								return product.variants[i]
							}
						}
					}
				},
												  
				getProductQuantityHtml: function(productId, bundle, isRequiredProduct) {
					var quantity = this.getProductQuantity(productId, bundle, isRequiredProduct);

					return this.getQuantityHtml(quantity);
				},
				getQuantityHtml: function(quantity) {

					if (quantity > 1) {
						var html = '<div class="bndlr-product-quantity" product-quantity="' + quantity + '">' + quantity + 'x</div>';
						return html;
					}
					
					return '';
				},
				getProductQuantity: function(productId, bundle, isRequiredProduct) {
					// returns quantity for the product id
					// it works on product level (not on variant)

					if (isRequiredProduct) {
						if (typeof bundle.required_products[productId] !== 'undefined') {
							return bundle.required_products[productId].quantity;
						}
					} else {
						if (typeof bundle.products[productId] !== 'undefined') {
							return bundle.products[productId].quantity;
						}
					}
					
					return 1;
				},
				getIfSellingPlan: function(productId, bundle) {
					if (typeof bundle.products[productId] !== 'undefined' && typeof bundle.products[productId].selling_plan_id !== 'undefined') {
						if (bundle.products[productId].selling_plan_id === 'require_selling_plan') {
							return true;
						}
					}
					return false;
				},
				getSelectedVariantPrice: function(product, bundleKey, bundleId, fromRequiredProducts, forOneItem, sectionId, isMixNMatch) {
					
					if (typeof fromRequiredProducts === 'undefined') {
						fromRequiredProducts = false;
					}
					
					if (typeof forOneItem === 'undefined') {
						forOneItem = false;
					}
					
					if (typeof sectionId === 'undefined') {
						sectionId = '';
					}
					
					if (typeof isMixNMatch === 'undefined') {
						isMixNMatch = false;
					}
					
					// Returns discounted price for the currently selected product variant.
					var selectedVariant = this.getSelectedVariant(product.id, bundleKey, bundleId, fromRequiredProducts, sectionId);

					for (var i = 0; i < product.variants.length; i++) {
						if (selectedVariant === false) {
							return this.getVariantDiscountedPrice(product.variants[i], forOneItem, isMixNMatch);
						} else {
							if (product.variants[i].id == selectedVariant) {
								return this.getVariantDiscountedPrice(product.variants[i], forOneItem, isMixNMatch);
							}
						}
					}
					
					//bundlerConsole.log('Could not get variant discounted price.');
					return product.price;
				},
				getVariantDiscountedPrice: function(variant, forOneItem, isMixNMatch) {

					if (typeof forOneItem === 'undefined') {
						forOneItem = false;
					}
					
					if (typeof isMixNMatch === 'undefined') {
						isMixNMatch = false;
					}
					
					var price = 0;

					if (typeof variant.discountedPrice === 'undefined') {  // || isMixNMatch === true
						// For Mix & Match bundles, we have to always take the line price, otherwise we will update the item with the new subscription price. 
						// The issue happens specifically when you offer prepaid subscriptions. 
						price = variant.linePrice;
					} else {
						price = variant.discountedPrice;
					}
					// DEBUG

					if (isNaN(price)) {
						// This happens if the product has the price set to 0.
						price = 0;
					}
					
					if (forOneItem === true) {
						if (typeof variant.discountedPrice === 'undefined' || typeof variant.discountedPriceQuantity === 'undefined') {
							price = price;
						} else {
							price = Math.round(price/ variant.discountedPriceQuantity);
						}
					}
					
					return price;
				},				
				getFirstNonUndefined: function() {
					for (var i = 0; i < arguments.length; ++i) {
						if (typeof arguments[i] !== 'undefined') {
							return arguments[i];
						}
					}
					return undefined;
				},
				getSelectedVariantOldPrice: function(product, bundleKey, bundleId, forRequiredProduct, sectionId) {
					
					if (typeof forRequiredProduct === 'undefined') {
						forRequiredProduct = false;
					}
					
					if (typeof sectionId === 'undefined') {
						sectionId = '';
					}
					
					// Returns normal price for currently selected product variant
					var selectedVariant = this.getSelectedVariant(product.id, bundleKey, bundleId, forRequiredProduct, sectionId);

					for (var i = 0; i < product.variants.length; i++) {
						if (selectedVariant === false || product.variants[i].id == selectedVariant) {
							return this.getVariantOldPrice(product.variants[i]);
						}
					}
					
					//bundlerConsole.log('Could not get variant price.');
					return product.price;
				},
				getVariantOldPrice: function(variant) {
											if (variant.hasOwnProperty('priceForAllDeliveries') && variant.priceForAllDeliveries > 0 && variant.priceForAllDeliveries > variant.linePrice) {
							return this.getPrice(variant.linePriceForAllDeliveries);
						}
										
											if (typeof variant.linePrice === 'undefined') {
							console.trace();
						}
						return this.getPrice(variant.linePrice);
									},
				updatePriceDisplay: function($this) {
					// Updates displayed prices
					// Triggered when variant select changes
					var bundleId 	= $this.closest('[data-bundle]').attr('data-bundle');
					var bundleKey 	= $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
					var bundle 		= this.getBundleById(bundleId);
					
					var sectionId = '';
					var $section = $this.closest('[data-bundler-section]');

					if ($section.length > 0) {
						sectionId = $section.attr('data-bundler-section');
					}
					
					var required = 'false';
					var canBeDiscounted = true;
					var sectionSelector = '';
					
					if (sectionId !== '') {
						// We are in sectioned bundle 
						var sectionedBundlesProducts = Library.SectionedBundlesProducts.get(bundle.id);
						
						if (typeof sectionedBundlesProducts[sectionId] !== 'undefined') {
							var products = sectionedBundlesProducts[sectionId];
						}
						
						sectionSelector = '[data-bundler-section="'+ sectionId +'"]';
						
					} else {
					
						
						if ($this.closest('[data-required]').attr('data-required') === 'true') {
							// Variant was switched for the required product
							required = 'true';
							canBeDiscounted = false;
							
							var products = Library.RequiredProducts.get(bundleId);

						} else {
							// Variant was switched for normal bundled product
							required = 'false';
							canBeDiscounted = true;
							
							var products = Library.DiscountedProducts.get(bundleId);
							
							products = this.modifyProductsPrices(bundle, products, false, bundleKey);
							Library.DiscountedProducts.set(bundleId, products);
						}
					}
					
					// DEBUG
					var isMixNMatch = false;
					if (bundle.minimum_requirements === 'n_products') {
						// We have a Mix & Match bundle. Now, we have to retrieve the simple price, before the subscription adjustment.
						isMixNMatch = true;
					}
					
					for (var productId in products) {
						if (products.hasOwnProperty(productId) && Object.keys(products[productId]).length > 0) {
							var priceHtml = this.getProductPriceHtml(products[productId], bundleKey, bundleId, canBeDiscounted, undefined, isMixNMatch);

							$('#_bndl_'+bundleKey).find(sectionSelector+' [data-required="'+required+'"] .bndlr-product-price.id_'+productId).html(priceHtml);

													}
					}
					
					$('#_bndl_'+bundleKey).find('.bndlr-total-price').html(this.getTotalPriceText(bundle, bundleKey));
					
									},
				processPriceUpdate: function(eventDetails) {
					
					var $el = $(eventDetails.element);
					if (typeof eventDetails.price !== 'undefined') {
						var newPrice = eventDetails.price;
						
						var pricePerDelivery = newPrice;
						var deliveriesNum = 1;
													if (typeof eventDetails.pricePerDelivery === 'number') {
								pricePerDelivery = eventDetails.pricePerDelivery;
								deliveriesNum = newPrice/pricePerDelivery;
							}
												
						var isSubscriptionPrice = false;
						if (typeof eventDetails.isSubscriptionPrice === 'boolean') {
							isSubscriptionPrice = eventDetails.isSubscriptionPrice;
						}
						
						var isGroupedWidget = false;
						if (eventDetails.element !== 'undefined') {
							if (eventDetails.element.hasAttribute('data-product-handles')) {
								isGroupedWidget = true;
							}
						}
						
						if (isGroupedWidget === true) {
							// Don't process the price update for grouped widget.
							return true;
						}
						

						var bundleId 	= $el.closest('[data-bundle]').attr('data-bundle');
						var bundleKey 	= $el.closest('[data-bndlr-key]').attr('data-bndlr-key');
						
						if (typeof bundleId === 'undefined' || typeof bundleKey === 'undefined') {
							return true;
						}
						
						var required 			= false;
						var canBeDiscounted 	= true;
						var isMixNMatch			= false;
						var isSectionedBundle	= false;
						
						if ($el.closest('.bndlr-product.bndlr-mix-and-match[data-line-item-key]').length) {
							// Get lineItemKey, which is essentially the variant_id
							var lineItemKey = $el.closest('.bndlr-product.bndlr-mix-and-match[data-line-item-key]').attr('data-line-item-key');
							isMixNMatch 	= true;
							var products = Library.DiscountedProducts.get(bundleId);
							
						} else if ($el.closest('.bndlr-sectioned-status-box-product[data-line-item-key][data-section-id]').length) {
							// Sectioned bundles 
							// Get lineItemKey, which is essentially the variant_id
							var lineItemKey = $el.closest('.bndlr-sectioned-status-box-product[data-line-item-key][data-section-id]').attr('data-line-item-key');
							var sectionId 	= $el.closest('.bndlr-sectioned-status-box-product[data-line-item-key][data-section-id]').attr('data-section-id');
							
							isSectionedBundle = true;

							var sectionsDiscountedProducts	= Library.SectionedBundlesProducts.get(bundleId);
							
						} else if ($el.closest('[data-required]').attr('data-required') === 'true') {
							// The price update was triggered for the required product
							required = true;
							canBeDiscounted = false;
							
							var products = Library.RequiredProducts.get(bundleId);

						} else {
							// The price update was triggered for the normal bundled product
							required = false;
							canBeDiscounted = true;
							
							var products = Library.DiscountedProducts.get(bundleId);
						}
						
						
						if (isSectionedBundle) {
							
							if (typeof sectionsDiscountedProducts[sectionId] !== 'undefined') {
								
								var products = sectionsDiscountedProducts[sectionId];
								
								for(var key in products) {
									if (products.hasOwnProperty(key)) {
										for(var pi = 0; pi < products[key].variants.length; pi++) {
											if (products[key].variants[pi].id == lineItemKey) {

												products[key].variants[pi].price 					= pricePerDelivery;
												products[key].variants[pi].priceForAllDeliveries 	= newPrice;
												products[key].variants[pi].deliveriesNum 			= deliveriesNum;
												products[key].variants[pi].isSubscriptionPrice 		= isSubscriptionPrice;
												
												products[key].variants[pi].linePriceForAllDeliveries = newPrice*products[key].variants[pi].discountedPriceQuantity;
												
												if (products[key].variants[pi].compareAtLinePrice < products[key].variants[pi].linePriceForAllDeliveries) {
													// The original compareatlineprice is smaller than the line price. Set it to the same value.
													products[key].variants[pi].compareAtLinePrice 	= products[key].variants[pi].linePriceForAllDeliveries;
													
													if (products[key].variants[pi].compare_at_price === '' || products[key].variants[pi].compare_at_price ===  0 || products[key].variants[pi].compare_at_price === null) {
														products[key].variants[pi].compare_at_price = newPrice;
													}
												}
											}
										}
									}
								}
								
								sectionsDiscountedProducts[sectionId] = products;
							}
							
							//console.log('sectionsDiscountedProducts', JSON.parse(JSON.stringify(sectionsDiscountedProducts)));

							Library.SectionedBundlesProducts.set(bundleId, sectionsDiscountedProducts);
							this.sectionedRefreshDisplay(bundleKey);
							
						} else if (isMixNMatch) {

							var SelectedMixNMatchProducts = Library.MixAndMatchBundles.get(bundleKey);
							
							for(var key in products) {
								if (products.hasOwnProperty(key)) {
									for(var pi = 0; pi < products[key].variants.length; pi++) {
										if (products[key].variants[pi].id == lineItemKey) {
											
											
											products[key].variants[pi].price 					= pricePerDelivery;
											products[key].variants[pi].priceForAllDeliveries 	= newPrice;
											products[key].variants[pi].deliveriesNum 			= deliveriesNum;
											products[key].variants[pi].isSubscriptionPrice 		= isSubscriptionPrice;
											
											products[key].variants[pi].linePriceForAllDeliveries = newPrice*products[key].variants[pi].discountedPriceQuantity;
											
											if (products[key].variants[pi].compareAtLinePrice < products[key].variants[pi].linePriceForAllDeliveries) {
												// The original compareatlineprice is smaller than the line price. Set it to the same value.
												products[key].variants[pi].compareAtLinePrice 	= products[key].variants[pi].linePriceForAllDeliveries;
												
												if (products[key].variants[pi].compare_at_price === '' || products[key].variants[pi].compare_at_price ===  0 || products[key].variants[pi].compare_at_price === null) {
													products[key].variants[pi].compare_at_price = newPrice;
												}
											}
										}
									}
								}
							}

							// Loop through Mix & Match products 
							// Find the corresponding discounted product 
							// Add it to the object 
							for(var k in SelectedMixNMatchProducts) {
								if (SelectedMixNMatchProducts.hasOwnProperty(k)) {
									
									for(var key in products) {
										if (products.hasOwnProperty(key)) {
											
											var containsCurrentVariant = false;
											for(var pi = 0; pi < products[key].variants.length; pi++) {
												if (products[key].variants[pi].id == lineItemKey) {
													containsCurrentVariant = true;
												}
											}

											if (containsCurrentVariant === true && SelectedMixNMatchProducts[k].product_id*1 == products[key].id*1) {
												
												if (typeof SelectedMixNMatchProducts[k].product === 'undefined') {
													
													SelectedMixNMatchProducts[k].product = JSON.parse(JSON.stringify(products[key]));
													
												} else {
													// Product is already set 
													// Only update the variant 
													for(var pi = 0; pi < products[key].variants.length; pi++) {
														
														for(var pii = 0; pii < SelectedMixNMatchProducts[k].product.variants.length; pii++) {
															
															if (SelectedMixNMatchProducts[k].product.variants[pii].id == products[key].variants[pi].id) {
																SelectedMixNMatchProducts[k].product.variants[pii] = products[key].variants[pi];
															}
														}
													}
													
												}
											}
										}
									}
									
								}
							}
							
							Library.MixAndMatchBundles.set(bundleKey, SelectedMixNMatchProducts);

							// You mustn't write into this array here!
							// Library.DiscountedProducts.set(bundleId, products);

														
							this.MixNMatch.refreshDisplay(bundleKey);
							
						} else {
							var productId 		= $el.closest('[data-product-id]').attr('data-product-id');
							
							if (typeof productId !== 'undefined') {
							
								var selectedVariant = this.getSelectedVariant(productId, bundleKey, bundleId, required);
								
								for(var key in products) {
									if (products.hasOwnProperty(key)) {
										
										// There is some issue where we somewhere set 'undefined' as key in the products object
										if (typeof products[key].variants !== 'undefined') {
											for(var pi = 0; pi < products[key].variants.length; pi++) {
												if (products[key].variants[pi].id == selectedVariant) {
													
																										
													
													products[key].variants[pi].price 					= pricePerDelivery;
													products[key].variants[pi].priceForAllDeliveries 	= newPrice;
													products[key].variants[pi].deliveriesNum 			= deliveriesNum;
													products[key].variants[pi].isSubscriptionPrice 		= isSubscriptionPrice;
													
													products[key].variants[pi].linePriceForAllDeliveries = newPrice*products[key].variants[pi].discountedPriceQuantity;
													
													if (products[key].variants[pi].compareAtLinePrice < products[key].variants[pi].linePriceForAllDeliveries) {
														// The original compareatlineprice is smaller than the line price. Set it to the same value.
														products[key].variants[pi].compareAtLinePrice = products[key].variants[pi].linePriceForAllDeliveries;
													}
													
													if (required) {
														products[key].variants[pi].linePrice 			= pricePerDelivery;
														//products[key].variants[pi].compareAtLinePrice 	= pricePerDelivery;
														
														if (typeof deliveriesNum === 'number' && deliveriesNum>1) {
															// Increase the price by the number of deliveries as this is the required non-discounted product, which means that we use the "price" key, not the "discountedPrice" key.
															products[key].variants[pi].price = pricePerDelivery*deliveriesNum;
														}
													}
													
												}
											}
										}
									}
								}
								
								if (required) {
									Library.RequiredProducts.set(bundleId, products);
								} else {
									Library.DiscountedProducts.set(bundleId, products);
								}
								
								this.updatePriceDisplay($el);
							}
						}
					}
					
				},
				changeDisplayedImage: function($this) {
					// Change displayed image on variant change
					// Triggered when variant select changes		

					var bundleId = $this.closest('[data-bundle]').attr('data-bundle');
					var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
					var bundle = this.getBundleById(bundleId);
					
					var currentProductId = ''; // Get the currently changed product ID so that we won't update each product in the bundle again 
					var $product = $this.closest('[data-product-id]');
					if ($product.length > 0) {
						currentProductId = $product.attr('data-product-id');
					}
					
					var sectionId = '';
					var $section = $this.closest('[data-bundler-section]');

					if ($section.length > 0) {
						sectionId = $section.attr('data-bundler-section');
					}
					
					var required = 'false';
					var canBeDiscounted = true;
					var sectionSelector = '';
					
					if (sectionId !== '') {
						// We are in sectioned bundle 
						var sectionedBundlesProducts = Library.SectionedBundlesProducts.get(bundle.id);
						
						if (typeof sectionedBundlesProducts[sectionId] !== 'undefined') {
							var products = sectionedBundlesProducts[sectionId];
						}
						
						sectionSelector = '[data-bundler-section="'+ sectionId +'"]';
						
					} else {
						
						if ($this.closest('[data-required]').attr('data-required') === 'true') {
							// Variant was switched for the required product
							required = 'true';
							canBeDiscounted = false;
							
							var products = Library.RequiredProducts.get(bundleId);

						} else {
							// Variant was switched for normal bundled product
							required = 'false';
							canBeDiscounted = true;
							
							var products = Library.DiscountedProducts.get(bundleId);
						}
					}
					
					
					for(var productId in products) {
						if (products.hasOwnProperty(productId) && currentProductId !== '' && productId === currentProductId) {
							var featuredImage = this.getFeaturedImage(products[productId], bundleKey, bundleId, !canBeDiscounted, sectionId);

							if (featuredImage !== null && featuredImage.length > 0) {
								
								$('.bundler-target-element [data-bndlr-key="'+bundleKey+'"] ' + sectionSelector + ' [data-required="'+required+'"] .bndlr-product-image.id_'+productId).attr('src', this.getProductImage(featuredImage, '500X500'));
								$('.bundler-target-element [data-bndlr-key="'+bundleKey+'"] ' + sectionSelector + ' [data-required="'+required+'"] .bndlr-product-image.id_'+productId).attr('srcset', this.getSrcSet(featuredImage, true));
								
							}
						}
					}
				},
				getImageDimensions: function(imageSrc, product) {
					
					if (typeof imageSrc !== 'string') {
						return '';
					}
					
					// Finds the dimensions of the image
					if (imageSrc.indexOf('https://') === -1) {
						imageSrc = 'https:'+imageSrc;
					}
					
					if (typeof product.media !== 'undefined') {
						for(var i = 0; i < product.media.length; i++) {							
							
							if (typeof product.media[i].src !== 'undefined' && product.media[i].src === imageSrc) {
								if (typeof product.media[i].width === 'number' && typeof product.media[i].height === 'number') {
									return 'width="'+product.media[i].width+'" height="'+product.media[i].height+'"';
								}
							}
						}
					}
					
					return '';					
				},
				getFeaturedImage: function(product, bundleKey, bundleId, fromRequiredProducts, sectionId) {
					
					if (typeof fromRequiredProducts === 'undefined') {
						fromRequiredProducts = false;
					}
					
					var featuredImage = '';
					var productId = product.id;
					
					if (fromRequiredProducts === false) {
						// Only bundled products have an option to use custom product image
						var customProductImage = this.getCustomProductImage(bundleId, productId);
						if (customProductImage !== '') {
							return customProductImage;
						}
					}

					var selectedVariant = this.getSelectedVariant(productId, bundleKey, bundleId, fromRequiredProducts, sectionId);

					if (selectedVariant === false) {
						// Use value of first variant
						if (typeof product.featured_image === 'undefined') {
							// When you request json format, the featured_image is missing
							featuredImage = this.getVariantsFeaturedImage(product, product.variants[0]);
						} else {
							featuredImage = product.featured_image;
						}
					} else {
						for (var i = 0; i < product.variants.length; i++) {

							if (selectedVariant == product.variants[i].id) {

								if (typeof product.variants[i].featured_image !== 'undefined' && 
									product.variants[i].featured_image !== null) {

									featuredImage = product.variants[i].featured_image.src;
								} else {
									// When you request json format, the featured_image is missing
									featuredImage = this.getVariantsFeaturedImage(product, product.variants[i]);
								}
							}
						}
					}
					
					if (featuredImage === '') {
						// Not needed fallback
						featuredImage = product.featured_image;
					}
					
					return featuredImage;
				},
				getCustomProductImage: function(bundleId, productId) {
					var bundle = this.getBundleById(bundleId);
					if (typeof bundle.products[productId] !== 'undefined' && typeof bundle.products[productId].image !== 'undefined') {
						return bundle.products[productId].image;
					}
					
					return '';
				},
				getVariantsFeaturedImage: function(product, variant) {
					var imageSrc = '';
					if (typeof variant.image_id !== 'undefined' && variant.image_id !== null) {
						for (var n=0; n<product.images.length; n++) {							
							if (product.images[n].id == variant.image_id) {

								if (typeof product.images[n] == 'string') {
									// .js has string
									imageSrc = product.images[n];
								} else {
									// No .js has object
									imageSrc = product.images[n].src;
								}
							}
						}
					}
					
					if (imageSrc.length == 0) {
						// Variant probably doesn't have an image
						// Return default image
						if (typeof product.featured_image !== 'undefined') {
							// .js
							return product.featured_image;
						} else {
							// No .js
							return product.image.src;
						}
					}
					
					return imageSrc;
				},
				formatPrice: function(price, currency, directionFor50) {
					
					var currencySymbols = {
						'USD': '$', // Dollar
						'AUD': '$', // Dollar
						'NZD': '$', // Dollar
						'EUR': '€', // Euro
						'CRC': '₡', // Costa Rican Colón
						'GBP': '£', // British Pound Sterling
						'ILS': '₪', // Israeli New Sheqel
						'INR': '₹', // Indian Rupee
						'JPY': '¥', // Japanese Yen
						'KRW': '₩', // South Korean Won
						'NGN': '₦', // Nigerian Naira
						'PHP': '₱', // Philippine Peso
						'PLN': 'zł', // Polish Zloty
						'PYG': '₲', // Paraguayan Guarani
						'THB': '฿', // Thai Baht
						'UAH': '₴', // Ukrainian Hryvnia
						'VND': '₫', // Vietnamese Dong
						'BRL': 'R$',
						'DKK': 'kr.'
					};
					
					price = Math.floor(price);
					
										
												
							if (typeof Shopify !== 'undefined' && typeof Shopify.currency_settings !== 'undefined' && typeof Shopify.currency_settings.money_format !== 'undefined') {
								// world-rugby-shop								
								price = utils.formatMoney(price, Shopify.currency_settings.money_format, (currency || this.getDefaultCurrency()), directionFor50);
							} else if (typeof window.money_format !== 'undefined') {
								// noelle-wolf							
								price = utils.formatMoney(price, window.money_format, (currency || this.getDefaultCurrency()), directionFor50);
							} else if (typeof window.Theme !== 'undefined' && typeof window.Theme.moneyFormat !== 'undefined') {
								// yammeya							
								price = utils.formatMoney(price, window.Theme.moneyFormat, (currency || this.getDefaultCurrency()), directionFor50);
							} else if (typeof window.theme !== 'undefined' && typeof window.theme.moneyFormat !== 'undefined') {
								// guru-muscle
								
								var moneyFormat = window.theme.moneyFormat;
																
								
								price = utils.formatMoney(price, moneyFormat, (currency || this.getDefaultCurrency()), directionFor50);
							} else if (typeof window.Currency !== 'undefined' && typeof window.Currency.money_format_no_currency === 'string') {
								// teamm8
								price = utils.formatMoney(price, window.Currency.money_format_no_currency, (currency || this.getDefaultCurrency()), directionFor50);
							} else if (typeof window.theme !== 'undefined' && typeof window.theme.settings !== 'undefined' && typeof window.theme.settings.moneyFormat !== 'undefined') {
								try {
									// The regex match ishere because the currency converter doesn't work correcty if you set a different format via cookie
									var format = theme.settings.moneyFormat
									// format = theme.settings.moneyFormat.match(/\{\{\s*(\w+)\s*\}\}/)[0];
									price = utils.formatMoney(price, format, (currency || this.getDefaultCurrency()), directionFor50);
								} catch(e) {
									bundlerConsole.log(e);
								}
							} else {
								price = price/100;
								
								if (typeof currency === 'undefined') {
									var currency = this.getDefaultCurrency();
								}
								
								price = price.toLocaleString(undefined, { style: 'currency', currency: currency });
							}
											
										
					return price;
				},
				getDefaultCurrency: function() {
					if (typeof Shopify !== 'undefined' && typeof Shopify.currency !== 'undefined' && typeof Shopify.currency.active !== 'undefined') {
						var currency = Shopify.currency.active;
					} else {
													var currency = 'USD';
											}
					
					return currency;
				},
				MixNMatch: {
					// Adds bundle product to the bundle (for mix & match bundles)
					addToBundle: function($this) {
						
						var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
						var properties = {};
						
						var $product = $this.closest('.bndlr-product');					
						
						var variantId 	= $product.find('select.bndlr-select-variant[name="variant_id"] option:selected').val();
						
						var productId 	= $product.attr('data-product-id');
						var quantity 	= 1;
						
						try {
							var $quantityInput = $product.find('.bndlr-add-to-bundle-container .quantity-input');
							
							if ($quantityInput.length > 0) {
								quantity = parseInt($quantityInput.val(), 10);
							}

						} catch(e) {
							
						}

						// var quantityAttr = $product.attr('data-quantity');
						// if (typeof quantityAttr !== 'undefined' && quantityAttr !== null && quantityAttr*1 > 0) {
						// 	quantity = quantityAttr*1;
						// 	console.log(quantity)
						// }
						
						// This only returns the limit for the total number of items in the bundle
						var numOfRemainingProduct = this.getRemainingMaxProductsNum(bundleKey, numOfRemainingProduct);

						if (quantity > 1 && numOfRemainingProduct !== null && numOfRemainingProduct < quantity) {
							quantity = numOfRemainingProduct; // Reduce the quantity to the max allowed quantity.
						}
						
						// Get max remaining product quantity for this specific product 
						var remainingProductQuantity = bndlr.MixNMatch.getRemainingProductQuantity(bundleKey, productId);
						
						if (remainingProductQuantity < quantity) {
							quantity = remainingProductQuantity;
						}
						if (quantity < 0) {
							quantity = 0;
						}
						
						//console.log('variantId', variantId);
						

						if (typeof variantId === 'undefined') {
							// It looks like the variant selector is without any options. Display error message.
							var productTitle = $product.find('.bndlr-product-title').first().text();
							// Show warning/error message. It has to be sent in the correct format (HTTP response).
							bndlr.showWarningMessage({
								responseJSON: {
									description: 'Product: '+productTitle+' is not available.'
								}
							}, bundleKey);
						} else {						
							var products = Library.MixAndMatchBundles.get(bundleKey);

							if (typeof products[variantId] !== 'undefined') {
								products[variantId].quantity += quantity;
							} else {
								products[variantId] = {
									product_id: productId,
									variant_id: variantId,
									quantity:	quantity
								}
							}
							
							Library.MixAndMatchBundles.set(bundleKey, products);

							widgetView.drawSelectedProducts(bundleKey, products);
							widgetView.MixNMatch.fadeInSelectedProducts(bundleKey);
							
							widgetView.addToCartButton.showCheckmark($this);
							
							try {
								// Get all line item properties (mostly subscription props).
								var prodProperties = bndlr.getLineItemProperties($product);
								var props = JSON.parse(JSON.stringify(prodProperties));
								
								var event = new CustomEvent("bndlr:mixnmatch:product_added", {
									detail: {
										product_id	: productId,
										variant_id	: variantId,
										quantity	: quantity,
										properties	: props
									}
								});
								document.dispatchEvent(event);
							} catch(e) {}
						}
						
						this.refreshDisplay(bundleKey);
						
					},
										// Update total price, button, etc. in the mix and match bundle widget
					refreshDisplay: function(bundleKey) {
						// Get bundle
						var htmlId = '#_bndl_'+bundleKey;
						var $element = $(htmlId);

						var bundleId = $element.closest('[data-bundle]').attr('data-bundle');
						bundleId = parseInt(bundleId);
						var bundle = bndlr.getBundleById(bundleId);
						
						// Show or hide add to bundle buttons
						this.showHideAddToBundleButtons(bundleKey);
						// Refresh the instructions text
						this.refreshInstructionsText(bundleKey, bundle);
						
						// Show or hide add to cart button if the bundle already fulfills the minimum requirements
						// Get number of container products
						var numberOfSelectedProducts = this.getNumOfselectedProducts(bundleKey);
						var numberofMissingProducts = this.getNumberOfRemainingProducts(bundle, numberOfSelectedProducts);
						
												
						// Get true|false if the bundle is missing one or more required products
						var isMissingRequiredProducts = this.isMissingRequiredProducts(bundleKey, bundle);

						if (numberofMissingProducts === 0 && isMissingRequiredProducts === false) {
							widgetView.MixNMatch.fadeInAddToCartButton(bundleKey);
						} else {
							widgetView.MixNMatch.fadeOutAddToCartButton(bundleKey);
						}
						
						// Recalculate total price
						var selectedProducts = Library.MixAndMatchBundles.get(bundleKey);
						var products = Library.DiscountedProducts.get(bundleId);
						
						// Recreate bundle and set the selected products in it so we can calculate the total price like we would normally do it
						var recreatedBundle = JSON.parse(JSON.stringify(bundle));
						recreatedBundle.mix_and_match_display = 'false';

						var recreatedProducts = {};
						
						var applicableVolumeDiscountTier = {};
						
						if (typeof bundle.volume_discounts !== 'undefined' && bundle.volume_discounts.length > 0) {

							var showTieredMixnMatchInstructionsText = false;
							//var tieredMixnMatchLimitReached = false;
							// Loop through volume discounts, bundle products, cart items and push in as many products as you can for each volume discount
							for (var p = (bundle.volume_discounts.length - 1); p >= 0; p--) {
								
								var volumeDiscount = bundle.volume_discounts[p];
								
								var minTotal 		= volumeDiscount.min_items; 		// The minimum quantity requirements are checked below
								var max 			= volumeDiscount.max_items;
								var rangeType 		= volumeDiscount.range_type; 		// Possible values: fixed_quantity, range, min_limit_only, min_cart_value

								if (max == '0') {
									max = null;
								}
								
								if (rangeType === 'min_limit_only') {
									// Set max quantity to null, as we don't have any limit set up
									max = null;
								}
								
								/*
								if (max !== null && max <= numberOfSelectedProducts) {
									tieredMixnMatchLimitReached = true;
								}*/
								
								if (numberOfSelectedProducts >= minTotal && (max === null || numberOfSelectedProducts <= max)) {
									// We can apply this volume discount 
									applicableVolumeDiscountTier = JSON.parse(JSON.stringify(volumeDiscount));
									
									if (p < (bundle.volume_discounts.length - 1)) {
										// It seems that we still aren't in the last option 
										// Show the instructions text 
										
										showTieredMixnMatchInstructionsText = true;
									}
									
									// Stop the loop 
									p = 0;
								}
							}
							
							if (showTieredMixnMatchInstructionsText === true) {
								widgetView.MixNMatch.fadeInTieredMnMInstructions(bundleKey);
							} else {
								widgetView.MixNMatch.fadeOutTieredMnMInstructions(bundleKey);
							}
							
							/*
							if (tieredMixnMatchLimitReached === true) {
								widgetView.MixNMatch.fadeOutAddToCartButton(bundleKey);
							}
							*/
						}

						for (var key in selectedProducts) {
							if (selectedProducts.hasOwnProperty(key)) {
								var variantId 	= selectedProducts[key].variant_id;
								var productId 	= selectedProducts[key].product_id;
								var quantity 	= selectedProducts[key].quantity;
								var product = {};

								if (bundle.product_level == 'product') {
									product = products[productId];
								} else {
									product = products[productId];
								}
								
								if (typeof selectedProducts[key].product !== 'undefined') {
									// We have set the custom product data (prices) for this selected product. 
									// This happens when we also display a subscription widget in the Mix & Match widget. 
									// Use this data, as it contains subscription discounts and price increases (for prepaid subs).
									product = selectedProducts[key].product;
								}

								var prd = JSON.parse(JSON.stringify(product));
								
								for (var i = 0; i<product.variants.length; i++) {
									if (product.variants[i].id == variantId) {
										var variant = JSON.parse(JSON.stringify(product.variants[i]));

										prd.quantity = quantity;
										prd.variants = [product.variants[i]];
									}
								}
								
								if (Object.keys(applicableVolumeDiscountTier).length > 0) {
									// We have a volume discount, which can be applied here 
									prd.volume_discount = JSON.parse(JSON.stringify(applicableVolumeDiscountTier));
								}
								
								
								
								recreatedProducts[key] = prd;
							}							
						}

						if (this.getNumberOfRemainingProducts(bundle, numberOfSelectedProducts) === 0) {
							recreatedProducts = bndlr.modifyProductsPrices(recreatedBundle, recreatedProducts, true); // Simulate POS
						}
						
												
														
							var list = '';
							for(var k in recreatedProducts) {
								if (recreatedProducts.hasOwnProperty(k)) {
									if (typeof recreatedProducts[k].handle !== 'undefined' && typeof recreatedProducts[k].variants[0].id !== 'undefined') {
										list += recreatedProducts[k].handle + ':' + recreatedProducts[k].variants[0].id +',';
									} else if(typeof recreatedProducts[k].handle !== 'undefined') {
										list += recreatedProducts[k].handle +',';
									}
								}
							}
							
							// Remove last comma
							list = list.replace(/,+$/, '');
							
							$('.bundler-target-element [data-bndlr-key="'+bundleKey+'"] .sealsubs-target-element-bundle').attr('data-product-handles', list);
							
							if (typeof window.SealSubs !== 'undefined' && typeof window.SealSubs.refresh === 'function') {
								numberOfSelectedProducts 	= this.getNumOfselectedProducts(bundleKey);
								numberofMissingProducts 	= this.getNumberOfRemainingProducts(bundle, numberOfSelectedProducts);
								
								isMissingRequiredProducts = this.isMissingRequiredProducts(bundleKey, bundle);
								if (numberofMissingProducts === 0 && isMissingRequiredProducts === false) {
									window.SealSubs.refresh();
								}
							}
												
												
						var totalPriceText = bndlr.getMixNMatchTotalPriceText(recreatedBundle, recreatedProducts);
						
						$element.find('.bndlr-mnm-total-price').html(totalPriceText);
						
						bndlr.setProductWidth(htmlId+' .bndlr-mnm-second-container', $element.find('.bndlr-mnm-second-container'));
						
													// Trigger check for the status box display with a timeout to give it a chance to render completely
							window.requestAnimationFrame(this.showHideStatusBox);
												
						if (bndlr.repositionPlusSignsTimeout != false) {
							clearTimeout(bndlr.repositionPlusSignsTimeout);
						}
						bndlr.repositionPlusSignsTimeout = setTimeout(function() {
							bndlr.repositionPlusSigns('#_bndl_'+bundleKey);
						}, 200);
						
						bndlr.convertCurrency('.bndlr-mnm-total-price');
						
						try {
							var event = new CustomEvent("bundler:mixnmatch_refreshed");
							document.dispatchEvent(event);
						} catch(e) {}
						
						
					},
										refreshInstructionsText: function(bundleKey, bundle) {
						
						var numberOfSelectedProducts = this.getNumOfselectedProducts(bundleKey);
						
						var isMissingRequiredProducts = this.isMissingRequiredProducts(bundleKey, bundle);
						
						var content = this.getInstructionsText(bundle, numberOfSelectedProducts, isMissingRequiredProducts);
						
						$('[data-bndlr-key="'+bundleKey+'"] .bndlr-mnm-instructions-text').html(content);
						$('#bndlr-mnm-status-box[data-bndlr-bundle-key="'+bundleKey+'"] .bndlr-mnm-instructions-text').html(content);
						
						
						var tieredBundleNextDiscountText = bndlr.MixNMatch.getInstructionsTextTiered(bundle, numberOfSelectedProducts);
						$('[data-bndlr-key="'+bundleKey+'"] .bndlr-tiered-mnm-instructions-text .bndlr-tiered-mnm-instructions-text-inner').html(tieredBundleNextDiscountText);
					},
					getNumOfselectedProducts: function(bundleKey) {
						var products 		= Library.MixAndMatchBundles.get(bundleKey);
						var productsCount 	= 0;
						for (var key in products) {
							if (products.hasOwnProperty(key)) {
								productsCount += products[key].quantity;
							}
						}
						return productsCount;
					},
					isMissingRequiredProducts: function(bundleKey, bundle) {						
						var products 		= Library.MixAndMatchBundles.get(bundleKey);
						
						var numOfRequiredProducts 		= 0;
						var containedRequiredProducts 	= 0;
						
						for(var key in bundle.products) {
							if (bundle.products.hasOwnProperty(key)) {
								if (bundle.products[key].required === 1) {
									numOfRequiredProducts++;
									
									var productIsContained = false;
									for(var k in products) {
										if (products.hasOwnProperty(k)) {
											if (products[k].product_id == bundle.products[key].id) {
												// The required product IS in the configured bundle
												containedRequiredProducts++;
												productIsContained = true;
												// Break the loop, so we don't count the same product multiple times, as this could increase the contained products count too much
												break;
											}
										}
									}
									
									if (productIsContained === false) {
										// Return true to save loops, as the product is required, but not in the bundle.
										return true;
									}
								}
							}
						}
						
						if (containedRequiredProducts === numOfRequiredProducts) {
							return false;
						} else {
							return true;
						}					
					},
					showHideAddToBundleButtons: function(bundleKey) {
						if (bndlr.MixNMatch.canAddMoreProducts(bundleKey) === false) {
							// Checks if there are already more products selected then they are allowed to be
							widgetView.MixNMatch.hideAddtoBundleButtons(bundleKey);
						} else {
							// there are less than max allowed products selected
							// Loop through products and check if any of them can't be selected anymore
							$('[data-bndlr-key="'+bundleKey+'"] .bndlr-mnm-available-products .bndlr-product').each(function(key, el) {
								var productId = $(el).attr('data-product-id');
								if (bndlr.MixNMatch.canAddMoreProduct(bundleKey, productId) === false) {
									widgetView.MixNMatch.hideAddtoBundleButton(bundleKey, productId);
								} else {
									widgetView.MixNMatch.showAddtoBundleButton(bundleKey, productId);
								}
							});
						}
					},
					canAddMoreProducts: function(bundleKey) {
						
						// check if any product can still be added to the mix and match bundle
						var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
						bundleId = parseInt(bundleId);
						
						var bundle 						= bndlr.getBundleById(bundleId);
						var numberOfSelectedProducts 	= this.getNumOfselectedProducts(bundleKey);
						
						if (typeof bundle.volume_discounts !== 'undefined' && bundle.volume_discounts.length > 0) {

							var tieredMixnMatchLimitReached = false;
							
							// Get the last volume discount and determine if more items can be added to the bundle or not.
							var volumeDiscount = bundle.volume_discounts[(bundle.volume_discounts.length - 1)];

							var max 			= volumeDiscount.max_items;
							var rangeType 		= volumeDiscount.range_type; 		// Possible values: fixed_quantity, range, min_limit_only, min_cart_value

							if (max == '0') {
								max = null;
							}

							if (rangeType === 'range' && max !== '' && max !== null && max <= numberOfSelectedProducts) {
								tieredMixnMatchLimitReached = true;
							}
							
							return !tieredMixnMatchLimitReached;
						}
						
						if (bundle.minimum_requirements_n_max_products === null) {
							return true;
						}
						
						if (bundle.minimum_requirements_n_max_products > numberOfSelectedProducts) {
							return true;
						}
						
						
						
						return false;
					},
					getRemainingMaxProductsNum: function(bundleKey) { // remainingProducts will get the number of remaining available products count through reference						
						// check if any product can still be added to the mix and match bundle
						var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
						bundleId = parseInt(bundleId);
						
						var bundle = bndlr.getBundleById(bundleId);
						var numberOfSelectedProducts = this.getNumOfselectedProducts(bundleKey);
						
						if (bundle.minimum_requirements_n_max_products === null) {
							return null;
						}

						if (bundle.minimum_requirements_n_max_products > numberOfSelectedProducts) {
							return bundle.minimum_requirements_n_max_products*1 - numberOfSelectedProducts*1;
						}
						
						return 0;
					},
					getRemainingProductQuantity: function(bundleKey, productId) {
						
						// check if this product can still be added to the mix and match bundle
						var bundleId 	= $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
						bundleId 		= parseInt(bundleId);
						
						var bundle = bndlr.getBundleById(bundleId);
						
						var products = Library.MixAndMatchBundles.get(bundleKey);
						
						var allowedTotalProductQuantity = bundle.products[productId].quantity;
						
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								
								if (bundle.product_level == 'product') {
									
									if (products[key].product_id == productId) {
										// Decrease the total allowed for this product by the current variant quantity.
										// This is so because you can have multiple quantities of the same product, but only allow N total items of this product across the variants.
										allowedTotalProductQuantity -= products[key].quantity;
									}
								} else {
									if (products[key].variant_id == productId) {
										
										allowedTotalProductQuantity -= products[key].quantity;
									}
								}
							}
						}
						
						return allowedTotalProductQuantity;
					},
					canAddMoreProduct: function(bundleKey, productId) {
						
						// check if this product can still be added to the mix and match bundle
						var bundleId 	= $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
						bundleId 		= parseInt(bundleId);
						
						var bundle = bndlr.getBundleById(bundleId);
						
						var products = Library.MixAndMatchBundles.get(bundleKey);
						
						var allowedTotalProductQuantity = bundle.products[productId].quantity;
						
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								
								if (bundle.product_level == 'product') {
									
									if (products[key].product_id == productId) {
										// Decrease the total allowed for this product by the current variant quantity.
										// This is so because you can have multiple quantities of the same product, but only allow N total items of this product across the variants.
										allowedTotalProductQuantity -= products[key].quantity;
										
										if (allowedTotalProductQuantity <= 0) {
											return false;
										}
									}
								} else {
									if (products[key].variant_id == productId) {
										
										if (products[key].quantity >= bundle.products[productId].quantity) {
											return false;
										} else {
											return true;
										}
									}
								}
							}
						}
						
						if (allowedTotalProductQuantity > 0) {
							return true;
						} else {
							return false;
						}
					},
					removeFromBundle: function($this) {
						// removes item from mix and match bundle
						var lineItemKey = $this.closest('[data-line-item-key]').attr('data-line-item-key');
						var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
						
						var products = Library.MixAndMatchBundles.get(bundleKey);

						if (typeof products[lineItemKey] !== 'undefined') {
							delete products[lineItemKey];
							
							Library.MixAndMatchBundles.set(bundleKey, products);

							widgetView.drawSelectedProducts(bundleKey, products);
							if (Object.keys(products).length === 0) {
								widgetView.MixNMatch.fadeOutSelectedProducts(bundleKey);
							}
							this.refreshDisplay(bundleKey);
						}
					},
					productsToString: function(products) {
						// Transforms products object to a string p-product_id:variant_id=quantity&...
						var productsString = '';
						for(var key in products) {
							if (products.hasOwnProperty(key)) {
								productsString += 'p-'+products[key].product_id+'-'+products[key].variant_id+'='+products[key].quantity+'&';
							}
						}
						
						return productsString;
						
					},
					addMixAndMatchBundleToCart: function($this, $outOfWidgetButton) {

						var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
						var $bundleContainer = $this.closest('[data-bndlr-key]');
						
						var products = Library.MixAndMatchBundles.get(bundleKey);

						$this.addClass('bndlr-loading');
						if (typeof $outOfWidgetButton !== 'undefined') {
							$outOfWidgetButton.addClass('bndlr-loading');
						}
						
						if (typeof clientSpecifics['add_to_cart_control_mixnmatch'] !== 'undefined') {
							var canContinue = clientSpecifics['add_to_cart_control_mixnmatch'].trigger($this);
						} else {
							var canContinue = true;
						}
						
						
												
						
						if (canContinue) {
						
							var queueKey = 'mixandmatchaddtocart';

							var items = [];
							
							
							
							for (var key in products) {
								if (products.hasOwnProperty(key)) {

									(function() {
									
										var variantId 	= products[key].variant_id;
										var quantity 	= products[key].quantity;									
										
										var $el = $bundleContainer.find('.bndlr-mnm-selected-products .bndlr-product[data-line-item-key="'+key+'"]').first();
										// Get all line item properties (mostly subscription props).
										var prodProperties = bndlr.getLineItemProperties($el);
										var props = JSON.parse(JSON.stringify(prodProperties));
										
										// Get all line item properties (mostly subscription props).
										var sellingPlan = bndlr.getSellingPlan($el);
							
										
										// Add item to the array so we can add them to the cart with one ajax call
										items.push({
											id			: variantId,
											quantity	: quantity,
											properties	: props,
											selling_plan: sellingPlan
										});
										
									})();
								}
							}
							
														
							bndlr.addItemsToCart(items, queueKey, bundleKey, $this, $outOfWidgetButton);
							queue.process(queueKey);
							
													}
					},
					getInstructionsText: function(bundle, numberOfProducts, isMissingRequiredProducts) {
						var content = '';
						
						var remainingProducts = this.getNumberOfRemainingProducts(bundle, numberOfProducts);
						
						if (remainingProducts>0) {
							content = 'Your bundle needs {{n}} more item(s).';
							content = content.replace('{{n}}', remainingProducts);
						} else if(isMissingRequiredProducts) {
							content = 'Your bundle is missing the required product(s).';
						}
						
						return content;
					},
					getInstructionsTextTiered: function(bundle, numberOfProducts) {
						var content = '';
						
						
						if (typeof bundle.volume_discounts !== 'undefined' && bundle.volume_discounts.length > 1) {
							var nextDiscount = this.getNextDiscount(bundle, numberOfProducts);
							
							var missingItemsCount = nextDiscount.min_items*1 - numberOfProducts;
							if (missingItemsCount > 0) {
								
								var nextDiscountValue 	= nextDiscount.discount_value;
								var nextDiscountType 	= nextDiscount.discount_type;
								
								//var currencySymbol = '';
							
								var discountUnit = '';
								/*
								if (typeof Shopify !== 'undefined' && typeof Shopify.currency !== 'undefined' && typeof Shopify.currency.active === 'string') {
									//discountUnit = Shopify.currency.active;
									currencySymbol = utils.getCurrencySymbol(Shopify.currency.active);
								}
								
								discountUnit = currencySymbol;*/
								
								var savings = '';
								if (nextDiscount.discount_type === 'percentage') {
									discountUnit = '%';
									savings = nextDiscountValue+discountUnit;
								} else {
									savings = bndlr.formatPrice(nextDiscountValue*100);
								}
								
								//var text = 'Add {{missing_items_count}} more item(s) to get up to {{discount_value}} OFF!';
								var text = 'Add {{missing_items_count}} more item(s) to get up to {{discount_value}} OFF!';
								
								var keyValue = {
									'missing_items_count' 	: missingItemsCount,
									'discount_value' 		: savings
								};

								content = GlobalUtility.liquidReplaceMulti(text, keyValue); 
								//content = 'Add '+missingItemsCount+' more item(s) to get up to '+nextDiscountValue+discountUnit+' OFF!';
								
							}
						}
						
						/*
						var remainingProducts = this.getNextDiscount(bundle, numberOfProducts);
						
						if (remainingProducts>0) {
							content = 'Your bundle needs {{n}} more item(s).';
							content = content.replace('{{n}}', remainingProducts);
						} else if(isMissingRequiredProducts) {
							content = 'Your bundle is missing the required product(s).';
						}
						*/
						
						return content;
					},
					getNextDiscount: function(bundle, numberOfProducts) {
						
						var nextDiscount = {};
						
						for (var i = 0; i < bundle.volume_discounts.length; i++) {
							if (bundle.volume_discounts[i].min_items*1 > numberOfProducts) {
								// This is the next discount
								nextDiscount = bundle.volume_discounts[i];
								// break the loop
								i = bundle.volume_discounts.length;
							}
						}
						
						return nextDiscount;
					},
					getNumberOfRemainingProductsUntilMax: function(bundle, numberOfProducts) {
						var remainingProductsUntiMax = 0;
						
						if (typeof bundle.volume_discounts !== 'undefined' && bundle.volume_discounts.length > 0 && typeof bundle.volume_discounts[0] !== 'undefined' && typeof bundle.volume_discounts[0].min_items !== 'undefined') {
							// Take the min value from the first volume discount 
							remainingProductsUntiMax = bundle.volume_discounts[0].min_items - numberOfProducts;
							
						} else {
							
							remainingProductsUntiMax = bundle.minimum_requirements_n_max_products - numberOfProducts;
						}
						
						if (remainingProductsUntiMax>0) {
							return remainingProductsUntiMax;
						} else {
							return Infinity;
						}
						
					},
					getNumberOfRemainingProducts: function(bundle, numberOfProducts) {
						
						var remainingProducts = 0;
						
						if (typeof bundle.volume_discounts !== 'undefined' && bundle.volume_discounts.length > 0 && typeof bundle.volume_discounts[0] !== 'undefined' && typeof bundle.volume_discounts[0].min_items !== 'undefined') {
							// Take the min value from the first volume discount 
							remainingProducts = bundle.volume_discounts[0].min_items - numberOfProducts;
							
						} else {
							
							remainingProducts = bundle.minimum_requirements_num - numberOfProducts;
						}
						
						if (remainingProducts>0) {
							return remainingProducts;
						}
						
						return 0;
					}
											,
						showHideStatusBox: function() {
							if ($('.bndlr-mnm-add-to-cart-wrapper .bndlr-add-bundle-to-cart').first().is(':visible') === false) {
								$('#bndlr-mnm-status-box').removeClass('bndlr-visibility-hidden').addClass('bndlr-visibility-visible');
							} else {
								var cartButton = $('.bndlr-mnm-add-to-cart-wrapper .bndlr-add-bundle-to-cart').first();
								
								var cbOffsetTop 	= cartButton.offset().top;
								var cbHeight 		= cartButton.height() + 40;
								var windowHeight 	= $(window).height();
								var windowScrollTop = $(window).scrollTop();

								if ((cbOffsetTop+cbHeight) > (windowHeight + windowScrollTop) || (cbOffsetTop) < (windowScrollTop)) {
									// Add bundle to the cart button is NOT in the viewport									
									$('#bndlr-mnm-status-box').removeClass('bndlr-visibility-hidden').addClass('bndlr-visibility-visible');
								} else {
									// Add bundle to the cart button is visible
									$('#bndlr-mnm-status-box').removeClass('bndlr-visibility-visible').addClass('bndlr-visibility-hidden');
								}
							}
						}
									},
				
				sectionedAddToBundle: function($this) {

					var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
					var properties = {};
					
					var $product = $this.closest('.bndlr-product');					
					
					var variantId 	= $product.find('select.bndlr-select-variant[name="variant_id"] option:selected').val();
					var productId 	= $product.attr('data-product-id');
                    var required    = $product.attr('data-mnm-required');

					var quantity 	= 1;
					
					var quantityAttr = $product.attr('data-quantity');
					if (typeof quantityAttr !== 'undefined' && quantityAttr !== null && quantityAttr*1 > 0) {
						quantity = quantityAttr*1;
					}
					
					var sectionId = $product.closest('[data-bundler-section]').attr('data-bundler-section');

					
					var numOfRemainingProduct = this.sectionedGetRemainingMaxProductsNum(bundleKey, sectionId);


					if (quantity > 1 && numOfRemainingProduct !== null && numOfRemainingProduct < quantity) {
						quantity = numOfRemainingProduct; // Reduce the quantity to the max allowed quantity.
					}
					

					if (typeof variantId === 'undefined') {
						// It looks like the variant selector is without any options. Display error message.
						var productTitle = $product.find('.bndlr-product-title').first().text();
						// Show warning/error message. It has to be sent in the correct format (HTTP response).
						bndlr.showWarningMessage({
							responseJSON: {
								description: 'Product: '+productTitle+' is not available.'
							}
						}, bundleKey);
					} else {
						
						var sections = Library.SectionedBundlesProductsSelected.get(bundleKey);
						
						var section = {};

						if (typeof sections[sectionId] !== 'undefined') {
							section = sections[sectionId];
						} 
						
						// Get all line item properties (mostly subscription props).
						var prodProperties = bndlr.getLineItemProperties($product);
						
						var props = JSON.parse(JSON.stringify(prodProperties));

						if (typeof section[variantId] !== 'undefined') {
							section[variantId].quantity += quantity;
						} else {
							section[variantId] = {
								product_id	: productId,
								variant_id	: variantId,
								quantity	: quantity,
                                required    : required,
								properties	: props
							}
						}
						
						sections[sectionId] = section;
						
						
						Library.SectionedBundlesProductsSelected.set(bundleKey, sections);

						widgetView.Sectioned.drawSelectedProducts(bundleKey, sections);
						
						// Added as per request from 2ad8d0-2
						widgetView.addToCartButton.showCheckmark($this);
						
						try {
							// Get all line item properties (mostly subscription props).
							//var prodProperties = bndlr.getLineItemProperties($product);
							
							//var props = JSON.parse(JSON.stringify(prodProperties));
							
							// TODO: We might have to change this event, so that Seal Subscriptions app will understand it
							var event = new CustomEvent("bndlr:sectioned_mixnmatch:product_added", {
								detail: {
									product_id	: productId,
									variant_id	: variantId,
									quantity	: quantity,
									properties	: props
								}
							});
							document.dispatchEvent(event);
						} catch(e) {}
					}
					
					this.sectionedRefreshDisplay(bundleKey);
					
				},
				goToNextUnfulfilledSection: function(bundleKey) {
					
					var firstUnfulfilledSection = $('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-main-container .bndlr-sections-container [data-requirements-fulfilled="false"]').first();
					
					var currentActiveSection = $('[data-bndlr-key="'+bundleKey+'"] [data-bundler-active-section]').attr('data-bundler-active-section');
					if (firstUnfulfilledSection.length > 0) {
						// Go to this section 
						var sectionId = firstUnfulfilledSection.attr('data-bundler-section');
						$('[data-bndlr-key="'+bundleKey+'"] [data-bundler-active-section]').attr('data-bundler-active-section', sectionId*1);
					} else {
						// We don't have any unfulfilled sections anymore. 
						// Check if there is any section left before the end and go directly to it. 
						var activeSectionId = $('[data-bndlr-key="'+bundleKey+'"] [data-bundler-active-section]').attr('data-bundler-active-section');
						if (typeof activeSectionId !== 'undefined') {
							
							activeSectionId = activeSectionId*1;
							
							if (activeSectionId >= 0) {

								var nextSectionId = activeSectionId+1;
								var nextSection = $('[data-bndlr-key="'+bundleKey+'"] [data-bundler-section="'+nextSectionId+'"].bndlr-sectioned-section');

								if (nextSection.length > 0) {
									$('[data-bndlr-key="'+bundleKey+'"] [data-bundler-active-section]').attr('data-bundler-active-section', nextSectionId*1);
								}
							}
						}
					}
					
										
									
					
					//$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-status-container .bndlr-sectioned-section-status[data-bundler-section-status="' + sectionId + '"]').attr('data-requirements-fulfilled', fulfilled);
					//$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sectioned-section[data-bundler-section="' + sectionId + '"]').attr('data-requirements-fulfilled', fulfilled);
				},
				sectionedSelectSection: function($this) {
					// Select the section 
					var sectionId = $this.closest('[data-bundler-section-status]').attr('data-bundler-section-status');
					$this.closest('[data-bndlr-key]').find('[data-bundler-active-section]').attr('data-bundler-active-section', sectionId);
					
					this.scrollToSection(); // Added for montana-casting-co-staging-site
					
									},
				sectionedSelectNextSection: function($this) {

					// Select the NEXT section 
					var sectionId = $this.closest('[data-bundler-section]').attr('data-bundler-section');
					$this.closest('[data-bndlr-key]').find('[data-bundler-active-section]').attr('data-bundler-active-section', sectionId*1+1);
					
					this.scrollToSection();
					
									},
				scrollToSection: function() {
					try {
						// Scroll the user back to the top if the top isn't yet in the viewport
						var $sectionsContainer = $('.bndlr-sections-container');
						
						if ($sectionsContainer.length === 1) {
							
							var sectionOffsetTop 	= $sectionsContainer.offset().top;
							var sectionHeight 		= $sectionsContainer.height() + 40;
							var windowHeight 		= $(window).height();
							var windowScrollTop 	= $(window).scrollTop();

							if ((sectionOffsetTop+sectionHeight) > (windowHeight + windowScrollTop) || (sectionOffsetTop) < (windowScrollTop)) {
								// The start of the section container is NOT in the viewport								
								// Scroll back up 							
								$sectionsContainer[0].scrollIntoView({start: true, behavior: "smooth"});
							}
						}
					} catch(e) {}	
				},
				scrollToAddToCartButton: function() {
					try {
						// Scroll the user back to the top if the top isn't yet in the viewport
						var $targetElement = $('.bndlr-add-sectioned-bundle-to-cart');
						
						console.log('targetElement', $targetElement);
						
						if ($targetElement.length === 1) {
							
							var sectionOffsetTop 	= $targetElement.offset().top;
							var sectionHeight 		= $targetElement.height() + 40;
							var windowHeight 		= $(window).height();
							var windowScrollTop 	= $(window).scrollTop();

							if ((sectionOffsetTop+sectionHeight) > (windowHeight + windowScrollTop) || (sectionOffsetTop) < (windowScrollTop)) {
								// The start of the section container is NOT in the viewport								
								// Scroll back up 							
								$targetElement[0].scrollIntoView({behavior: "smooth"});
							}
						}
					} catch(e) {}	
				},
				sectionedRemoveFromBundle: function($this) {
					// removes item from mix and match bundle
					var lineItemKey = $this.closest('[data-line-item-key]').attr('data-line-item-key');
					var bundleKey 	= $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
					var sectionId 	= $this.closest('[data-section-id]').attr('data-section-id');
					
					var sections = Library.SectionedBundlesProductsSelected.get(bundleKey);
					
					if (typeof sections[sectionId] !== 'undefined' && typeof sections[sectionId][lineItemKey] !== 'undefined') {
						delete sections[sectionId][lineItemKey];
					}
					Library.SectionedBundlesProductsSelected.set(bundleKey, sections);
					
					widgetView.Sectioned.drawSelectedProducts(bundleKey, sections);
					
					this.sectionedRefreshDisplay(bundleKey);
				},
				sectionedGetRemainingMaxProductsNum: function(bundleKey, sectionId) {
					
					// check if any product can still be added to the mix and match bundle
					var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
					bundleId = parseInt(bundleId);
					
					var bundle = bndlr.getBundleById(bundleId);
					
					if (typeof bundle.sections[sectionId] === 'undefined') {
						return 0;
					}
					
					var numberOfSelectedProducts = this.sectionedGetNumOfSelectedProducts(bundleKey, sectionId);
					
					if (bundle.sections[sectionId].max_items === null || bundle.sections[sectionId].max_items === '') {
						return null;
					}

					if (bundle.sections[sectionId].max_items > numberOfSelectedProducts) {
						return bundle.sections[sectionId].max_items*1 - numberOfSelectedProducts*1;
					}
					
					return 0;
				},
				sectionedGetMinimumProductsNum: function(bundleKey, sectionId) {
					
					// check if any product can still be added to the mix and match bundle
					var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
					bundleId = parseInt(bundleId);
					
					var bundle = bndlr.getBundleById(bundleId);
					
					if (typeof bundle.sections[sectionId] === 'undefined') {
						return 0;
					}
					
					if (bundle.sections[sectionId].min_items === null) {
						return null;
					}

					return bundle.sections[sectionId].min_items;
				},
				sectionedGetNumOfSelectedProducts: function(bundleKey, sectionId) {
					var sections 		= Library.SectionedBundlesProductsSelected.get(bundleKey);
					var productsCount 	= 0;
					
					if (typeof sections[sectionId] !== 'undefined') {
						var products = sections[sectionId];
						for (var key in products) {
							if (products.hasOwnProperty(key)) {
								productsCount += products[key].quantity;
							}
						}
					}
					
					return productsCount;
				},
                sectionedGetSelectedProducts: function(bundleKey, sectionId) {
					var sections 		= Library.SectionedBundlesProductsSelected.get(bundleKey);
					
					if (typeof sections[sectionId] !== 'undefined') {
						var products = sections[sectionId];
                    }
					
					return products;
				},
				allRequirementsFulfilled(bundleKey, bundle) {
					var allRequirementsFulfilled = true;
					for (var i = 0; i<bundle.sections.length; i++) {
						// Show or hide add to bundle buttons
						if (this.sectionedRequirementsFulfilled(bundleKey, i) === false) {
							allRequirementsFulfilled = false;
							
							//this.sectionedSetRequirementsFulfilled(bundleKey, i, 'false');
						} else {
							/*
							if (allRequirementsFulfilled) {
								// Mark it as fulfilled only if also all other requirements were fulfilled
								this.sectionedSetRequirementsFulfilled(bundleKey, i, 'true');
							} else {
								this.sectionedSetRequirementsFulfilled(bundleKey, i, 'false');
							}*/
						}
					}
					
					return allRequirementsFulfilled;
				},
				sectionedMarkRequirementsFulfilled(bundleKey, bundle) {
					var allRequirementsFulfilled = true;
					// Go through each section, check if requirements are fulfilled and mark it as fulfilled
					for (var i = 0; i<bundle.sections.length; i++) {
						if (this.sectionedRequirementsFulfilled(bundleKey, i) === false) {							
							this.sectionedSetRequirementsFulfilled(bundleKey, i, 'false');
						} else {
							// Mark it as fulfilled only if also all other requirements were fulfilled
							this.sectionedSetRequirementsFulfilled(bundleKey, i, 'true');
						}
						
						// Move to next section automatically
												
					}
				},
				// Update total price, button, etc. in the mix and match bundle widget
				sectionedRefreshDisplay: function(bundleKey, skipMarkRequirementsFulfilled) {
					// Get bundle
					var htmlId = '#_bndl_'+bundleKey;
					var $element = $(htmlId);

					var bundleId = $element.closest('[data-bundle]').attr('data-bundle');
					bundleId = parseInt(bundleId);
					var bundle = bndlr.getBundleById(bundleId);
					
					for (var i = 0; i<bundle.sections.length; i++) {
						// Show or hide add to bundle buttons
						this.sectionedShowHideAddToBundleButtons(bundleKey, i);
					}
					
					/*
					var allRequirementsFulfilled = true;
					for (var i = 0; i<bundle.sections.length; i++) {
						// Show or hide add to bundle buttons
						if (this.sectionedRequirementsFulfilled(bundleKey, i) === false) {
							allRequirementsFulfilled = false;
							
							this.sectionedSetRequirementsFulfilled(bundleKey, i, 'false');
						} else {
							if (allRequirementsFulfilled) {
								// Mark it as fulfilled only if also all other requirements were fulfilled
								this.sectionedSetRequirementsFulfilled(bundleKey, i, 'true');
							} else {
								this.sectionedSetRequirementsFulfilled(bundleKey, i, 'false');
							}
						}
					}
					*/
					
					if (typeof skipMarkRequirementsFulfilled === 'undefined') {
						skipMarkRequirementsFulfilled = false;
					}
					
					if (skipMarkRequirementsFulfilled === false) {
						this.sectionedMarkRequirementsFulfilled(bundleKey, bundle);
					}
					
					var allRequirementsFulfilled = this.allRequirementsFulfilled(bundleKey, bundle);
					
					if (allRequirementsFulfilled) {
						// Show add to cart button
						this.sectionedFadeInAddToCartButton(bundleKey);
						
												
					} else {
						// Hide add to cart button
						this.sectionedFadeOutAddToCartButton(bundleKey);
					}
					
					
					//if (allRequirementsFulfilled) {
						// Recreate bundle and set the selected products in it so we can calculate the total price like we would normally do it
						var recreatedBundle = JSON.parse(JSON.stringify(bundle));

						var sections 					= Library.SectionedBundlesProductsSelected.get(bundleKey);
						var sectionsDiscountedProducts	= Library.SectionedBundlesProducts.get(bundleId);
						
						var recreatedSections = {};
						var recreatedProducts = {};

						for (var s in sections) {

							if (sections.hasOwnProperty(s)) {
								var section = sections[s];

								for (var key in section) {

									if (section.hasOwnProperty(key)) {
										
										var variantId 	= section[key].variant_id;
										var productId 	= section[key].product_id;
										var quantity 	= section[key].quantity;
										var product = {};

										product = sectionsDiscountedProducts[s][productId];

										var prd = JSON.parse(JSON.stringify(product));
										
										for (var i = 0; i<product.variants.length; i++) {
											if (product.variants[i].id == variantId) {
												var variant = JSON.parse(JSON.stringify(product.variants[i]));

												prd.quantity = quantity;
												prd.variants = [product.variants[i]];
												//prd.variants
											}
										}
										
										if (typeof recreatedSections[s] === 'undefined') {
											recreatedSections[s] = {};
										}
										
										recreatedSections[s][key] = prd;
										
										recreatedProducts[productId] = prd; // Add to the list of recreated products for subscription purposes.
									}
								}
							}
						}

						recreatedSections = bndlr.sectionedModifyProductsPrices(recreatedBundle, recreatedSections);

						//console.log('recreatedSections', recreatedSections);
						
						var totalPriceText = bndlr.sectionedGetTotalPriceText(recreatedBundle, recreatedSections);
						
						//console.log('totalPriceText', totalPriceText);
						
						$element.find('.bndlr-sectioned-total-price').html(totalPriceText);
						
					//}
					
					// Refresh the instructions text
					this.sectionedRefreshInstructionsText(bundleKey, bundle);
					
											var productHandlesList = utils.getListOfValues(recreatedProducts, 'handle');

						var originalHandles = $('.bundler-target-element [data-bndlr-key="'+bundleKey+'"] .sealsubs-target-element-bundle[data-product-handles]').attr('data-product-handles');

						$('.bundler-target-element [data-bndlr-key="'+bundleKey+'"] .sealsubs-target-element-bundle').attr('data-product-handles', productHandlesList);
					
						if (typeof window.SealSubs !== 'undefined' && typeof window.SealSubs.refresh === 'function') {
							/*var sealElement = $('.bundler-target-element [data-bndlr-key="'+bundleKey+'"] .sealsubs-target-element-bundle');
							if (sealElement.length > 0) {
								sealElement.find('.sealsubs-target-element').remove();
								sealElement.removeAttr('data-product');
								sealElement.removeAttr('data-seal-ac');
							}*/
							window.SealSubs.refresh();
						}
					
						if (productHandlesList !== originalHandles) {
							// Trigger hard refresh onyl if the list of handles isn't the same, as with hard refresh, we also remove the "one-time" purchase option if needed.
							if (typeof window.SealSubs !== 'undefined' && typeof window.SealSubs.hardRefresh === 'function') {
								window.SealSubs.hardRefresh();
							}
						}
										
				},
				sectionedShowHideAddToBundleButtons: function(bundleKey, sectionId) {
					if (bndlr.sectionedCanAddMoreProducts(bundleKey, sectionId) === false) {
						// Checks if there are already more products selected then they are allowed to be
						this.sectionedHideAddToBundleButtons(bundleKey, sectionId);
					} else {
						// there are less than max allowed products selected
						// Loop through products and check if any of them can't be selected anymore
						$('[data-bndlr-key="'+bundleKey+'"] [data-bundler-section="'+sectionId+'"].bndlr-sectioned-available-products .bndlr-product').each(function(key, el) {
							var productId = $(el).attr('data-product-id');
							if (bndlr.sectionedCanAddMoreProduct(bundleKey, productId, sectionId) === false) {
								
								bndlr.sectionedHideAddtoBundleButton(bundleKey, productId, sectionId);
								
							} else {
								
								bndlr.sectionedShowAddtoBundleButton(bundleKey, productId, sectionId);
								
							}
						});
					}
				},
				sectionedHideAddToBundleButtons(bundleKey, sectionId) {
					$('[data-bndlr-key="'+bundleKey+'"] [data-bundler-section="'+sectionId+'"]').find('.bndlr-add-to-sectioned-bundle').addClass('bndlr-hidden');
				},
				sectionedHideAddtoBundleButton: function(bundleKey, productId, sectionId) {
					$('[data-bndlr-key="'+bundleKey+'"] [data-bundler-section="'+sectionId+'"].bndlr-sectioned-available-products [data-product-id="'+productId+'"] .bndlr-add-to-sectioned-bundle').addClass('bndlr-hidden');
				},
				sectionedShowAddtoBundleButton: function(bundleKey, productId, sectionId) {
					$('[data-bndlr-key="'+bundleKey+'"] [data-bundler-section="'+sectionId+'"].bndlr-sectioned-available-products [data-product-id="'+productId+'"] .bndlr-add-to-sectioned-bundle').removeClass('bndlr-hidden');
				},
				sectionedFadeInAddToCartButton: function(bundleKey) {
					$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-sectioned-bundle-to-cart.bndlr-disabled').removeClass('bndlr-disabled');
					$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-sectioned-total-price.bndlr-hidden').removeClass('bndlr-hidden');
					$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-bundle-checkout-warning.bndlr-hidden').removeClass('bndlr-hidden');
					$('[data-bndlr-key="'+bundleKey+'"]').find('.sealsubs-target-element-bundle').css({'display':'block'});
				},
				sectionedFadeOutAddToCartButton: function(bundleKey) {
					$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-add-sectioned-bundle-to-cart').addClass('bndlr-disabled');
					$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-sectioned-total-price').addClass('bndlr-hidden');
					$('[data-bndlr-key="'+bundleKey+'"]').find('.bndlr-bundle-checkout-warning').addClass('bndlr-hidden');
					$('[data-bndlr-key="'+bundleKey+'"]').find('.sealsubs-target-element-bundle').css({'display':'none'});
				},
				sectionedSetRequirementsFulfilled: function(bundleKey, sectionId, fulfilled) {
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-status-container .bndlr-sectioned-section-status[data-bundler-section-status="' + sectionId + '"]').attr('data-requirements-fulfilled', fulfilled);
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sectioned-section[data-bundler-section="' + sectionId + '"]').attr('data-requirements-fulfilled', fulfilled);
				},
                sectionedRequiredSetRequirementsFulfilled: function(bundleKey, sectionId, fulfilled) {
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-status-container .bndlr-sectioned-section-status[data-bundler-section-status="' + sectionId + '"]').attr('data-required-products-fulfilled', fulfilled);
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sectioned-section[data-bundler-section="' + sectionId + '"]').attr('data-required-products-fulfilled', fulfilled);
				},
				sectionedCanAddMoreProduct(bundleKey, productId, sectionId) {
					// check if this product can still be added to the mix and match bundle
					var bundleId 	= $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
					bundleId 		= parseInt(bundleId);
					
					var bundle = bndlr.getBundleById(bundleId);

					var sections = Library.SectionedBundlesProductsSelected.get(bundleKey);
					
					if (typeof sections[sectionId] === 'undefined') {
						// This section doesn't yet have any product in it's selection, which means that all should be available for selection 
						return true;
					}
					
					if (typeof sectionId === 'undefined' || typeof bundle.sections[sectionId] === 'undefined') {
						return false;
					}
					
					var products = sections[sectionId];
					
					var allowedTotalProductQuantity = bundle.sections[sectionId].products[productId].quantity;
					
					for(var key in products) {
						if (products.hasOwnProperty(key)) {
							
							if (products[key].product_id == productId) {
								// Decrease the total allowed for this product by the current variant quantity.
								// This is so because you can have multiple quantities of the same product, but only allow N total items of this product across the variants.
								allowedTotalProductQuantity -= products[key].quantity;
								
								if (allowedTotalProductQuantity <= 0) {
									return false;
								}
							}
						}
					}
					
					if (allowedTotalProductQuantity > 0) {
						return true;
					} else {
						return false;
					}
				},
				sectionedCanAddMoreProducts: function(bundleKey, sectionId) {
					
					var remainingProductsCount = this.sectionedGetRemainingMaxProductsNum(bundleKey, sectionId);
					
					if (remainingProductsCount === null) {
						return true;
					}
					
					if (remainingProductsCount > 0) {
						return true;
					}
					
					return false;
				},
                // This function checks the required products with the current section
                // And returns true or false if required products are selected in to continue to next section
                sectionedCheckRequiredProducts: function (bundleKey, sectionId) {
					// Get all currently selected products
                    var getSelectedProducts     = this.sectionedGetSelectedProducts(bundleKey, sectionId);

                    var bundleId = $('[data-bndlr-key="'+bundleKey+'"]').closest('[data-bundle]').attr('data-bundle');
					bundleId = parseInt(bundleId);
					var bundle = bndlr.getBundleById(bundleId);

                    // This block of code makes sure that we only render bundle sections once they are 100% available.
                    // This function called multiple times even before bundle is loaded.
                    if(typeof bundle === 'undefined' || bundle === false) {
                        this.sectionedRequiredSetRequirementsFulfilled(bundleKey, sectionId, false)
                        return false;
                    }

                    for (let productId in bundle.sections[sectionId].products) {
                        let product = bundle.sections[sectionId].products[productId];
                        
                        if (product.required === 1) {
                            let isSelected = false;

                            // Check if the required product is in the selected products
                            for (let selectedProductId in getSelectedProducts) {
                                let selectedProduct = getSelectedProducts[selectedProductId];
                                
                                if (selectedProduct.product_id === product.id) {
                                    isSelected = true;
                                    break;
                                }
                            }

                            // If any required product is not selected, return false
                            if (isSelected === false) {
                                this.sectionedRequiredSetRequirementsFulfilled(bundleKey, sectionId, false)
                                return false;
                            }

                        } 
                    }

                    // If all required products are selected, return true
                    this.sectionedRequiredSetRequirementsFulfilled(bundleKey, sectionId, true)
                    return true;      

                },
				sectionedRequirementsFulfilled: function(bundleKey, sectionId) {
					
					var minimumProductsCount 	= this.sectionedGetMinimumProductsNum(bundleKey, sectionId);
					var selectedProductsCount 	= this.sectionedGetNumOfSelectedProducts(bundleKey, sectionId);
					
                    // These 2 conditions must be true in order to continue
                    var requiredItemsSelected   = this.sectionedCheckRequiredProducts(bundleKey, sectionId);
                    var productsCountConditionFulfilled = false;

										
					if (minimumProductsCount === null) {
						return false;
					}
					
					if (minimumProductsCount <= selectedProductsCount) {
						productsCountConditionFulfilled = true;
					}

                    // Both of these conditions must be fullfilled in order to continue
                    if (productsCountConditionFulfilled === true && requiredItemsSelected === true) {
                        return true;
                    }
					
					return false;
				},
				sectionedAddBundleToCart: function($this) {

					var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
					var $bundleContainer = $this.closest('[data-bndlr-key]');
					
					var sections = Library.SectionedBundlesProductsSelected.get(bundleKey);

					$this.addClass('bndlr-loading');

										var canContinue = true;
					
					
										
					
					if (canContinue) {
					
						var queueKey = 'sectionedaddtocart';

						var items = [];
						
						for (var sectionId in sections) {
							var products = sections[sectionId];
							for (var key in products) {
								if (products.hasOwnProperty(key)) {

									(function() {
									
										var variantId 	= products[key].variant_id;
										var quantity 	= products[key].quantity;									
										
										var $el = $bundleContainer.find('.bndlr-sections-status-container .bndlr-sectioned-section-status[data-bundler-section-status="'+sectionId+'"] .bndlr-sectioned-status-box-product[data-line-item-key="'+key+'"]').first();

										// Get all line item properties (mostly subscription props).
										var prodProperties = products[key].properties;
										var props = JSON.parse(JSON.stringify(prodProperties));
										
																					props['_bundle_section_'+sectionId] = '';
											props['_bundle_section_id'] = sectionId;
																				
										// Get all line item properties (mostly subscription props).
										var sellingPlan = bndlr.getSellingPlan($el);
							
										
										// Add item to the array so we can add them to the cart with one ajax call
										items.push({
											id			: variantId,
											quantity	: quantity,
											properties	: props,
											selling_plan: sellingPlan
										});
										
									})();
								}
							}
						}
						
						//console.log('items', items);
						bndlr.addItemsToCart(items, queueKey, bundleKey, $this);
						queue.process(queueKey);
					}
				},
				sectionedRefreshInstructionsText: function(bundleKey, bundle) {
					var content = this.sectionedGetInstructionsText(bundleKey, bundle);
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-status-container .bndlr-sectioned-instructions-text').html(content);
				},
				sectionedGetInstructionsText: function(bundleKey, bundle) {
					if (typeof bundleKey !== 'undefined' && typeof bundle !== 'undefined') {
						var allRequirementsFulfilled = this.allRequirementsFulfilled(bundleKey, bundle);
						
						if (allRequirementsFulfilled) {
							return '';
						}
					}
					
					var instructionsText = 'Add products from each section to enable the add to cart button.';
										
					return instructionsText;
				},

                sectionedRefreshRequiredInstructionsText: function(bundleKey, bundle) {
					var content = this.sectionedGetRequiredInstructionsText(bundleKey, bundle);
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-status-container .bndlr-sectioned-instructions-text').html(content);
				},

                sectionedGetRequiredInstructionsText: function(bundleKey, sectionId) {
                    
                    var requiredItemsSelected   = this.sectionedCheckRequiredProducts(bundleKey, sectionId);
                    var content = '';

                    if (requiredItemsSelected === false) {
                        content = 'Your bundle is missing the required product(s).';
                    }

                    return content;
                },

				
				getLineItemProperties: function($productEl) {
					var properties = {};
					
					try {
						$productEl.find('input[name^="properties"], select[name^="properties"]').each(function(i, prop) {
							var val 	= $(prop).val();
							var name 	= $(prop).attr('name').replace('properties[', '').replace(']', '');
							
							properties[name] = val;
						});
					} catch(e) {
						bundlerConsole.log(e);
					}
					
					var productId = $productEl.attr('data-product-id');
					
					$bundleContainer = $productEl.closest('[data-bndlr-key]');
					try {
						// Get line item properties from the whole bundle
						var $subsEl = $bundleContainer.find('.sealsubs-target-element-bundle').first();
						
						$subsEl.find('input[name^="properties"]').each(function(i, prop) {
							var val = $(prop).val();
							var name = $(prop).attr('name').replace('properties[', '').replace(']', '');
							
							properties[name] = val;
						});
						
						if (typeof productId !== 'undefined') {
							// Handle special case for seal subscriptions, where each product has it's own discount hash
							$subsEl.find('input[name^="'+productId+'_properties"]').each(function(i, prop) {
								var val = $(prop).val();
								var name = $(prop).attr('name').replace(productId+'_properties[', '').replace(']', '');
								
								properties[name] = val;
							});	
						}
					} catch(e) {
						bundlerConsole.log(e);
					}
					
					
				
					var $bundleWidget = $productEl.closest('[data-bundle]');
					
					if ($bundleWidget.length > 0) {

						var bundleId = $bundleWidget.attr('data-bundle');
						
						var bundle = this.getBundleById(bundleId);
						
						var bundleVersion = 1;
						
						if (typeof bundle.version === 'number') {
							bundleVersion = bundle.version;
						}
						
						var addLineItemProperties = false;
						
												
						if (addLineItemProperties === true || bundleVersion === 2) {
						
							properties['_bundler_id'] = bundleId;
							
														
														
													}
					}
					
										
					return properties;
				},
				getSellingPlan: function($productEl) {
					var sellingPlan = '';
					
					try {
						sellingPlan = $productEl.find('input[name^="selling_plan"]').val();
					} catch(e) {
						bundlerConsole.log(e);
					}
					
					return sellingPlan;
				},
				productsToString: function(products) {
					// Transforms products object to a string r-p-product_id-variant_id=quantity&...
					var productsString = '';
					for(var key in products) {
						if (products.hasOwnProperty(key)) {
							var prefix = '';
							if (products[key].required) {
								prefix = 'r-';
							}
							productsString += prefix+'p-'+products[key].product_id+'-'+products[key].variant_id+'='+products[key].quantity+'&';
						}
					}
					
					return productsString;
					
				},
				addToCart: function($this) {					
					// Adds bundle products to the cart
					
					if (typeof clientSpecifics['add_to_cart_control'] !== 'undefined') {
						var canContinue = clientSpecifics['add_to_cart_control'].trigger($this.closest('.bundler-target-element'));
					} else {
						var canContinue = true;
					}
					
										
					if (!canContinue) {
						// Stop here and return, as the client specific logic already handled it
						return false;
					}
					
											if ($this.attr('data-active') === 'false') {
							bundlerConsole.log('One or more products in the bundle are unavailable.');
							return true;
						}
										
					var bundleKey = $this.closest('[data-bndlr-key]').attr('data-bndlr-key');
					
					$this.addClass('bndlr-loading');
					
					var queueKey = 'addtocart';
					

					var properties = {};
					
										
					
					var allProductsAreAvailable = true;

					var items = [];
					
					
					// Get preselected required products from the promotion popup
					var cartItems = [];
					try {
						if ($this.closest('[data-cart-items]').length > 0) {
							cartItems = JSON.parse($this.closest('[data-cart-items]').attr('data-cart-items'));
						}
					} catch(e) {
						console.error(e);
					}
					
					// Get preselected rpoducts from the promotion popup
					var preselectedProducts = [];
					try {
						if ($this.closest('[data-bdnlr-preselected-products]').length > 0) {
							preselectedProducts = JSON.parse($this.closest('[data-bdnlr-preselected-products]').attr('data-bdnlr-preselected-products'));
						}
					} catch(e) {
						console.error(e);
					}
					// Get preselected required products from the promotion popup
					var preselectedProductsRequired = [];
					try {
						if ($this.closest('[data-bdnlr-preselected-products-required]').length > 0) {
							preselectedProductsRequired = JSON.parse($this.closest('[data-bdnlr-preselected-products-required]').attr('data-bdnlr-preselected-products-required'));
						}
					} catch(e) {
						console.error(e);
					}


                    var itemsToUpdateProperty = []; // This contains an array of items which have to be updated if we only apply discounts on items which were added to the cart from the bundle 
					var itemsToUpdateSellingPlan = []; // This array contains items on which we have to update the selling plan property

					$this.closest('.bndlr-container').find('.bndlr-product').each(function(key, el) {
						
						var $el = $(el);
						
												
						// Get all line item properties (mostly subscription props).
						var prodProperties = bndlr.getLineItemProperties($el);
						
						// Add other predefined properties
						for(var k in properties) {
							if (properties.hasOwnProperty(k)) {
								prodProperties[k] = properties[k];
							}
						}
						
						// Get all line item properties (mostly subscription props).
						var sellingPlan = bndlr.getSellingPlan($el);
						
						var variantId 	= $(el).find('select.bndlr-select-variant[name="variant_id"] option:selected').val();
						var quantity 	= $(el).attr('data-quantity');

						
						// Check if this product is already in the cart and we don't have to add it again
						if ($(el).attr('data-required') === 'false') {
							//var productId = $(el).attr('data-product-id');
							if (preselectedProducts.length > 0) {
								for (var j = 0; j<preselectedProducts.length; j++) {
									
									//if (preselectedProducts[j].product_id == productId && preselectedProducts[j].variant_id == variantId) {
									if (preselectedProducts[j].variant_id == variantId) {
										if (preselectedProducts[j].quantity == quantity) {

                                            itemsToUpdateProperty.push(JSON.parse(JSON.stringify(preselectedProducts[j])));
											
											var preSelectedItem = JSON.parse(JSON.stringify(preselectedProducts[j]));
											preSelectedItem.selling_plan = sellingPlan
                                            itemsToUpdateSellingPlan.push(preSelectedItem);

											// Skip this product, as it is already in the cart
											return;
										}
									}									
								}
							}
						} else if ($(el).attr('data-required') === 'true') {
							//var productId = $(el).attr('data-product-id');
							if (preselectedProductsRequired.length > 0) {
								for (var j = 0; j<preselectedProductsRequired.length; j++) {
									
									//if (preselectedProductsRequired[j].product_id == productId && preselectedProductsRequired[j].variant_id == variantId) {
									if (preselectedProductsRequired[j].variant_id == variantId) {
										if (preselectedProductsRequired[j].quantity == quantity) {
											// Skip this product, as it is already in the cart
											return;
										}
									}									
								}
							}
						}
						
						// loop through cart items which were passed from the promotion and use any of the products there to just increase the quantity
						// to keep the line item properties
						for (var k = 0; k<cartItems.length; k++) {
							if (cartItems[k].quantity > 0 && cartItems[k].quantity < quantity && cartItems[k].variant_id == variantId) {
								
								quantity = quantity - cartItems[k].quantity;
								cartItems[k].quantity = 0;
								
								if (Object.keys(prodProperties).length === 0 && cartItems[k].properties !== null && Object.keys(cartItems[k].properties).length > 0) {
									// If the item from the bundle doesn't have any properties and the one in the cart has, add properties to the new item from the item which is already in the cart
									prodProperties = JSON.parse(JSON.stringify(cartItems[k].properties));
								}
							}
						}

						if (typeof variantId === 'undefined') {
							
																							
								// It looks like the variant selector is without any options. Display error message.
								var productTitle = $(el).find('.bndlr-product-title').first().text();
								// Show warning/error message. It has to be sent in the correct format (HTTP response).
								bndlr.showWarningMessage({
									responseJSON: {
										description: 'Product: '+productTitle+' is not available.'
									}
								}, bundleKey);
								allProductsAreAvailable = false;
								
													} else {
						
							var props = JSON.parse(JSON.stringify(prodProperties));
							
							// Add item to the array so we can add them to the cart with one ajax call
							items.push({
								id			: variantId,
								quantity	: quantity,
								properties	: props,
								selling_plan: sellingPlan
							});
						}
					});


                    // Update line item properties of existing items so that we will still apply bundle discounts even if the merchant is restricting them only to the 
					// products which were added to the cart from the bundle widget.
										
					if (itemsToUpdateSellingPlan.length > 0) {
						bndlr.updateSellingPlan(itemsToUpdateSellingPlan, queueKey, bundleKey, $this);
					}


					bndlr.addItemsToCart(items, queueKey, bundleKey, $this);
										
					if (allProductsAreAvailable) {
						// Process queue only if all products were available (not even 1 was missing a variant selector.
						queue.process(queueKey);
					} else {
						// Cancel the queue as one or more products were unavailable
						queue.cancel(queueKey);
					}
				},
                updateLineItemProperties: function(items, queueKey, bundleKey, $this) {
					
					for(var g = 0; g<items.length; g++) {
						
						var rootUrl = nav.getRootUrl(true);
						var url = rootUrl+'cart/change.js?bundler-cart-call';
				
						var $product = $this.closest('[data-bundle]').find('[data-product-id="' + items[g].product_id + '"]');
				
						var properties = bndlr.getLineItemProperties($product);
				
						var data = {
							line		: items[g].cart_line,
							properties	: properties
						}

						queue.add(queueKey, function() {

							$.ajax({
								url		: url,
								data	: JSON.parse(JSON.stringify(data)),
								type	: 'POST',
								dataType: 'json'
								
							}).then(function() {
								
								setTimeout(function() {
									// Add a delay before we tick queue so that shopify gets itself back together. (The cart cookie seems to get messed up after this update).
									queue.tick(queueKey);
								}, 1000);
							});

						});
					}
				},
				updateSellingPlan: function(items, queueKey, bundleKey, $this) {
					
					for(var g = 0; g<items.length; g++) {
						
						var rootUrl = nav.getRootUrl(true);
						var url = rootUrl+'cart/change.js?bundler-cart-call';
				
						var sellingPlan = null;
						if (typeof items[g].selling_plan !== 'undefined' && items[g].selling_plan !== '') {
							sellingPlan = items[g].selling_plan
						}
				
						var data = {
							line			: items[g].cart_line,
							selling_plan	: sellingPlan
						}

						queue.add(queueKey, function() {

							$.ajax({
								url		: url,
								data	: JSON.parse(JSON.stringify(data)),
								type	: 'POST',
								dataType: 'json'
								
							}).then(function() {
								
								setTimeout(function() {
									// Add a delay before we tick queue so that shopify gets itself back together. (The cart cookie seems to get messed up after this update).
									queue.tick(queueKey);
								}, 1000);
							});

						});
					}
				},
				addItemsToCart: function(items, queueKey, bundleKey, $this, $outOfWidgetButton) {
					
					
										
					
					var successFunction = function() {
												
						if ($this.closest('.bundler-target-element[data-bdnlr-preselected-products]').length > 0) {
							
							$('.bndlr-add-to-cart').removeClass('bndlr-loading');
							widgetView.addToCartButton.showCheckmark($this);
							//bndlr.afterAddToCartAction();
							// Trigger event which lets the promo part of the app know that the bundle was added to the cart
							$(document).trigger('bndlr:bundle_added_to_cart');
							
							// Trigger bndlr:bundle_added_to_cart so any other scripts can listen on it
							document.dispatchEvent(new CustomEvent('bndlr:bundle_added_to_cart'));
							
							$('body').trigger('added.ajaxProduct');
							cart.updateCart();
							
						} else {
							
							try {
								setTimeout(function () {
									// Set a timeout to remove the loading spinner in case the customer comes back in Chrome
									$this.removeClass('bndlr-loading');
									if (typeof $outOfWidgetButton !== 'undefined') {
										$outOfWidgetButton.removeClass('bndlr-loading');
									}
								}, 5000);
							} catch(e) {}
							
														
								
								//bndlr.prepareInvoice(false);
								
																	bndlr.prepareInvoice(false);
																
								
													}
					}
					
					queue.add(queueKey, function() {
						cart.addMultipleItemsToCart(nav.getRootUrl(true), items).done(function(response) {
							
							queue.tick(queueKey);
							for (var n = 0; n < items.length; n++) {
															
								try {
									var productId = 0;
									var variantId = items[n].id;
									// Get product id from the response, as we can't get it otherwise
									for(var m = 0; m<response.items.length; m++) {
										if (response.items[m].variant_id == variantId) {
											productId = response.items[m].product_id;
											break;
										}
									}
									//console.log('addtocart', productId, variantId, items[n].quantity);
									BndlrAnalytics.track('addtocart', productId, variantId, items[n].quantity);
								} catch(e) {
									bundlerConsole.log(e);
								}
							}
							
							
						}).fail(function(r) {
							// Todo handle case where product is not in stock and can't be added to the cart.
							$this.removeClass('bndlr-loading');
							if (typeof $outOfWidgetButton !== 'undefined') {
								$outOfWidgetButton.removeClass('bndlr-loading');
							}
							
							bndlr.showWarningMessage(r, bundleKey);
							queue.cancel(queueKey);
							
													});
					}, successFunction);

				},
				afterAddToCartAction: function() {
										// Impulse theme
					$('body').trigger('added.ajaxProduct');
					
															// End of Impulse theme

					cart.updateCart();
					
					try {
						if ($('.sticky-cart-button').length === 1) {
							document.querySelector('.sticky-cart-button').click();
						}
					} catch(e) {}
					

					if ($('#sidebar-cart').length > 0 ||
						$('#slidecarthq').length > 0 || 
						$('form.cart-drawer').length > 0 || 
						$('#cart-popup').length > 0 || 
						$('#mini-cart').length > 0) {

						// This theme has a sidebar cart 
						// Delay price update so the drawer can get updated
						setTimeout(function() {
							DiscountEstimator.showPopup();
						}, 1000);
					} else {
						DiscountEstimator.showPopup();
					}
				},
				closeMessage: function() {
					
											$('#bndlr-discount-message').animate({bottom: '-100%'}, 1000);
									},
				setCookie: function(cname, cvalue, exdays) {
					var d = new Date();
					if (exdays > 0) {
						d.setTime(d.getTime() + (exdays*24*60*60*1000));
						var expires = "expires="+ d.toUTCString();
						document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
					} else {
						document.cookie = cname + "=" + cvalue + ";path=/";
					}					
				},
				getCookie: function(cname) {
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
				},
				showWarningMessage: function(response, bundleKey) {

					this.stopAddtcAnimation(bundleKey);
					var c = 'This product was not added to cart.';
					c = 'undefined' == typeof response.responseJSON ? $.parseJSON(response.responseText).description : response.responseJSON.description;
					
					if (c === 'Cannot find variant') {
						c = 'The variant of one of the products can\'t be found. Shop owner can try to remove and add the product back to the bundle configuration to resolve this issue and make sure that the product is available in the online shop.';
					}
					
					var warningHtml = '<div class="bndlr-warning" style="display:none">' + c + '</div>';
					
					var warningHtmlDisplay = '<div class="bndlr-warning">' + c + '</div>';
					
					$.each($('[data-bndlr-key="'+bundleKey+'"] .bndlr-warning'), function (d, e) {
						$(e).remove()
					});
					
					var timeout = 4000;
					if (c.length > 50) {
						timeout = Math.floor(c.length/50)*4000; // Will show the error message for 4 seconds for every 50 letters in the message.
					}
					
					var $sectionedTargetElement = $('[data-bndlr-key="'+bundleKey+'"] .bndlr-sections-status-container .bndlr-warning-container');
					if ($sectionedTargetElement.length === 1) {
						$sectionedTargetElement.html(warningHtmlDisplay);
						
						$sectionedTargetElement.fadeIn(500, function () {
							setTimeout(function () {
								$sectionedTargetElement.fadeOut(500);
							}, timeout)
						})
						
					} else {
						// Fallback to the default functionality
					
						$('[data-bndlr-key="'+bundleKey+'"] .bndlr-products-container').first().append($(warningHtml)),
						$('[data-bndlr-key="'+bundleKey+'"] .bndlr-warning').fadeIn(500, function () {
							setTimeout(function () {
								$('[data-bndlr-key="'+bundleKey+'"] .bndlr-products-container').children('.bndlr-warning').first().fadeOut(500)
							}, timeout)
						})
					}
				},
				stopAddtcAnimation: function(bundleKey) {
					$('[data-bndlr-key="'+bundleKey+'"] .bndlr-add-to-cart').removeClass('bndlr-loading');
				}
			};
			
			var DiscountEstimator = {
	showPopup: function() {
		if (nav.isShopPage()) {						
			this.calculateDiscounts();
			
						
					}
	},
	updateCartDiscountsTimeout: false,
	updateCartDiscounts: function() {
		if (this.updateCartDiscountsTimeout !== false) {
			clearTimeout(this.updateCartDiscountsTimeout);
		}
		
		this.updateCartDiscountsTimeout = setTimeout(function() {
			DiscountEstimator.calculateDiscounts(false);
		}, 410);
	},
		automaticDiscountIsBiggerThanBundlerDiscount: function(cartData) {
		if (typeof cartData.total_discount !== 'undefined' && cartData.total_discount*1 > 0) {
			var discountAmount = DiscountEstimator.calculateDiscount(cartData);
			
			if (discountAmount.total_discount_value < cartData.total_discount*1) {
				return true;
			}
			
		}
		
		return false;
	},
	calculateDiscounts: function(showPopup) {
		
		if (typeof showPopup === 'undefined') {
			showPopup = true;
		}
		
					var self = this;
			
			var cartEndpoint = 'default';
						
			cart.get(cartEndpoint).done(function(cartData) {
				
				
				var updatedCart = self.updateCartWithDiscounts(cartData);
				
				

				let applicableBundles = bundles;
				let applicableCombos  = updatedCart.applicable_combos;
				
				// If there are only bundles V2 in the cart, we can simply just get the total_amount_discounted directly from the cart,
				// since the function calculates that automatically. We can then use this value to display correct discounted value
				if (self.checkForBundleVersionAll(applicableBundles, applicableCombos, 2)) {
					updatedCart.total_amount_discounted = cartData.total_price;
					var newDiscountedValue = updatedCart.total_amount_original - cartData.total_price; 
					
					if (newDiscountedValue > 0) {
						updatedCart.discount_value = newDiscountedValue;
					}
				}

				// Trigger event
				// vittoriacoffee
				try {
					var event = new CustomEvent("bundler:total_cart_values", {
						detail: updatedCart
					});
					document.dispatchEvent(event);
				} catch(e) {
					console.log(e);
					//bundlerConsole.log(e);
				}
				
				var totalCompareAtValue 		= updatedCart.total_amount_original;
				var discountedTotal 			= updatedCart.total_amount_discounted;
				var cartDiscounted 				= updatedCart.discounted_cart_object;
				var discountValue 				= updatedCart.discount_value;
				var canGetFreeShippingDiscount 	= updatedCart.can_get_free_shipping_discount;
				
					
				if (showPopup === true) {
											
													
							if (bndlr.getCookie('bndlr_hide_discount_message') !== 'hide') {
								self.displayCartValue(discountValue, cartData, canGetFreeShippingDiscount);
							}
							
															}
				
								
			});
			},
	updateCartWithDiscounts: function(cartData) {
						
			if (this.containsSellingPlan(cartData)) {
				
				  

												}
		
				
		if (typeof cartData.items !== 'undefined' && cartData.items.length > 0) {
			// Used in themaatchaland to display discounts in each line
			for (var d = 0; d<cartData.items.length; d++) {
				if (typeof cartData.items[d].original_line_item_id === 'undefined') {
					cartData.items[d].original_line_item_id = d;
				}
			}
		}
		
		var cartDiscounted 				= JSON.parse(JSON.stringify(cartData));
		
		var returnObject 				= this.calculateDiscount(cartData, cartDiscounted);

		var discountValue 				= returnObject.total_discount_value;
		var applicableCombos			= returnObject.applicable_combos;
		var applicableBundles			= returnObject.applicable_bundles;

		
		var canGetFreeShippingDiscount 	= this.canGetFreeShippingDiscount(cartData);
		
		  
			if (discountValue > 0 && this.containsSellingPlan(cartData)) {
				// You can't get the free shipping discount if we are applying the discount with discount codes and the other discount value is bigger than 0
				// and the cart contains selling plan
				canGetFreeShippingDiscount = false;
			}
				
				
		// vittoriacoffee
		if (discountValue <= 0) {
			discountValue = 0;
		}
		
		var discountValueForEvent = discountValue;

		var discountedTotal 	= cartData.original_total_price - discountValue;
		var totalCompareAtValue	= cartData.original_total_price;
		
		cartDiscounted.total_discount 	= discountValue;
		cartDiscounted.total_price 		= discountedTotal;
		
		
		// Check if cdo.php has to apply a discount via draft orders. This should only happen if we have at least one legacy bundle or if we have a selling plan
		var hasToApply = this.checkForLegacyBundlesAndSellingPlan(cartData, applicableBundles, applicableCombos);

		var updatedCart = {
			discount_value					: discountValue,
			total_amount_original			: totalCompareAtValue,
			total_amount_discounted			: discountedTotal,
			discount_amount					: (discountValueForEvent > 0 ? discountValueForEvent : 0),
			original_cart_object			: JSON.parse(JSON.stringify(cartData)),
			discounted_cart_object			: JSON.parse(JSON.stringify(cartDiscounted)), // thematchaland is using this
			can_get_free_shipping_discount	: canGetFreeShippingDiscount,
			has_to_apply_legacy_discounts 	: hasToApply,
			applicable_combos				: applicableCombos
		};
		
		return updatedCart;
	},
			containsSellingPlan: function(cartData) {

			if (typeof cartData.items !== 'undefined') {
				for(var i = 0; i<cartData.items.length; i++) {
					if (cartData.items[i].hasOwnProperty('selling_plan_allocation')) {
						return true;
					}
				}
			}
			
			return false;
		},
		setSellingPlanMultipliers: function(cartData) {
			if (typeof cartData.items !== 'undefined') {
				for(var i = 0; i<cartData.items.length; i++) {
					var multiplier = 1;
					if (cartData.items[i].hasOwnProperty('selling_plan_allocation') && 
						cartData.items[i].selling_plan_allocation.hasOwnProperty('price') &&
						cartData.items[i].selling_plan_allocation.hasOwnProperty('per_delivery_price') &&
						cartData.items[i].selling_plan_allocation.price !== cartData.items[i].selling_plan_allocation.per_delivery_price
						) {
							
							multiplier = cartData.items[i].selling_plan_allocation.price/cartData.items[i].selling_plan_allocation.per_delivery_price;
							
					}
					
					cartData.items[i].multiplier = multiplier;
				}
			}
			
			return cartData;
		},
		reducePricesAccordingToMultiplier: function(cartData) {
			
			if (typeof cartData.items !== 'undefined') {
				for(var i = 0; i<cartData.items.length; i++) {
					var multiplier = 1;
					if (typeof cartData.items[i].multiplier === 'number') {
						var multiplier = cartData.items[i].multiplier;
							
						if (multiplier > 1) {
							var price = cartData.items[i].price;
							price = price/multiplier;
							
							cartData.items[i].price = price;
						}
					}
				}
			}
			
			return cartData;
		},
		addMultipliers: function(applicableCombos, cartData) {
			
			for(var i = 0; i<applicableCombos.length; i++) {
				for(var pkey in applicableCombos[i]) {
					if (applicableCombos[i].hasOwnProperty(pkey)) {
						var product = applicableCombos[i][pkey];
						var lineItemId = product.line_item_id;
						
						if (typeof cartData.items[lineItemId] !== 'undefined' && typeof cartData.items[lineItemId].multiplier === 'number') {
							var multiplier = cartData.items[lineItemId].multiplier;
							
							applicableCombos[i][pkey].multiplier = multiplier
						}
					}
				}
			}
			
			return applicableCombos;
		},
		getMultiplier: function(applicableCombo) {
		var multiplier = 1;
		if (typeof applicableCombo.multiplier === 'number') {
			multiplier = applicableCombo.multiplier;
		}
		
		return multiplier;
	},
	canGetFreeShippingDiscount: function(cartData) {
		var isEligibleForFreeShippingDiscount = false;
		
				
		return isEligibleForFreeShippingDiscount;
	},
	removeBundledItemsFromCart: function(cartItems) {					
		// For all bundles
		for (var k = 0; k < bundles.length; k++) {
			// Prepare all applicable combos for this bundle and remove the quantity for these products from the cart.
			// We don't actually need the combos variable. We just want to reduce the quantity of items from the cart (by reference).
			var combos = this.getApplicableCombosForBundle(cartItems, bundles[k]);
		}
		
		// No need to actually return anything because we reduce quantity by reference, but we are returning here just for the sake of simplicity and easier understanding of the code
		return cartItems;
	},
	
	removeBundledItemsFromCartForScopedBundles: function(cartItems, scopedBundles) {					
		// For scoped bundles
		for (var k = 0; k < scopedBundles.length; k++) {
			// Prepare all applicable combos for this bundle and remove the quantity for these products from the cart.
			// We don't actually need the combos variable. We just want to reduce the quantity of items from the cart (by reference).
			var combos = this.getApplicableCombosForBundle(cartItems, scopedBundles[k]);
		}
		
		// No need to actually return anything because we reduce quantity by reference, but we are returning here just for the sake of simplicity and easier understanding of the code
		return cartItems;
	},
	// Merges the cart cata and groups the items based on line item properties. This is used in calculateDiscountMergedCart so that we work with the same cart as
	// product-discount function
	mergeCartData: function(cartData) {
		const mergedItemsMap = new Map();

		//for (const item of cartData.items) {
		for (var k in cartData.items) {
			if (cartData.items.hasOwnProperty(k)) {
				
				var item = cartData.items[k];
				
				// Create a unique key for merging based on variant_id and properties
				const uniqueKey = `${item.variant_id}:${JSON.stringify(item.properties || {})}`;
		
				if (mergedItemsMap.has(uniqueKey)) {
					// Merge item data with an existing entry
					const existingItem = mergedItemsMap.get(uniqueKey);
					existingItem.quantity 			+= item.quantity;
					existingItem.line_price 		+= item.line_price;
					existingItem.final_line_price 	+= item.final_line_price;
					existingItem.total_discount 	+= item.total_discount;
		
					// Merge discounts
					for (const discount of item.discounts || []) {
						const existingDiscount = existingItem.discounts.find(d => d.title === discount.title);
						if (existingDiscount) {
							existingDiscount.amount += discount.amount;
						} else {
							existingItem.discounts.push(discount);
						}
					}
		
					// Update line-level discount allocations
					for (const allocation of item.line_level_discount_allocations || []) {
						const existingAllocation = existingItem.line_level_discount_allocations.find(
							a => a.discount_application.key === allocation.discount_application.key
						);
						if (existingAllocation) {
							existingAllocation.amount += allocation.amount;
						} else {
							existingItem.line_level_discount_allocations.push(allocation);
						}
					}
				} else {
					// Add the item to the map
					mergedItemsMap.set(uniqueKey, { ...item });
				}
				
				existingItem = mergedItemsMap.get(uniqueKey);
				if (typeof existingItem.orig_line_item_id === 'undefined') {
					existingItem.orig_line_item_id = (k*1)+1;
				}
			}
		}
	
		// Convert the merged items map back to an array
		cartData.items = Array.from(mergedItemsMap.values());
		
		/*
		var lineItemId = 1;
		for (var k in cartData.items) {
			if (cartData.items.hasOwnProperty(k)) {
				cartData.items[k].orig_line_item_id = lineItemId;
				lineItemId++;
			}
		}*/
	
		return cartData;
	},
	calculateDiscount: function(cartDataVar, cartDataReference, withMergedCart) {
		// The cartDataReference can contain the original cart and the function will reduce item prices (line_price) to the discounted line price
		// Deep copy the cart data
		if (typeof withMergedCart === 'undefined') {
			withMergedCart = false;
		}
		
		var cartData = JSON.parse(JSON.stringify(cartDataVar));
		
		if (withMergedCart === true) {
			cartData = this.mergeCartData(cartData);
		}
		
		cartData.items = cartData.items.sort(function(a, b) {
			return a.quantity - b.quantity;
		});
		
		if (typeof cartDataReference !== 'undefined' && typeof cartDataReference.items !== 'undefined') {			
			cartDataReference.items = cartDataReference.items.sort(function(a, b) {
				return a.quantity - b.quantity;
			});
		}
		
		
					// Change the price of the item if there is a pre-paid selling plan
			cartData = this.setSellingPlanMultipliers(cartData);
						
			cartData = this.reducePricesAccordingToMultiplier(cartData);
				
		var $applicableBundles 	= this.getApplicableBundles(cartData);

		var applicableCombosObject = this.getApplicableCombosAll(cartData, $applicableBundles, true);

		var applicableCombos 				= applicableCombosObject.applicableCombos;
		var cartDataWithReducedQuantities 	= applicableCombosObject.cartWithReducedQuantities;
		
		if (withMergedCart === true) {
					}

		//var applicableCombos 	= this.getApplicableCombosAll(cartData, $applicableBundles, true);

					// Add multipliers for pre-paid subscriptions
			applicableCombos = this.addMultipliers(applicableCombos, cartData);
		
		var nonlegacyBundlesActive = false;
		if (withMergedCart === false) {
			// Check if we have active legacy bundles. We get the applciable combos and find if a corresponding bundle ID from the combos matches any of the bundles in 
			// applicable bundles and if it has version 2. We need to check this due to the setting 'allow_automatic_discounts_on_draft_orders', since the discount estimator shows
			// wrong price in the cart
			nonlegacyBundlesActive = this.checkForBundleVersion($applicableBundles, applicableCombos, 2);
		}

		// bundlerConsole.log(JSON.parse(JSON.stringify($applicableBundles)));
		// bundlerConsole.log(JSON.parse(JSON.stringify(applicableCombos)));
		
		
		// Calculate discounts for each applicable item
		var totalDiscountValue = 0;
		var appliedCombos = {};

		for (var i = 0; i < applicableCombos.length; i++) {

			var $bundle = null;
			var originalAmount = 0;
			
			var totalBundleDiscountAmount = 0;
			
			// Fix for discount code discount application
			var totalDiscountedAmount = 0;
			var discountPercent = 0;
			
			for (var productId in applicableCombos[i]) {
				if (typeof appliedCombos[i] == 'undefined') {
					
					if (applicableCombos[i].hasOwnProperty(productId)) {
						
						var initialDiscountAmount = totalDiscountValue;
					
						var item = applicableCombos[i][productId];

						if ($bundle === null) {
							for (var k = 0; k < $applicableBundles.length; k++) {
								if ($applicableBundles[k].id == item.bundle_id) {
									$bundle = $applicableBundles[k];
									// break loop
									k = $applicableBundles.length;
								}
							}
							
							originalAmount = this.getTotalOriginalAmount(applicableCombos[i])/100;
						}
						
						var discountType 	= $bundle.discount_type;
						var volumeDiscount = [];
						if (typeof item.volume_discount !== 'undefined') {
							discountType 	= item.volume_discount.discount_type;
							volumeDiscount 	= item.volume_discount;
							
							// Simulate the bundle discount for this volume discount
							$bundle.discount_type 		= item.volume_discount.discount_type;
							$bundle.percentage_value 	= item.volume_discount.discount_value;
							$bundle.fixed_amount_value 	= item.volume_discount.discount_value;
							$bundle.fixed_price_value 	= item.volume_discount.discount_value;
						}
					
						var itemDiscountAmount = 0;
						
						if (item.type === 'discounted') {
							if (discountType === 'fixed_amount') {
								
								// Apply max bundle price or normal discount amount
								var maxAmount = originalAmount;
								
								var ratio = (item.price/100 * item.quantity)/originalAmount;
								itemDiscountAmount = ratio*(1*$bundle.fixed_amount_value);

								var discountPerItem = Math.round(itemDiscountAmount/item.quantity*100)/100;
								itemDiscountAmount = discountPerItem*item.quantity;
								
								if (itemDiscountAmount < 0) {
									itemDiscountAmount = 0;
								}
								
								// Check if we have to reduce the discount amount because of rounding
								if ((totalBundleDiscountAmount + itemDiscountAmount) > (1*$bundle.fixed_amount_value)) {
									itemDiscountAmount = (1*$bundle.fixed_amount_value) - totalBundleDiscountAmount;
								}
								
								totalBundleDiscountAmount += itemDiscountAmount;
								
							} else if (discountType === 'fixed_price') {

								var ratio = 1 - (1*$bundle.fixed_price_value)/originalAmount;
								itemDiscountAmount = item.price/100 * item.quantity * ratio;
								var maxDiscount = originalAmount - (1*$bundle.fixed_price_value);
								
								if (itemDiscountAmount < 0) {
									itemDiscountAmount = 0;
								}
								
								if ((totalBundleDiscountAmount + itemDiscountAmount) > maxDiscount) {
									itemDiscountAmount = maxDiscount - totalBundleDiscountAmount;
								}
								
								totalBundleDiscountAmount += itemDiscountAmount;
								
							} else if (discountType === 'percentage') {
								/*
								if (typeof this.containsSellingPlan === 'function' && this.containsSellingPlan(cartData)) {
									// Don't round on item level, as we will apply the discount with discount codes, where the discount doesn't get rounded on item level, but on the cart line level.
									// itemDiscountAmount = (($bundle.percentage_value/100) * item.price * item.quantity) / 100;
									itemDiscountAmount = (Math.round(($bundle.percentage_value/100) * item.price) * item.quantity) / 100;
									
									
									// Fix for discount code discount application
									// It appears tha applying discount with discount codes is quite inconsistent
								
									//totalDiscountedAmount 	+= item.price * item.quantity;
									//discountPercent 		= $bundle.percentage_value/100;
									//itemDiscountAmount 		= 0;
									
									
								} else {
									*/
									// 2020-07-20 round on product level and then multiply by quantity, otherwise the discount might be different from the actually applied discount
									// e.g. 4 mugs ($12.5 each), 50.1% discount. discount per mug is $6.2625, which gets rounded to $6.26x4 = 25.04. But if you multiply by 4 first, then the total
									// discount will be $25.05 <- 1 cent difference
									itemDiscountAmount = (Math.round(($bundle.percentage_value/100) * item.price) * item.quantity) / 100;

																		
																	/*}*/
								
							}  else if (discountType === 'products_discounts') {

								var productId = item.product_id;
								var variantId = item.variant_id;
								
								if ($bundle.minimum_requirements === 'sectioned_n_products') {
									if (typeof $bundle.sections[item.section_id].products[productId].variants[variantId].discount_amount !== 'undefined') {
										var discountAmount = $bundle.sections[item.section_id].products[productId].variants[variantId].discount_amount*1;
										var itemPrice = item.price*item.quantity/100;

										discountAmount = discountAmount*item.quantity;

										if (itemPrice - discountAmount >= 0) {
											itemDiscountAmount = discountAmount;
										} else {
											// Item price is lower than the discount
											itemDiscountAmount = itemPrice;
										}
									}
								} else {
									if (typeof $bundle.products[productId].variants[variantId].discount_amount !== 'undefined') {
										var discountAmount = $bundle.products[productId].variants[variantId].discount_amount*1;
										var itemPrice = item.price*item.quantity/100;

										if ($bundle.minimum_requirements == 'n_products') {
											discountAmount = discountAmount*item.quantity;
										}

										if (itemPrice - discountAmount >= 0) {
											itemDiscountAmount = discountAmount;
										} else {
											// Item price is lower than the discount
											itemDiscountAmount = itemPrice;
										}
									}
								}
							}
						}
						
						// The multiplier is used for the pre-paid subscriptions
						totalDiscountValue += itemDiscountAmount*this.getMultiplier(item);
						
						// Calculate the applied discount amount
						var appliedDiscountAmount = totalDiscountValue - initialDiscountAmount;
						
						// Add applied discount amount to the line item in the cart
						this.reduceCartItemPrice(cartDataReference, appliedDiscountAmount, item);
					}
				}
			}
			
			// Not used anymore
			if (totalDiscountedAmount>0 && discountPercent>0) {
				// som-cordial.
				// Round discount percent to 2 descimals only
				discountPercent = Math.floor(discountPercent * 100)/100;
				// Get total discount amount and floor it
				totalDiscountValue += Math.floor(totalDiscountedAmount*discountPercent)/100;
			}
		}
		
		// Only apply this setting in the cart if we currently have only legacy bundles active. This setting messes up and calculates wrongly, if we have any non-legacy bundle in the cart
				

		totalDiscountValue = Math.round(totalDiscountValue * 100) / 100; // Round to 2 decimal points
		totalDiscountValue = Math.round(totalDiscountValue * 100); // Increase total number to remove decimals and round to remove the fractional numbers (because it can be like 1898.9999998
		//this.displayCartValue(totalDiscountValue, cartData);
		
		if (withMergedCart === true) {
			return totalDiscountValue;
		} else {
			var returnObject = {
				total_discount_value	: totalDiscountValue,
				applicable_combos		: applicableCombos,
				applicable_bundles		: $applicableBundles	
			};

			return returnObject;
		}
	},
	// This function is used by cdo.php where we fallback to the use of draft orders if we have:
	// 1. At least one legacy bundle OR
	// 2. If any product has a selling plan
	checkForLegacyBundlesAndSellingPlan: function(cartData, applicableBundles, applicableCombos) {

		// -- 1. Check: We have at least one legacy bundle --

		var legacyBundle = this.checkForBundleVersion(applicableBundles, applicableCombos, 1);

		if (legacyBundle === true) {
			return true;
		}

		// -- 2. Check: Any of the products has a selling plan --
		/* // 2025-03-13: No need for this check anymore
		var hasSellingPlan = this.containsSellingPlan(cartData);

		if (hasSellingPlan === true) {
			return true;
		}*/

		return false
	},
	// Returns true, if any of the bundles in the cart has version that we are searching for
	checkForBundleVersion: function(applicableBundles, applicableCombos, version) {

		const bundleIds = new Set();
    
		applicableCombos.forEach(combo => {
			Object.values(combo).forEach(item => {
				bundleIds.add(item.bundle_id);
			});
		});
	
		// Check if any of the corresponding bundles from applicable combos has version 2 (non-legacy bundle)
		return applicableBundles.some(bundle => bundleIds.has(bundle.id) && bundle.version === version);
	},
	// Returns true if we have only a specific version of bundle in cart, if there is a different version, return false
	checkForBundleVersionAll: function(applicableBundles, applicableCombos, version) {

		const bundleIds = new Set();
    
		applicableCombos.forEach(combo => {
			Object.values(combo).forEach(item => {
				bundleIds.add(item.bundle_id);
			});
		});
		
		// Get all bundles that are in the cart
		const filteredBundles = applicableBundles.filter(bundle => bundleIds.has(bundle.id));

		// Check if ALL of the corresponding bundles from applicable combos has version 2 
		return filteredBundles.length > 0 && filteredBundles.every(bundle => bundle.version === version);
	},
		updateLineItemProperties: function(applicableCombos) {

		var cartEndpoint = 'default';	
		let bndlrString = "";
		var encodedBundleId = "";
		var encodedQuantity = "";

		// -- CHANGE.JS -> UPDATING LINE ITEM PROPERTIES --

		var self = this;

		cart.get(cartEndpoint, false).done(function(cartData) {

			// When we receive the cart, we also need to merge it so that it will work the same as product-discount function
			var mergedCartData = JSON.parse(JSON.stringify(cartData));
			mergedCartData = self.mergeCartData(mergedCartData);

			var correctQuantity = 0;

			var existingProperty = "";

			// -- Loop through cart items and append line item property of the bundle to each of them that is in applicable bundle --
			mergedCartData.items.forEach((item, index) => {

				if (typeof item.properties._bndlr !== 'undefined') {
					existingProperty = item.properties._bndlr;
				}

				// Reset the attributes for each item
				bndlrString = "";

				// -- Loop through combos --
				applicableCombos.forEach(combo => {
		
					// -- Loop through products in combo --
					Object.keys(combo).forEach(comboProductKey => {	
						
						let comboProduct = combo[comboProductKey];

						if (comboProduct.orig_line_item_id === item.orig_line_item_id) {
							// Format: BundleID:Quantity;BundleID:Quantity

							// Encode the bundleID and the quantity
							encodedBundleId = utils.reverseEncodeId(comboProduct.bundle_id);
							encodedQuantity = utils.reverseEncodeId(comboProduct.quantity);

							bndlrString += encodedBundleId + ":" + encodedQuantity + ";";
						}
					}) 
				});

				// -- If it already has the property _bndlr, then we don't have to do anything else. If it doesn't have a property, means that we need to add it
				if (bndlrString !== "") { 
					if (existingProperty !== bndlrString) {

						properties = item.properties;

						properties._bndlr = bndlrString;
						properties.__ = utils.getRandomString(4);	

						cartData.items.forEach((item_c, index) => {
							if (index+1 === item.orig_line_item_id) {
								correctQuantity = item_c.quantity;
							}
						})
						self.addLineItemPropertiesToQueue(item.orig_line_item_id, properties, correctQuantity);
					}
				} else {
					// The product did have _bndlr property, but is not not applicable for a bundle anymore, so we need to remove the property from it
					if (existingProperty) {
						properties = item.properties;
						delete properties._bndlr;

						if (Object.keys(properties).length === 0) {
							properties.__ = null;
						} 

						cartData.items.forEach((item, index) => {
							if (index+1 === item.orig_line_item_id) {
								correctQuantity = item.quantity;
							}
						})
						self.addLineItemPropertiesToQueue(item.orig_line_item_id, properties, correctQuantity);
					}
				}

				// Property exists, however applicable combos are empty, so 0 products are applicable for any of the bundles. We should remove the _bndlr from all of the products
				if (applicableCombos.length === 0) {
					if (existingProperty !== "") {

						properties = item.properties;
						delete properties._bndlr;

						if (Object.keys(properties).length === 0) {
							properties.__ = null;
						} 

						cartData.items.forEach((item, index) => {
							if (index+1 === item.orig_line_item_id) {
								correctQuantity = item.quantity;
							}
						})
						self.addLineItemPropertiesToQueue(item.orig_line_item_id, properties, correctQuantity);
					}
				}
			});
			
						
			if (typeof window.cartbot !== 'undefined') {
								setTimeout(function() {
					promiseQueue.process("add_line_item_properties"); 
				}, 1000);
			} else {
				promiseQueue.process("add_line_item_properties"); 
			}
		});
	},
	// Sends a change.js request to Shopify to change the line item properties of the items in the cart
	addLineItemPropertiesToQueue: function(line_id, properties, quantity) {

		if (quantity <= 0) {
			// Quantity is less than or equal to 0, skip this item 
			return;
		} 

		let updates = {
			//id: item.key,
			line		: line_id, // Using line item index instead of key otherwise we got an error when the key was changed.
			properties	: properties,
			quantity	: quantity
		};
			
		promiseQueue.add("add_line_item_properties", function() {
			return fetch(window.Shopify.routes.root + 'cart/change.js?bundler-cart-call', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(updates)
			})
		}, function() {
			/* console.log("finished!") */
		});
	},
	reduceCartItemPrice: function(cart, discountAmount, item) {
		var lineId = item.line_item_id;
		
		discountAmount = Math.round(discountAmount*100); // Round to 2 decimal points and remove decimals
		if (typeof cart !== 'undefined' && typeof cart.items !== 'undefined' && typeof cart.items[lineId] !== 'undefined') {
			
			//var linePrice = cart.items[lineId].line_price - discountAmount; // Should we change this to original_line_price so that we use the original price before the discount codes are applied?
			
			if (typeof cart.items[lineId].original_line_price_adjusted === 'undefined') {
				cart.items[lineId].original_line_price_adjusted = cart.items[lineId].original_line_price;
			}
			
			var linePrice = cart.items[lineId].original_line_price_adjusted - discountAmount; // Changed to change the original_line_price otherwise we were applying discount to the already discounted cart from the discount codes.
			cart.items[lineId].line_price = linePrice;
			cart.items[lineId].original_line_price_adjusted = linePrice; // Also change the original_line_price_adjusted so that we stack discounts from different bundles (added on 2024-04-23).
		}
	},
	/**
	 * Returns total original amount for all products in the combo
	 */
	getTotalOriginalAmount: function(combo) {
		var totalAmount = 0;
		for(var productId in combo) {
			if (combo.hasOwnProperty(productId)) {
				if (typeof combo[productId] !== 'undefined' && combo[productId].type === 'discounted') {
					totalAmount += bndlr.getPrice(combo[productId].price)*combo[productId].quantity;
				}
			}
		}
		
		return totalAmount;
	},
	canApplyBundle: function(items, bundle) {
		
		var requiredProductsCounter = 0;

				
		if (bundle.minimum_requirements === 'volume_discounts') {
			return true;
		}
		
		if (bundle.minimum_requirements === 'sectioned_n_products') {
			return true;
		}
		
		// For bundle products
		for (var productId in bundle.products) {
			if (bundle.products.hasOwnProperty(productId)) {
				var isInCart = false;
				
				var product = bundle.products[productId];
				// for bundle product variants
				for (var variantId in product.variants) {
					if (product.variants.hasOwnProperty(variantId)) {
						
						// for cart items
						for (var i = 0; i < items.length; i++) {
							if (variantId == items[i].variant_id) {
								
								if (bundle.minimum_requirements === 'all_products' || bundle.minimum_requirements === 'specific_products') {
									isInCart = true;
								} else if (bundle.minimum_requirements === 'n_products') {
									isInCart = true;
									if (product.quantity < items[i].quantity) {
										// Actual quantity in cart is bigger than max allowed quantity
										requiredProductsCounter += product.quantity;
									} else {
										requiredProductsCounter += items[i].quantity;
									}
								}
							}
						}
					}
				}
				
				if (bundle.minimum_requirements === 'all_products' || bundle.minimum_requirements === 'specific_products') {
					if (isInCart === false) {
						return false;
					}
				}
			}
		}
		
		if (bundle.minimum_requirements === 'n_products') {
			if (requiredProductsCounter >= bundle.minimum_requirements_num) {
				return true;
			} else {
				return false; 
			}
		} else {
			return true;
		}
	},
	getApplicableBundles: function(cartData) {
		// Get bundles which can be applied to the cart items
		var $applicableBundles = [];
		
		for (var i = 0; i < bundles.length; i++) {
			// Why do we even have to check if we can apply the bundle?
			// We will check it in the next step
			if (this.canApplyBundle(cartData.items, bundles[i])) {
				$applicableBundles.push(bundles[i]);
			}
			
		}

		return $applicableBundles;
	},
	/**
	 * Substracts quantity from cart and creates list of combos (bundles) with their products and bundle id.
	 */
	getApplicableCombosAll: function(cartData, $applicableBundles, returnObject) {
		
		if (typeof returnObject === 'undefined') {
			var returnObject = false;
		}

		// Get applicable items from cart for the applicable bundles					
		var $applicableItems = {};
		var applicableCombos = [];
		var cartCopy = JSON.parse(JSON.stringify(cartData));
		
		var cartItems = JSON.parse(JSON.stringify(cartData.items));
		
		for (var b = 0; b < 2; b++) { // Commented b from 2 to 1 on 2025-03-12 otherwise we were applying discounts even if merchant didn't want to apply it unless the product was added to the cart from the bundle widget
			// For applicable bundles
			for (var k = 0; k < $applicableBundles.length; k++) {

				var usePreferredBundle = true;
				if (b > 0) {
					usePreferredBundle = false; // Commented this on 2025-03-12 otherwise we were applying discounts even if merchant didn't want to apply it unless the product was added to the cart from the bundle widget
				}

				// Get applicable combos for this bundle
				var combos = this.getApplicableCombosForBundle(cartItems, $applicableBundles[k], usePreferredBundle);
				
				/*
				if (combos.length > 0) {
					console.log('usePreferredBundle', usePreferredBundle);
					console.log('combos', combos);
				}*/

				for (var i = 0; i < combos.length; i++) {
					var canApplyCombo = true;
					
					if (typeof combos[i] === 'undefined') {
						// Skip empty slots
						continue;
					}

					// for combos 
					// subsctract quantity from cart items
					for (var productId in combos[i]) {
						if (combos[i].hasOwnProperty(productId)) {
							var canApplyProduct = false;
							var product = combos[i][productId];
							for (var j = 0; j < cartCopy.items.length; j++) {
								var lineItem = cartCopy.items[j];
								if (lineItem.variant_id == product.variant_id) {

									if (lineItem.quantity >= product.quantity && j == product.line_item_id) {
										canApplyProduct = true;
										lineItem.quantity -= product.quantity;
									}
								}
							}
							
							if (canApplyProduct === false) {
								canApplyCombo = false;
							}
						}
					}
					
					if (canApplyCombo) {
						// Why do we even have to check again if we can apply the combo? It was already checked in the previous method.
						applicableCombos.push(combos[i]);
					} else {
						// TODO return quantity back to cart copy?
					}
				}
			}
		}
				
		if (returnObject === true) {
			return {
				applicableCombos			: applicableCombos,
				cartWithReducedQuantities	: cartCopy
				
			};
		} else {
			return applicableCombos;
		}
	},
    // This function rechecks the combos to see if bundle can really be applied because of the required products
    checkRequiredProductsForTieredBundle: function(combos, bundle) {

        // Store the required tiered products from the bundle 
        var numOfRequiredTieredProductsArray 		    = {};
        // Store the applied products (currently inside cart)
        var numOfRequiredTieredProductsAppliedArray 	= {};

        // We currently do not handle the quantity for required products
        // In tiered so we will leave this to be = 1 so we can upgrade once
        for (var productId in bundle.products) {
            if (bundle.products.hasOwnProperty(productId)) {

                if (bundle.products[productId].required === 1) {
                    //numOfRequiredMixNMatchProducts++;
                    numOfRequiredTieredProductsArray[productId] = 1;
                }
                
                if (typeof combos !== 'undefined' && combos.length > 0) {
                    for (var id in combos) {
                        if (combos.hasOwnProperty(id) && combos[id].length !== 0) {
                            var combo = combos[id];
                            for (var comboProductId in combo) {
                                if (combo.hasOwnProperty(comboProductId)) {
                                    var comboProduct = combo[comboProductId];

                                    if (comboProduct.product_id == productId) {                    

                                        if (bundle.products[productId].required === 1) {
                                            numOfRequiredTieredProductsAppliedArray[productId] = 1;
                                        } 
                                    }
                                    
                                }
                            }
                        }
                    }
                }      
            }
        }

        var requiredKeys = Object.keys(numOfRequiredTieredProductsArray);
        var appliedKeys = Object.keys(numOfRequiredTieredProductsAppliedArray);

        // We clear the combo if the required and applied products are not matching
        if ((requiredKeys.length === appliedKeys.length && requiredKeys.sort().join() === appliedKeys.sort().join()) === false) {
            Object.keys(combos).forEach(comboId => {
                combos[comboId] = {};
            });        
        } 

        return combos;

    },
	getApplicableCombosForBundle: function(cartItems, bundle, usePreferredBundle) {
		
		if (typeof usePreferredBundle === 'undefined') {
			usePreferredBundle = true;
		}
		
		// Quantity in cartItems object is reduced by reference so each item gets applied only the number of times it is in the cart

		if (cartItems.length === 0) {
			return [];
		}

		var combos = [];
		var comboId = 0;
		var loop = true;
		// product quantity count is used for making sure that we don't apply more than maximum allowed number of products to the combo
		var productQuantityCount = 0;

		if (bundle.volume_discounts !== 'undefined' && bundle.volume_discounts.length > 0) {
			
						
				var totalCartValue = 0;
				if (bundle.volume_bundle_cart_value_use_all_products === 'true') {
					for(var n = 0; n < cartItems.length; n++) {
						totalCartValue += cartItems[n].price*cartItems[n].quantity;
					}
				}
					
				// Loop through volume discounts, bundle products, cart items and push in as many products as you can for each volume discount
				for (var p = (bundle.volume_discounts.length - 1); p >= 0; p--) {
					
					var volumeDiscount = bundle.volume_discounts[p];
					
					loop = true;
					while(loop) {
				
						if (comboId > 10000) {
							loop=false;
							bundlerConsole.log('-- Terminating loop -- 1');
						}
					
						var minTotal 		= volumeDiscount.min_items; 		// The minimum quantity requirements are checked below
						var max 			= volumeDiscount.max_items;
						var rangeType 		= volumeDiscount.range_type; 		// Possible values: fixed_quantity, range, min_limit_only, min_cart_value
						var minCartValue	= volumeDiscount.min_cart_value; 	// Minimum purchase amount 

						var totalItemsInCombo 			= 0;
						var totalProductQuantityInCombo = {};
						var totalValueOfCombo 			= 0;
						
						var maxQuantity = minTotal;

						if (rangeType === 'range' && max !== '' && max !== null) {
							maxQuantity = max;
						}
						
						if (rangeType === 'min_limit_only' || rangeType === 'min_cart_value') {
							// Set max quantity to null, as we don't have any limit set up
							maxQuantity = null;
						}
						
						var originalMaxQuantity = maxQuantity;
						
						var requirementWasFulfilled = false;
					
						if (bundle.product_target_type === 'all_products') {
							// ALL PRODUCTS 							

							// First cart items loop
							for (var j = 0; j < cartItems.length; j++) {
								var productId = cartItems[j]['product_id'];
								totalProductQuantityInCombo[productId] = 0;

								// Second cart items loop
								for (var i = 0; i < cartItems.length; i++) {
									
									if (productId == cartItems[i]['product_id']) {
										// Product ID has to be the same
									
										var apQuantity = cartItems[i].quantity;
										var applyCombo = false;
										
										if (apQuantity > 0) {
											
											if (maxQuantity !== null && apQuantity > maxQuantity) {
												apQuantity = maxQuantity;
											}
											
											// If quantity is still more than 0, apply it to the bundle
											if (apQuantity > 0) {
												
												applyCombo = true;
											
												if (maxQuantity !== null) {
													// Subtract the applied quantity from the max allowed quantity
													maxQuantity -= apQuantity;
												}
											}
											
											
											if (applyCombo) {
												if (typeof combos[comboId] === 'undefined') {
													combos[comboId] = {};
												}
												
												// Use item id, as the same product can be in the order multiple times (with different properties)
												var key = i;
												
												var origLineItem = i;
												if (typeof cartItems[i].orig_line_item_id !== 'undefined') {
													// Shopify POS integration needs original line item id so it knows on which item to set the discount
													// The items are sorted by ascending quantity
													origLineItem = cartItems[i].orig_line_item_id;
												}
												
												combos[comboId][key] = {
													product_id 			: productId,
													variant_id 			: cartItems[i].variant_id,
													line_item_id 		: i,
													orig_line_item_id	: origLineItem,
													bundle_id 			: bundle.id,
													price				: cartItems[i].price,
													quantity 			: apQuantity,
													discount_type		: bundle.discount_type,
													type				: 'discounted',
													volume_discount		: JSON.parse(JSON.stringify(volumeDiscount))
												};
												
												cartItems[i].quantity -= apQuantity;
												
												totalItemsInCombo 						+= apQuantity;
												totalProductQuantityInCombo[productId] 	+= apQuantity;
												
												totalValueOfCombo += cartItems[i].price*apQuantity;
											}
										}
									}
								}
								
								if (bundle.volume_bundle_combine_quantites !== 'true' && rangeType !== 'min_cart_value') {
									
									if (totalProductQuantityInCombo[productId] < volumeDiscount.min_items*1) {
										// Return quantity back to cart
										this.returnQuantityToCartItem(cartItems, combos[comboId]);
										// Reset the combo as it doesn't fulfill the needs
										combos[comboId] = {};
									} else {
										requirementWasFulfilled = true;
									}
									
									// Reset the max quantity to the original one, as it was reduced to get all products
									maxQuantity = originalMaxQuantity;
									
									totalProductQuantityInCombo[productId] = 0;
									
									comboId++;
								}
							}
						} else {
							// SPECIFIC PRODUCTS
							
							// For bundle products
							for (var productId in bundle.products) {
								if (bundle.products.hasOwnProperty(productId)) {
									var product 		= bundle.products[productId];
									var productVariants = bundle.products[productId].variants;
									
																		
									totalProductQuantityInCombo[productId] = 0;
								
									// For bundle product variants
									for (var variantId in productVariants) {
										if (productVariants.hasOwnProperty(variantId)) {

											// For cart items
											for (var i = 0; i < cartItems.length; i++) {
												
												if (variantId == cartItems[i].variant_id) {
													
													if (bundle.minimum_requirements === 'tiered_n_products' && this.bundleMatchesPreferredBundle(cartItems[i], bundle, usePreferredBundle) === false) {
														// Don't apply this bundle 
													} else {
												
														var apQuantity = cartItems[i].quantity;
														var applyCombo = false;
														
														if (apQuantity > 0) {
															
															if (maxQuantity !== null && apQuantity > maxQuantity) {
																apQuantity = maxQuantity;
															}
															
															// If quantity is still more than 0, apply it to the bundle
															if (apQuantity > 0) {
																
																applyCombo = true;
															
																if (maxQuantity !== null) {
																	// Subtract the applied quantity from the max allowed quantity
																	maxQuantity -= apQuantity;
																}
															}
															
															
															if (applyCombo) {
																if (typeof combos[comboId] === 'undefined') {
																	combos[comboId] = {};
																}
																
																// Use item id, as the same product can be in the order multiple times (with different properties)
																var key = i;
																
																var origLineItem = i;
																if (typeof cartItems[i].orig_line_item_id !== 'undefined') {
																	// Shopify POS integration needs original line item id so it knows on which item to set the discount
																	// The items are sorted by ascending quantity
																	origLineItem = cartItems[i].orig_line_item_id;
																}
																
																combos[comboId][key] = {
																	product_id 			: productId,
																	variant_id 			: cartItems[i].variant_id,
																	line_item_id 		: i,
																	orig_line_item_id	: origLineItem,
																	bundle_id 			: bundle.id,
																	price				: cartItems[i].price,
																	quantity 			: apQuantity,
																	discount_type		: bundle.discount_type,
																	type				: 'discounted',
																	volume_discount		: JSON.parse(JSON.stringify(volumeDiscount))
																};
																
																cartItems[i].quantity -= apQuantity;
																
																totalItemsInCombo 						+= apQuantity;
																totalProductQuantityInCombo[productId] 	+= apQuantity;
																
																totalValueOfCombo += cartItems[i].price*apQuantity;
															}
														}
													}
												}
											}
											
										}
									}
									
									if (bundle.volume_bundle_combine_quantites !== 'true' && rangeType !== 'min_cart_value') {
										
										if (totalProductQuantityInCombo[productId] < volumeDiscount.min_items*1) {
											// Return quantity back to cart
											this.returnQuantityToCartItem(cartItems, combos[comboId]);
											// Reset the combo as it doesn't fulfill the needs
											combos[comboId] = {};
										} else {
											requirementWasFulfilled = true;
										}
										
										// Reset the max quantity to the original one, as it was reduced to get all products
										maxQuantity = originalMaxQuantity;
										
										totalProductQuantityInCombo[productId] = 0;
										
										comboId++;
									}
								}
							}
						}
						
						if (bundle.volume_bundle_combine_quantites === 'true' && rangeType !== 'min_cart_value') {
							if (totalItemsInCombo < volumeDiscount.min_items*1) {
								//console.log(JSON.parse(JSON.stringify(combos[comboId])));
								// Return quantity back to cart
								this.returnQuantityToCartItem(cartItems, combos[comboId]);
								// Reset the combo as it doesn't fulfill the needs
								combos[comboId] = {};
							} else {
								requirementWasFulfilled = true;
							}
							comboId++;
						}
						
						if (rangeType === 'min_cart_value') {
							// console.log('totalValueOfCombo', totalValueOfCombo, minCartValue*100);
							// console.log('totalCartValue', totalCartValue, minCartValue*100);
							
							if (bundle.volume_bundle_cart_value_use_all_products === 'true') {
								// Check if the total cart value is high enough so we can apply the discount 
								if (totalCartValue >= minCartValue*100 && typeof combos[comboId] !== 'undefined' && Object.keys(combos[comboId]).length > 0) {
									// We can apply this discount 
									requirementWasFulfilled = true;
								} else {
									// We can't apply this discount. 
									// Return the quantity back to the cart 
									this.returnQuantityToCartItem(cartItems, combos[comboId]);
									// Reset the combo as it doesn't fulfill the needs
									combos[comboId] = {};
								}
							} else {
							
								if (totalValueOfCombo >= minCartValue*100) {
									//console.log('can apply discount');
									// We can apply this discount 
									requirementWasFulfilled = true;
								} else {
									//console.log('CANT apply discount');
									// We can't apply this discount. 
									// Return the quantity back to the cart 
									this.returnQuantityToCartItem(cartItems, combos[comboId]);
									// Reset the combo as it doesn't fulfill the needs
									combos[comboId] = {};
								}
							}
							comboId++;
						}
					
						if (requirementWasFulfilled === false) {
							// Stop the loop and continue with the next volume discount, as none of the products could fit in the volume discount
							loop = false;
						}
					}

				}

                if (bundle.minimum_requirements === 'tiered_n_products') {
                    if (combos.length > 0) {
                        if (typeof bundle !== 'undefined' && Object.keys(bundle.products).length > 0) {
                            combos = this.checkRequiredProductsForTieredBundle(combos, bundle); 
                            // loop = false
                        }
                    }
                }

						
		} else {

			while(loop) {
				
				if (comboId > 10000) {
					loop=false;
					bundlerConsole.log('-- Terminating loop -- 2');
				}
				
				if (bundle.minimum_requirements === 'specific_products') {

					// for required bundle products
					for (var productId in bundle.required_products) {
						if (bundle.required_products.hasOwnProperty(productId)) {
							var product 		= bundle.required_products[productId];
							var productVariants = bundle.required_products[productId].variants;

							cartItemsLoop:
							// for cart items
							for (var i = 0; i < cartItems.length; i++) {
								// for required bundle product variants
								for (var variantId in productVariants) {
									if (productVariants.hasOwnProperty(variantId)) {
										
										var quantity = product.quantity;

										if (variantId == cartItems[i].variant_id && this.bundleMatchesPreferredBundle(cartItems[i], bundle, usePreferredBundle)) {
										
											var applyCombo = false;
											var apQuantity = cartItems[i].quantity;
											
											if (cartItems[i].quantity >= quantity) {
												apQuantity = quantity;
												applyCombo = true;
											}
				
											if (applyCombo) {
												if (typeof combos[comboId] === 'undefined') {
													combos[comboId] = {};
												}

												var key = i;
												
												var origLineItem = i;
												if (typeof cartItems[i].orig_line_item_id !== 'undefined') {
													// Shopify POS integration needs original line item id so it knows on which item to set the discount
													// The items are sorted by ascending quantity
													origLineItem = cartItems[i].orig_line_item_id;
												}
												
												combos[comboId]['required_'+key] = {
													product_id 			: productId,
													variant_id 			: cartItems[i].variant_id,
													line_item_id 		: i,
													orig_line_item_id	: origLineItem,
													bundle_id 			: bundle.id,
													price				: cartItems[i].price,
													quantity 			: apQuantity,
													discount_type		: bundle.discount_type,
													type				: 'required'
												};
												
												cartItems[i].quantity -= apQuantity;

												break cartItemsLoop;
											}
										}
									}
								}
							}
						}
					}
				}
				
				productQuantityCount = 0;
				// Object which contains quantity counter for each product for mix&match bundle. 
				// This way, we can limit the total variants from the product according to the actual specification.
				var remainingEachProductQuantity = {};
				
				// Add required products from Mix & Match bundle to the combo. This allows us to set a few products in the mix & match bundles as required.
				// For example, get a discount on product A if you buy it together with any other product. 
				if (bundle.minimum_requirements === 'n_products') {
					// For bundle products
					for (var productId in bundle.products) {
						if (bundle.products.hasOwnProperty(productId)) {
							var product 		= bundle.products[productId];
							var productVariants = bundle.products[productId].variants;
							
							if (typeof remainingEachProductQuantity[productId] === 'undefined') {
								remainingEachProductQuantity[productId] = product.quantity;
							}
						
							// For bundle product variants
							for (var variantId in productVariants) {
								if (productVariants.hasOwnProperty(variantId)) {
									
									// Only do this for REQUIRED products
									if (productVariants[variantId].required === 1) {
									
										var quantity = product.quantity;
										
										// For cart items
										for (var i = 0; i < cartItems.length; i++) {
											
											if (variantId == cartItems[i].variant_id && this.bundleMatchesPreferredBundle(cartItems[i], bundle, usePreferredBundle)) {
											
												var applyCombo = false;
												var apQuantity = cartItems[i].quantity;
												
												if (cartItems[i].quantity > 0) {
													var remainingQuantity = remainingEachProductQuantity[productId];
													
													if (cartItems[i].quantity > remainingQuantity) {
														// Reduce the variant quantity to the maximum remaining allowed quantity
														// The max quantity limit has to be applied across all variants of this product
														apQuantity = remainingQuantity;
													}
													
													
													// Check if merchant set max allowed products for the bundle
													// Check if total quantity will be more than maximum allowed one
													if (bundle.minimum_requirements_n_max_products !== null 
														&& bundle.minimum_requirements_n_max_products !== '' 
														&& (productQuantityCount + apQuantity) > bundle.minimum_requirements_n_max_products) {
														
														// Reduce the applied quantity to maximum allowed one
														apQuantity = bundle.minimum_requirements_n_max_products - productQuantityCount;
													}
													
													// If quantity is still more than 0, apply it to the bundle
													if (apQuantity > 0) {
													
														// Subtract the applied quantity from the max allowed quantity
														quantity 								-= apQuantity;
														// Subtract the applied quantity from the total allowed quantity for this product
														remainingEachProductQuantity[productId] -= apQuantity;
														productQuantityCount 					+= apQuantity;														
													
														applyCombo = true;
													}
													
													
													if (applyCombo) {
														if (typeof combos[comboId] === 'undefined') {
															combos[comboId] = {};
														}
														
														// Use item id, as the same product can be in the order multiple times (with different properties)
														var key = i;
														
														var origLineItem = i;
														if (typeof cartItems[i].orig_line_item_id !== 'undefined') {
															// Shopify POS integration needs original line item id so it knows on which item to set the discount
															// The items are sorted by ascending quantity
															origLineItem = cartItems[i].orig_line_item_id;
														}
														
														combos[comboId][key] = {
															product_id 			: productId,
															variant_id 			: cartItems[i].variant_id,
															line_item_id 		: i,
															orig_line_item_id	: origLineItem,
															bundle_id 			: bundle.id,
															price				: cartItems[i].price,
															quantity 			: apQuantity,
															discount_type		: bundle.discount_type,
															type				: 'discounted'
														};
														
														cartItems[i].quantity -= apQuantity;
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
				
				// Sectioned bundles 
				
				if (bundle.minimum_requirements === 'sectioned_n_products') {
					
					// We will use this variable to reduce the max allowed quantity of each product in the section 
					var sections = JSON.parse(JSON.stringify(bundle.sections));
					
					// Loop through sections 
					for (var sectionId = 0; sectionId < bundle.sections.length; sectionId++) {
						
						var products = bundle.sections[sectionId].products;
						var productSectionTotalQuantityCount = 0;
						
						var copiedSection = sections[sectionId];
						
						// Loop through products in the section 
						for (var productId in products) {
							if (products.hasOwnProperty(productId)) {
								var product 		= products[productId];
								var productVariants = products[productId].variants;
							
								// For bundle product variants
								for (var variantId in productVariants) {
									if (productVariants.hasOwnProperty(variantId)) {
										
										// For cart items
										for (var i = 0; i < cartItems.length; i++) {
											
											if (variantId == cartItems[i].variant_id && this.bundleMatchesPreferredBundle(cartItems[i], bundle, usePreferredBundle) && this.itemMatchesPreferredSection(cartItems[i], sectionId)) {
											
												var applyCombo = false;
												var apQuantity = cartItems[i].quantity; // Applicable quantity 
												
												if (cartItems[i].quantity > 0) {
													var remainingQuantity = copiedSection.products[productId].quantity;
													
													if (cartItems[i].quantity > remainingQuantity) {
														// Reduce the variant quantity to the maximum remaining allowed quantity
														// The max quantity limit has to be applied across all variants of this product
														apQuantity = remainingQuantity;
													}
													
													
													// Check if merchant set max allowed products for this section 
													// Check if total quantity will be more than maximum allowed one
													if (copiedSection.max_items !== null 
														&& copiedSection.max_items !== '' 
														&& (productSectionTotalQuantityCount + apQuantity) > copiedSection.max_items) {
														
														// Reduce the applied quantity to maximum allowed one
														apQuantity = copiedSection.max_items - productSectionTotalQuantityCount;
													}
													
													// If quantity is still more than 0, apply it to the bundle
													if (apQuantity > 0) {
													
														// Subtract the applied quantity from the max allowed quantity
														//quantity 									-= apQuantity;
														// Subtract the applied quantity from the total allowed quantity for this product
														copiedSection.products[productId].quantity 	-= apQuantity;
														productSectionTotalQuantityCount 			+= apQuantity;														
													
														applyCombo = true;
													}
													
													
													if (applyCombo) {
														if (typeof combos[comboId] === 'undefined') {
															combos[comboId] = {};
														}
														
														// Use item id, as the same product can be in the order multiple times (with different properties)
														var key = i;
														
														var origLineItem = i;
														if (typeof cartItems[i].orig_line_item_id !== 'undefined') {
															// Shopify POS integration needs original line item id so it knows on which item to set the discount
															// The items are sorted by ascending quantity
															origLineItem = cartItems[i].orig_line_item_id;
															
															// We know that we are in Shopify POS, so change the i to also include the section ID, as Shopify POS doesn't separate items based on their properties.
															key = i+'_'+sectionId;
														}
														
														var totalItemQuantity = apQuantity;
														if (typeof combos[comboId] !== 'undefined' && typeof combos[comboId][key] !== 'undefined') {
															totalItemQuantity += combos[comboId][key].quantity; // Add quantity from the previous section to this product
														}
														
														combos[comboId][key] = {
															product_id 			: productId,
															variant_id 			: cartItems[i].variant_id,
															line_item_id 		: i,
															orig_line_item_id	: origLineItem,
															bundle_id 			: bundle.id,
															price				: cartItems[i].price,
															quantity 			: totalItemQuantity,
															discount_type		: bundle.discount_type,
															type				: 'discounted',
															section_id			: sectionId
														};
														
														cartItems[i].quantity -= apQuantity; // Subtract only the applicable quanttiy for this item and not the totalItemQuantity
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}
				
				// for bundle products
				for (var productId in bundle.products) {
					if (bundle.products.hasOwnProperty(productId)) {
						var product 		= bundle.products[productId];
						var productVariants = bundle.products[productId].variants;
						
						if (typeof remainingEachProductQuantity[productId] === 'undefined') {
							remainingEachProductQuantity[productId] = product.quantity;
						}
					
						productsLoop:
						// for bundle product variants
						for (var variantId in productVariants) {
							if (productVariants.hasOwnProperty(variantId)) {
								
								var quantity = product.quantity;
								
								
								variantsLoop:
								// for cart items
								for (var i = 0; i < cartItems.length; i++) {
									
									if (variantId == cartItems[i].variant_id && this.bundleMatchesPreferredBundle(cartItems[i], bundle, usePreferredBundle)) {	
									
										var applyCombo = false;
										var apQuantity = cartItems[i].quantity;
										
										if ((bundle.minimum_requirements === 'all_products' || bundle.minimum_requirements === 'specific_products')
											&& cartItems[i].quantity >= quantity) {

											apQuantity = quantity;
											applyCombo = true;
										} else if(bundle.minimum_requirements === 'n_products' && cartItems[i].quantity > 0) {
											
											var remainingQuantity = remainingEachProductQuantity[productId];
											
											if (cartItems[i].quantity >= remainingQuantity) {
												// Reduce the variant quantity to the maximum remaining allowed quantity
												// The max quantity limit has to be applied across all variants of this product
												apQuantity = remainingQuantity;
											}
											
											
											// Check if merchant set max allowed products for the bundle
											// Check if total quantity will be more than maximum allowed one
											if (bundle.minimum_requirements_n_max_products !== null 
												&& bundle.minimum_requirements_n_max_products !== '' 
												&& (productQuantityCount + apQuantity) > bundle.minimum_requirements_n_max_products) {
												
												// Reduce the applied quantity to maximum allowed one
												apQuantity = bundle.minimum_requirements_n_max_products - productQuantityCount;
											}
											
											// If quantity is still more than 0, apply it to the bundle
											if (apQuantity > 0) {
											
												// Subtract the applied quantity from the max allowed quantity
												quantity 								-= apQuantity;
												// Subtract the applied quantity from the total allowed quantity for this product
												remainingEachProductQuantity[productId] -= apQuantity;
												productQuantityCount 					+= apQuantity;														
											
												applyCombo = true;
											}
										}
										
										// If the product is set to have a required selling plan, then we need to check if the product has a selling plan, otherwise, don't apply a combo
										if (cartItems[i].hasOwnProperty('selling_plan_allocation') === false && product.selling_plan_id === 'require_selling_plan') {
											applyCombo = false;
										}
										
										if (applyCombo) {
											if (typeof combos[comboId] === 'undefined') {
												combos[comboId] = {};
											}
											
											if (bundle.minimum_requirements === 'n_products' || bundle.minimum_requirements === 'specific_products') {
												// var key = variantId;
												// Use item id, as the same product can be in the order multiple times (with different properties)
												var key = i;
											} else {
												var key = productId;
											}
											
											var origLineItem = i;
											if (typeof cartItems[i].orig_line_item_id !== 'undefined') {
												// Shopify POS integration needs original line item id so it knows on which item to set the discount
												// The items are sorted by ascending quantity
												origLineItem = cartItems[i].orig_line_item_id;
											}
											
											combos[comboId][key] = {
												product_id 			: productId,
												variant_id 			: cartItems[i].variant_id,
												line_item_id 		: i,
												orig_line_item_id	: origLineItem,
												bundle_id 			: bundle.id,
												price				: cartItems[i].price,
												quantity 			: apQuantity,
												discount_type		: bundle.discount_type,
												type				: 'discounted'
											};
											
											cartItems[i].quantity -= apQuantity;

											
											if (bundle.minimum_requirements === 'n_products') {
												// break variantsLoop;
											} else {
												break productsLoop;
											}
										}
									}
								}
							}
						}
					}
				}

				// Check if all products were found for the last combo
				var appliedProducts 		= 0;
				var appliedRequiredProducts = 0;
				var appliedQuantity 		= 0;
				
				// We use these two variables to make sure that all of the required products from the Mix & Match bundle are included in the combo
				//var numOfRequiredMixNMatchProductsApplied 	= 0;
				//var numOfRequiredMixNMatchProducts 			= 0;
				// These two objects must have the same number of elements in them, so we know that all of the required products from the Mix & Match bundle are included in the combo
				var numOfRequiredMixNMatchProductsArray 		= {};
				var numOfRequiredMixNMatchProductsAppliedArray 	= {};

				
				if (bundle.minimum_requirements === 'all_products') {
					// for bundle products
					for (var productId in bundle.products) {
						if (bundle.products.hasOwnProperty(productId)) {
							if (typeof combos[comboId] !== 'undefined' && typeof combos[comboId][productId] !== 'undefined') {
								appliedProducts++;
							}
						}
					}
				} else if (bundle.minimum_requirements === 'n_products') {
					// for bundle products (mix and match)
					for (var productId in bundle.products) {
						if (bundle.products.hasOwnProperty(productId)) {
							
							if (bundle.products[productId].required === 1) {
								//numOfRequiredMixNMatchProducts++;
								numOfRequiredMixNMatchProductsArray[productId] = 1;
							}
							
							if (typeof combos[comboId] !== 'undefined') {
								// for combo products
								for (var id in combos[comboId]) {
									if (combos[comboId].hasOwnProperty(id)) {
										if (combos[comboId][id].product_id == productId) {
											appliedQuantity += combos[comboId][id]['quantity'];
											
											if (bundle.products[productId].required === 1) {
												//numOfRequiredMixNMatchProductsApplied++;
												numOfRequiredMixNMatchProductsAppliedArray[productId] = 1;
											}
										}
									}
								}
							}
						}
					}
				} else if (bundle.minimum_requirements === 'specific_products') {
					// for bundle products
					for (var productId in bundle.products) {
						if (bundle.products.hasOwnProperty(productId)) {
							if (typeof combos[comboId] !== 'undefined') {
								// for combo products
								for (var id in combos[comboId]) {
									if (combos[comboId].hasOwnProperty(id)) {
										if (combos[comboId][id].type === 'discounted' && combos[comboId][id].product_id == productId) {
											appliedProducts++;
										}
									}
								}
							}
						}
					}
					
					// for bundle products
					for (var productId in bundle.required_products) {
						if (bundle.required_products.hasOwnProperty(productId)) {
							if (typeof combos[comboId] !== 'undefined') {
								// for combo products
								for (var id in combos[comboId]) {
									if (combos[comboId].hasOwnProperty(id)) {
										if (combos[comboId][id].type === 'required' && combos[comboId][id].product_id == productId) {
											appliedRequiredProducts++;
                                        }
									}
								}
							}
						}
					}
				} else if (bundle.minimum_requirements === 'sectioned_n_products') {

					var sections = JSON.parse(JSON.stringify(bundle.sections));

					for (var sectionId in sections) {
						if (sections.hasOwnProperty(sectionId)) {
							var sectionProducts = sections[sectionId].products
							for (var productId in sectionProducts) {
								if (sectionProducts.hasOwnProperty(productId)) {

									var sectionProduct = sectionProducts[productId] 
									
									if (sectionProduct.required === 1) {
										numOfRequiredMixNMatchProductsArray[productId] = 1;
									}


									if (typeof combos[comboId] !== 'undefined') {
										// for combo products
										for (var id in combos[comboId]) {
											if (combos[comboId].hasOwnProperty(id)) {
												if (combos[comboId][id].product_id == productId) {
													// appliedQuantity += combos[comboId][id]['quantity'];
													
													if (sectionProduct.required === 1) {
														//numOfRequiredMixNMatchProductsApplied++;
														numOfRequiredMixNMatchProductsAppliedArray[productId] = 1;
													}
												}
											}
										}
									}
								}
							}
						}
					}
				}

				// Remove any incomplete combos and return quantities to the cart
				if (bundle.minimum_requirements === 'all_products') {
					if (appliedProducts !== Object.keys(bundle.products).length) {
						loop = false;
						
						if (typeof combos[comboId] !== 'undefined' && Object.keys(combos[comboId]).length) {
							// Return quantity back to cart
							this.returnQuantityToCartItem(cartItems, combos[comboId]);
						}
						
						// Last combo is not complete, remove it
						delete combos[comboId];
					}
					
				} else if (bundle.minimum_requirements === 'n_products') {	

					// Check if applied quantity is within bounds
					if (appliedQuantity < bundle.minimum_requirements_num || 
							(bundle.minimum_requirements_n_max_products !== null 
							&& bundle.minimum_requirements_n_max_products !== '' 
							&& appliedQuantity > bundle.minimum_requirements_n_max_products) ||
							Object.keys(numOfRequiredMixNMatchProductsAppliedArray).length < Object.keys(numOfRequiredMixNMatchProductsArray).length //numOfRequiredMixNMatchProductsApplied < numOfRequiredMixNMatchProducts
						) {
						loop = false;
						
						if (typeof combos[comboId] !== 'undefined' && Object.keys(combos[comboId]).length) {
							// Return quantity back to cart
							this.returnQuantityToCartItem(cartItems, combos[comboId]);
						}
						
						// Last combo is not complete, remove it
						delete combos[comboId];
					}
					
				} else if (bundle.minimum_requirements === 'sectioned_n_products') {	
					
					// We will use this variable to reduce the max allowed quantity of each product in the section 
					var sections = JSON.parse(JSON.stringify(bundle.sections));
					
					/*
					console.log('bundle', bundle.name);
					console.log('sections', JSON.parse(JSON.stringify(sections)));
					if (typeof combos[comboId] !== 'undefined') {
						console.log('combos[comboId]', JSON.parse(JSON.stringify(combos[comboId])));
					} else {
						console.log('combo is undefined');
					}
					*/
					
					// Loop through sections 
					for (var sectionId = 0; sectionId < sections.length; sectionId++) {
						
						var sectionRequires0Items = false;
						if (copiedSection.min_items*1 <= 0) {
							sectionRequires0Items = true;
							// If the minimum requirement was set to 0, simply set it to 1, as 0 doesn't make any sense.
							copiedSection.min_items = 0;
							
							//console.log('bundle', bundle);
						}
						
						var products = sections[sectionId].products;
						
						var copiedSection = sections[sectionId];
						if (copiedSection.min_items !== null && 
							copiedSection.min_items !== '' && 
							copiedSection.min_items >= 0) {
							// The requirement for minimum number of items is set up and wasn't yet reached 
							
							// Loop through products int he combo and use their quantities to subtract the min required value in the copied section 
							// Then, if the min required quantity is still more than 0, then we didn't reach it. 
							// Otherwise, the requirement was reached :) 
							
							if (typeof combos[comboId] !== 'undefined') {

								// for combo products
								for (var id in combos[comboId]) {
									if (combos[comboId].hasOwnProperty(id)) {
										if (combos[comboId][id].section_id === sectionId) {
											// Subtract the item quantity from the minimum requirement for this section 
											copiedSection.min_items -= combos[comboId][id].quantity;
										}
									}
								}
								
								if ((Object.keys(combos[comboId]).length === 0 && sectionRequires0Items === true) ||
                                     (Object.keys(numOfRequiredMixNMatchProductsAppliedArray).length !== Object.keys(numOfRequiredMixNMatchProductsArray).length)) {
									// This combo was empty
									// If there is no min requirement set, then we will have an infinite loop. 
									// So stop the loop here.
									
									// Stop the loop 
									sectionId = sections.length;
									// Last combo is not complete, remove it
									delete combos[comboId];
									// Stop the main loop 
									loop = false;
								}
                                
							} else if(sectionRequires0Items === true) {
								// This combo was empty
								// If there is no min requirement set, then we will have an infinite loop. 
								// So stop the loop here.
								
								// Stop the loop 
								sectionId = sections.length;
								// Last combo is not complete, remove it
								delete combos[comboId];
								// Stop the main loop 
								loop = false;
							}
							
							// If the minimum required num of items is still more than 0, then we didn't reach this requirement. 
							// Stop the loop and return the combo back to the cart 
							if (copiedSection.min_items > 0) {
								
								// Stop the loop 
								sectionId = sections.length;
								// return quantity back to the cart 
								this.returnQuantityToCartItem(cartItems, combos[comboId]);
								// Last combo is not complete, remove it
								delete combos[comboId];
								// Stop the main loop 
								loop = false;
							}
						}
						
						/*
						if (copiedSection.min_items === null || 
							copiedSection.min_items === '') {
							// Only go in this if the original minimum requirements aren't set. Without this, if you added the same sectioned bundle to the cart twice,
							// the cart only calculated it once. 
							
							if (copiedSection.min_items*1 <= 0) {
								// The merchant set the requirements for this sectioned bundle to 0
								// Stop the loop otherwise we will get an infinite loop 
								
								console.log('stopping the loop');
								
								loop = false;
							}
						}*/
					}
					
				} else if (bundle.minimum_requirements === 'specific_products') {
					
					if (appliedProducts !== Object.keys(bundle.products).length 
						|| appliedRequiredProducts !== Object.keys(bundle.required_products).length) {

						loop = false;
						
						if (typeof combos[comboId] !== 'undefined' && Object.keys(combos[comboId]).length) {
							// Return quantity back to cart
							this.returnQuantityToCartItem(cartItems, combos[comboId]);
						}
						
						// Last combo is not complete, remove it
						delete combos[comboId];
					}
					
				} else {
					return false;
				}
				
				// Fixed price: Check if fixed price is actually smaller than the total value of items in combo
				if (bundle.discount_type === 'fixed_price' && typeof combos[comboId] !== 'undefined' && Object.keys(combos[comboId]).length) {
					var totalValue = this.getTotalOriginalAmount(combos[comboId])

					if (typeof window.bndlrPOS !== 'undefined') {
						// Multiply by 100 only in Shopify POS
						totalValue = totalValue*100;
					}

					if (bundle.fixed_price_value*100 >= totalValue) {
						// The bundle's fixed price value is set to a higher value than the total value of items
						// Remove the combo, as it is uselessif (!empty($combos[$comboId])) {
						loop = false;
						
						// Return quantity back to cart
						this.returnQuantityToCartItem(cartItems, combos[comboId]);
						delete combos[comboId];
					}
				}
				
								
				comboId++;
			}
		}

		return combos;
	},
	returnQuantityToCartItem: function(cartItems, combo) {
		
		for (var variantId in combo) {
			if (combo.hasOwnProperty(variantId)) {
				var product = combo[variantId];
				var lineItemId = product['line_item_id'];
				if (typeof cartItems[lineItemId] !== 'undefined') {
					cartItems[lineItemId].quantity += product.quantity;
				}
			}
		}
	},
	// Check if the bundle can be applied on thisproduct based on the id in the properties
	bundleMatchesPreferredBundle: function(cartItem, bundle, usePreferredBundle) {
		
		if (typeof usePreferredBundle === 'undefined') {
			usePreferredBundle = true;
		}

		if (usePreferredBundle === false) {

			if (typeof bundle.version !== 'undefined' && bundle.version === 2) {
				return true; // Special case so that we always return true, so that we ignore the line item properties
			}
		}
		
		if (typeof window.bndlrPOS !== 'undefined') {
			// This rule doesn't apply in Shopify POS
			return true;
			// Can't use the line tiem logic in POS, because we can't add separate line item properties to each item added to the cart. They would be grouped, which is not okay.
		}
		
					return true;
				
				
	},
	itemMatchesPreferredSection: function(cartItem, sectionId) {
		
		if (typeof window.bndlrPOS !== 'undefined') {
			// This rule doesn't apply in Shopify POS
			return true;
			// Can't use the line item logic in POS, because we can't add separate line item properties to each item added to the cart. They would be grouped, which is not okay.
		}

		var preferredSectionId = this.getSectionIdFromProperties(cartItem);

		if (preferredSectionId === 0) {
			return true;
		} else if(preferredSectionId === sectionId) {
			return true;
		}
		
		return false;
	},
	// Get the bundle if from line item properties
	getBundleIdFromProperties: function(cartItem) {
		if (typeof cartItem.properties !== 'undefined' && cartItem.properties !== null && Object.keys(cartItem.properties).length > 0) {
			for(var key in cartItem.properties) {
				if (cartItem.properties.hasOwnProperty(key)) {
					if (key.indexOf('_bundler_id') !== -1) {
						var value = cartItem.properties[key];
						if (value*1 == value) {
							return value*1;
						}
					} else if (key.indexOf('_bundler_') !== -1) {
						var value = key.replace('_bundler_', '');
						if (value*1 == value) {
							return value*1;
						}
					}
				}
			}
		}

		return 0;
	},
	// Get the section ID if from line item properties
	getSectionIdFromProperties : function(cartItem) {
		if (typeof cartItem.properties !== 'undefined' && cartItem.properties !== null && Object.keys(cartItem.properties).length > 0) {
			for(var key in cartItem.properties) {
				if (cartItem.properties.hasOwnProperty(key)) {
					if (key.indexOf('_bundle_section_id') !== -1) {
						var value = cartItem.properties[key];
						if (value*1 == value) {
							return value*1;
						}
					} else if (key.indexOf('_bundle_section_') !== -1) {
						var value = key.replace('_bundle_section_', '');
						if (value*1 == value) {
							return value*1;
						}
					}
				}
			}
		}

		return 0;
	},
	displayCartValue: function(value, cartData, canGetFreeShipping) {
		
		if (typeof canGetFreeShipping === 'undefined') {
			canGetFreeShipping = false;
		}
		
		var currency = cartData.currency;

		if (value > 0 || canGetFreeShipping === true) {
			
			var totalCompareAtValue	= cartData.total_price;
						
			if ($('#bndlr-discount-message').length === 0) {
				$('body').append('<div id="bndlr-discount-message" class="bndlr-go-to-checkout"></div>');
			}
			
							var customText = '';
						
			
			var popupTitle 			= 'You got';
			var popupSubtitle 		= '{{savings}} OFF your order';
			var popupAndText	 	= '&';
			var popupFreeShipping 	= 'FREE SHIPPING';
			var popupQuestion 		= 'Apply discount and go to checkout?';
			var popupYes  			= 'Yes, please';
			var popupNo  			= 'No';
			
			// var priceHtml = '<span class="bndlr-cart-price money">' + bndlr.formatPrice(value, currency) + '</span>';
			var priceHtml = htmlUtils.moneySpan(bndlr.formatPrice(value, currency), currency, 'bndlr-cart-price');

			popupTitle 		= popupTitle.replace('{{savings}}', priceHtml);
			popupSubtitle 	= popupSubtitle.replace('{{savings}}', priceHtml);
			popupQuestion 	= popupQuestion.replace('{{savings}}', priceHtml);
			popupYes 		= popupYes.replace('{{savings}}', priceHtml);
			popupNo 		= popupNo.replace('{{savings}}', priceHtml);
			
			var discountHtml = '';
			if (value > 0 && canGetFreeShipping) {
				discountHtml = '<div class="bndlr-message-discount-value">' + 
					popupSubtitle +
					'<div class="bndlr-message-and-text">' + popupAndText + '</div>' +
					popupFreeShipping +
				'</div>';
			} else if (value > 0) {
				discountHtml = '<div class="bndlr-message-discount-value">' + 
					popupSubtitle +
				'</div>';
			} else if (canGetFreeShipping) {
				discountHtml = '<div class="bndlr-message-discount-value">' + 
					popupFreeShipping +
				'</div>';
			}
			
			$('#bndlr-discount-message').html(''+
				'<div class="bndlr-message-title">'+popupTitle+'</div>' + 
				discountHtml +
				customText +
				'<div class="bndlr-message-question">'+popupQuestion+'</div>' + 
				'<div class="bndlr-message-options">' +
					'<div class="bndlr-message-yes">'+popupYes+'</div>' +
					'<div class="bndlr-message-no">'+popupNo+'</div>' +
				'</div>' +
				'<div class="bndlr-message-close"></div>' +
			'');
			
												$('#bndlr-discount-message').animate({bottom: '10px'}, 1000);
										
			bndlr.convertCurrency('.bndlr-cart-price');
			
			try {
				var event = new CustomEvent("bundler:checkout_prompt_shown");
				document.dispatchEvent(event);
			} catch(e) {
				bundlerConsole.log(e);
			}
		}
	},
	};

// PromiseQueue is here that is used to wait for the different change.js requests when adding line item properties to different products
var promiseQueue = {
	queue: {},
	/**
		* key: is a key by which you set in which queue you want to set the action 
		* action: is a function, which will executed your desired action
		* afterFinish: is a function, which will be executed after all actions are executed
		*/
	add: function(key, action, afterFinish) {
		if (typeof this.queue[key] === 'undefined') {
			this.queue[key] = {
				finish: afterFinish, // Action, which will be exectued after all queued actions have finished processing
				q: [],
				tick: 0
			};
		}
		this.queue[key].q.push(action);
	},
	process: function(key) {
		if (typeof this.queue[key] !== 'undefined') {
			var total = this.queue[key].q.length;
			
			var tick = this.queue[key].tick;
			if (typeof this.queue[key].q[tick] !== 'undefined') {
				var promise = this.queue[key].q[tick]();
				
				promise.then(function() {
					setTimeout(function() {
						promiseQueue.tick(key);
					}, 100); // Wait for 100 miliseconds so that the cart total value can be updated
				});
				
				//this.tick(key); // Increase the tick and continue processing the queue
			}
		}
	},
	tick: function(key) {
		if (typeof this.queue[key] !== 'undefined') {
			this.queue[key].tick++;
			
			if (this.queue[key].tick === this.queue[key].q.length) {
				this.queue[key].finish();
				
				delete this.queue[key];
			} else {
				this.process(key);
			}
		}
	},
	cancel: function(key) {
		delete this.queue[key];
	}
};var GlobalUtility = {
	setObserver: function(keySelector, customCallback) {
		// Set intersection observer
				
			if (typeof IntersectionObserver !== 'undefined') {
				var options = {
					root: null, // Defaults to viewport
					rootMargin: '0px 0px 0px 0px',
					threshold: .25
				}

				var callback = function(entries, observer) {

					for (var i = 0; i<entries.length; i++) {
						var entry = entries[i];

						if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
							// Show bundle if the entry is intersecting or is displayed above the viewport (entry.boundingClientRect.top < 0)
							observer.unobserve(entry.target);
							customCallback();
						}
						
						// Each entry describes an intersection change for one observed
						// target element:
						//   entry.boundingClientRect
						//   entry.intersectionRatio
						//   entry.intersectionRect
						//   entry.isIntersecting
						//   entry.rootBounds
						//   entry.target
						//   entry.time
					}
				};

				var observer = new IntersectionObserver(callback, options);
				
				var target = document.querySelector(keySelector);
				
				if (target !== null) {
					observer.observe(target);
				}
			} else {
				customCallback();
			}
			
			},
	liquidReplaceMulti: function(string, keyValue) {
		
		for(var key in keyValue) {
			if (keyValue.hasOwnProperty(key)) {
				string = this.liquidReplace(string, key, keyValue[key]);
			}
		}
		
		return string;
	},
	liquidReplace: function(string, key, value) {
		var regex = new RegExp("{{\\s*" + key + "\\s*}}",'i');
		string = string.replace(regex, value);
		return string;
	}
};var VolumeDiscounts = {
	targetElementSelectors: {
		'.bundler-target-element-volume-discounts-visible-only' 			: {
			'action': 'prepend',
			'visible_only': true
		},
		'#bundler-target-element-volume-discounts' 							: {
			'action': 'prepend'
		},
		'.bundler-target-element-volume-discounts' 							: {
			'first_only': true,
			'action': 'prepend'
		},
		//'form.pf-product-form [data-pf-type="Row"] [data-pf-type="Column"]' : 'append',
		'form[action="/cart/add"].pf-product-form button[data-checkout="checkout"][data-pf-type="ProductATC"]' : 'after',
		'form.AddToCartForm  .module-wrap.gf_gs-button-check-button[data-key="dynamic-button"]' : 'append',
		'.buy-buttons-row form[action*="/cart/add"]' : 'after',
		'.gryffeditor form.AddToCartForm .item-content > .gf_row > div.gf_column + div.gf_column' : 'append',
		'.product__section--buttons.product-add form' 							: 'after',
		'form[action*="/cart/add"]' 											: 'after',
		'#add-to-cart-product form[action*="/cart/add"]' 						: 'after',
		'form#cart-form[action*="/cart/add"]' 									: 'after',
		'form.product-form[action*="/cart/add"]' 								: 'after',
		'.product-info #wait_li_form' 											: 'after',
		'form.productForm[action*="/cart/add"]'			 						: 'after',
		'form#AddToCartForm--product-template'									: 'after',
		'form[action*="/cart/add"][data-type="add-to-cart-form"][id*="__main"]' : 'after',
		'form.shopify-product-form'			 									: 'after',
		'form#AddToCartForm'			 										: 'after',
		'#shopify-section-product-template form#product-form' 					: 'after',
		'.product-page-info form[action*="/cart/add"]' 							: 'after',
		'.product-form-container form.shopify-product-form' 					: 'after',
		'#ProductSection-product-template-default form#add-to-cart-form'		: 'after',
		'.modal-wrapper.is-open form.product-form[data-product-handle]'			: 'after',
		'[data-pf-type="Section"]:not(.pf-hide) form.pf-product-form button[data-pf-type="ProductATC"]' : {
			'closest' : '[data-pf-type="Block"]', // Go back to the closest parent element
			'action' : 'after' // Action after the closest element is found
		},
		'form.et-product-form-product-template .et-product-single__description' 			: 'before', // In the <form /> element
		'form.et-product-form-product-template' 											: 'after',
		'form.product-single__form'															: 'after',
		'.product_section form.shopify-product-form'										: 'after',
		'form[data-type="add-to-cart-form"]'												: 'after',
		'.product__info-wrapper form[data-type="add-to-cart-form"]'							: 'after',
		'.product-info form[action*="/cart/add"]' 											: 'after',
		'#shopify-section-template--product form#add-to-cart-form' 							: 'after',
		'.product-shop form#add-to-cart-form' 												: 'after',
		'.product-page--info-box--container form.product-form--container'					: 'after',
		'.product-detail__type + form[action="/cart/add"], .product-detail__title-area + form[action="/cart/add"]'	: 'after',
		'form#add-to-cart-form'	: 'after',
		'#product-info form.product-action[action*="/cart/add"]'	: 'after',
		'.product-details form[action*="/cart/add"].product-form'	: 'after',
		'form[action="/cart/add"].ProductForm'	: 'after',
		'#ProductSection .product-single__hero form[action="/cart/add"].product-form--wide'	: 'after',
		'.product-form form[data-type="add-to-cart-form"]'	: 'after',
		'.product__info form.product__form'	: 'after',
		'[itemtype="http://schema.org/Offer"] ~ .container ~ .product-detail form[action="/cart/add"]'	: 'after',
		'form[action*="/cart/add"][data-section="template-product"]'	: 'after',
		'form[action*="/cart/add"]'	: 'after',
		'form#cart-form_ppr[action*="/cart/add"]'	: 'after',
		'.Product__Info form.ProductForm'	: 'after',
		'.product__info .product-form'	: 'after',
		'.product-page--block[data-block-type="buy-buttons"]'			: 'after',
		'.sf-prod__info form[action="/cart/add"]'						: 'after',
		'form[action*="/cart/add"]:first'								: 'after', // The more powerful selector, which just selects the first product form element
		'form.product-form--payment-button' 							: 'after',
		'product-form.product-form' 									: 'after',
		'form[id*="AddToCartForm"][action*="/cart/add"]' 				: 'after',
		'.product-form form[action*="/cart/add"][is="product-form"]' 	: 'after',
		'form#form_buy[action*="/cart/add"]' 							: 'after',
		//'[data-pf-type="Column"] [data-pf-type="ProductATC"]' : 'after'
	},
	// volume discounts
	showVolumeDiscountBundle: function(removePreviousWidgets) {
		
		if (typeof removePreviousWidgets === 'undefined') {
			removePreviousWidgets = false;
		}
		
				
		var bundleFound = false;
		
		
		
				
					if (bundleFound === false) {
			
				if (bndlr.canShowBundlesAutomatically() === false) {
					return true;
				}
				
				
				// Trigger to display bundle on product page
				var productHandle = nav.getProductHandle();

									if (productHandle === false) {
						if ($('[data-product-handle]').length === 1) {
							// We are in Express theme and product modal is open
							productHandle = $('[data-product-handle]').attr('data-product-handle');
							if (productHandle === null || productHandle === '') {
								productHandle = false;
							}
						}
					}
				
				if (productHandle !== false) {
					// $('.bndlr-automatic').length check makes sure that we don't add bundle widgets on the page too many times if we call the .refresh() method.
					// Except if we set the removePreviousBundles parameter to true, as we want to refresh the bundle widget because of the variant change

					var self = this;
					
					cart.getProductData(nav.getRootUrl(true), productHandle).done(function(productData) {
						
						productData = bndlr.remapProductData(productData);
						
						/*
						// Try to get the variant ID from form so that we can display based on this value 
						// Otherwise, the bndlr.findBundle() method will take the variantId from the URL if there is any
						var selectedVariantId = '';
						var $form = $('form[action*="/cart/add"]');
						
						if ($form.length > 0) {
							// We found the product form 
							// Get the current variant ID
							selectedVariantId = self.getSelectedVariantId($form.first());
						}

						var bundle = bndlr.findBundle(productData.id, productData.variants, true, selectedVariantId);
						*/
						var bundle = bndlr.findBundle(productData.id, productData.variants, true);

						if (bundle !== false && bndlr.canShowBundle(bundle)) {

							var uniqueKey = utils.getRandomString();
							var keySelector = '#_bndl_key_'+uniqueKey;
							
							if (typeof removePreviousWidgets !== 'undefined' && removePreviousWidgets) {
								//$('.bndlr-automatic-volume-bundle').remove();
								var $discountWidgets = $('.bndlr-automatic-volume-bundle');
								for(var x = 0; x < $discountWidgets.length; x++) {

									var $discountWidget = $($discountWidgets[x]);
									if (typeof $discountWidget.attr('data-bndlr-ccid') === 'undefined') {
										// Remove only if the widget wasn't added there with a CCID
										$discountWidget.remove();
										
										/*
										console.log('discountWidget', $discountWidget);
										
										$discountWidget.removeAttr('id');
										$discountWidget.removeAttr('data-bndlr-k');
										$discountWidget.removeAttr('data-variant-id');
										
										$innerElement = $discountWidget.find('.bndlr-volume');
										
										// Don't fully remove the widget so that it doesn't flash
										$innerElement.removeAttr('id');
										$innerElement.removeAttr('data-bndlr-key');
										$innerElement.removeAttr('data-bndlr-variant-id');*/
									}
								}
							}
						
							self.loopThroughVolumeSelectors(function($element, htmlSelector, action) {

								if ($element.length === 1 && $element.closest('#judgeme_product_reviews').length === 0 && $element.closest('.dbtfy-sticky_addtocart').length === 0) {

									if ($element.find('.bundler-volume-target-element').length > 0 || $element.parent().find('.bundler-volume-target-element').length > 0) {
										// Don't add element if it already contains another element
										return false;
									}
									if ($element.closest('.product__content').find('.bundler-volume-target-element').length > 0) {
										// Don't add element if it already contains another element
										return false;
									}
									
									var dataBundleAttr 	= $element.attr('data-bundle');
									
									if (typeof dataBundleAttr === 'undefined' || dataBundleAttr === false) {

										$element[action]('<div id="_bndl_key_'+uniqueKey+'" class="bundler-volume-target-element bndlr-automatic-volume-bundle" data-bundle="' + bundle.id + '" data-bndlr-k="'+uniqueKey+'" data-selector="'+htmlSelector.replace(/"/g, '')+'"></div>');
										
										return false;
									}
								}
							});
							
							
							GlobalUtility.setObserver(keySelector, function() {
								idleCallback(function() {
									self.displayVolumeBundle(bundle, keySelector, productData)
								});
							});
						}
					}).fail(function(error) {
						
						
						var bundle = bndlr.findBundle('', [], true);
						
						var productData = {};
						
						// This code is the same as the one above and should be put in a separate function when I find the time to do it. Apologies for not doing it right now. I just don't want to break anything just before a vacation.
						// This resolves the issue where the volume discount widget didn't show up becuase the product handle was translated into German, but the volume discount was set to target all products in the shop.
						if (bundle !== false && bndlr.canShowBundle(bundle)) {

							var uniqueKey = utils.getRandomString();
							var keySelector = '#_bndl_key_'+uniqueKey;
							
							if (typeof removePreviousWidgets !== 'undefined' && removePreviousWidgets) {
								//$('.bndlr-automatic-volume-bundle').remove();
								var $discountWidgets = $('.bndlr-automatic-volume-bundle');
								for(var x = 0; x < $discountWidgets.length; x++) {

									var $discountWidget = $($discountWidgets[x]);
									if (typeof $discountWidget.attr('data-bndlr-ccid') === 'undefined') {
										// Remove only if the widget wasn't added there with a CCID
										$discountWidget.remove();
									}
								}
							}
						
							self.loopThroughVolumeSelectors(function($element, htmlSelector, action) {

								if ($element.length === 1 && $element.closest('#judgeme_product_reviews').length === 0 && $element.closest('.dbtfy-sticky_addtocart').length === 0) {

									if ($element.find('.bundler-volume-target-element').length > 0 || $element.parent().find('.bundler-volume-target-element').length > 0) {
										// Don't add element if it already contains another element
										return false;
									}
									
									var dataBundleAttr 	= $element.attr('data-bundle');
									
									if (typeof dataBundleAttr === 'undefined' || dataBundleAttr === false) {

										$element[action]('<div id="_bndl_key_'+uniqueKey+'" class="bundler-volume-target-element bndlr-automatic-volume-bundle" data-bundle="' + bundle.id + '" data-bndlr-k="'+uniqueKey+'" data-selector="'+htmlSelector.replace(/"/g, '')+'"></div>');
										
										return false;
									}
								}
							});
							
							
							GlobalUtility.setObserver(keySelector, function() {
								idleCallback(function() {
									self.displayVolumeBundle(bundle, keySelector, productData)
								});
							});
						}
						
					});
				}
			}
			},
    	loopThroughVolumeSelectors: function(callback) {

		for(var selector in this.targetElementSelectors) {
			if (this.targetElementSelectors.hasOwnProperty(selector)) {
				var actionConfig = this.targetElementSelectors[selector];
				var $element = $(selector);
				var action = 'prepend';

				if (typeof actionConfig !== 'string') {
					if (typeof actionConfig.action === 'string') {
						action = actionConfig.action;
					}
					
					if (typeof actionConfig.closest === 'string') {
						$element = $element.closest(actionConfig.closest);
					}

					if (typeof actionConfig.visible_only === 'boolean' && actionConfig.visible_only === true) {
						$element = $element.filter(':visible');
					}
					
					if (typeof actionConfig.first_only === 'boolean' && actionConfig.first_only === true) {
						$element = $element.first();
					}
				} else {
					action = actionConfig;
				}

				if (callback($element, selector, action) === false) {
					break;
				}
			}
		}
	},
	addTrailingZeros: function(num) {
		// Convert the number to a string
		let numStr = num.toString();

		// Check if the number contains a decimal point
		if (numStr.indexOf('.') !== -1) {
			// Split the number into integer and decimal parts
			let parts = numStr.split('.');
			let integerPart = parts[0];
			let decimalPart = parts[1];

			// Add zeros to the decimal part if necessary
			if (decimalPart.length === 1) {
				decimalPart += '0';
			}

			// Combine the integer and decimal parts
			return integerPart + '.' + decimalPart;
		} else {
			// If the number does not contain a decimal point, return it as it is
			return numStr;
		}
	},
	
	displayVolumeBundle: function(bundle, keySelector, productData) {
		
		this.widgetCanBeDisplayed = true;
		
		var bundleKey = utils.getRandomString();
		
		var bundleName = bundle.name.replace('"', '').replace(/<[^>]*>?/gm, '');
		
		var canDisplayBundle = true;

		var variantId = '';
		var totalVariants = 0;
		
		for(var k in bundle.products) {
			if (bundle.products.hasOwnProperty(k)) {
				for (var l in bundle.products[k].variants) {
					if (bundle.products[k].variants.hasOwnProperty(l)) {
						variantId = bundle.products[k].variants[l].id;
						totalVariants += 1;
					}
				}
			}
		}
		
		if (totalVariants != 1) {
			variantId = ''; // More then one variant
			
			if (typeof productData === 'undefined') {

				try {

					if (typeof window.__pageflyProducts !== 'undefined') {
						var pageflyProducts = window.__pageflyProducts;
						for (var pageflyProductId in pageflyProducts) {
							if (pageflyProducts.hasOwnProperty(pageflyProductId)) {
								// Get selected variant from pagefly
								var pageflyVariant = pageflyProducts[pageflyProductId].selected_or_first_available_variant;

								if (typeof pageflyVariant !== 'undefined' && typeof pageflyVariant.id !== 'undefined') {
									var pageflyVariantId = pageflyVariant.id;
									
									// Loop through products in the volume discount and get the same variant (if in the bundle)
									for(var k in bundle.products) {
										if (bundle.products.hasOwnProperty(k) && k == pageflyProductId) {
											// Loop through variant of this product
											for (var l in bundle.products[k].variants) {
												if (bundle.products[k].variants.hasOwnProperty(l)) {
													// Check if we have the same variant in here. 
													if (bundle.products[k].variants[l].id == pageflyVariantId) {
														variantId = bundle.products[k].variants[l].id
													}
												}
											}
										}
									}
								}
							}
						}
					}
				} catch(e) {
					console.log(e);
				}
			} else {
				// Use productData (if not undefined) to get the variant ID if there is only one variant in product
				if (typeof productData.variants !== 'undefined' && productData.variants.length === 1) {
					variantId = productData.variants[0].id;
				}
			}
		}
		
		try {
			var titleTagName = 'h2';
						
			var bundleHtml = ''+
				'<div id="_bndl_'+bundleKey+'" class="bndlr-volume" data-bndlr-key="'+bundleKey+'" data-bundle-name="'+ bundleName +'" data-bndlr-variant-id="' + variantId + '">' + 
					'<'+titleTagName+' class="bndlr-volume-title">'+ bundle.title +'</'+titleTagName+'>' +
					'<div class="bndlr-volume-description">'+ bundle.description +'</div>' +
						'<div class="bndlr-volume-discounts">';

						for (var r = 0; r < bundle.volume_discounts.length; r++) {
							var volumeDiscount = bundle.volume_discounts[r];
							var hasSavingsText = volumeDiscount.savings_text.length > 0 ? true : false;
							
							var currencySymbol = '';
							
							var discountUnit = '';
							if (typeof Shopify !== 'undefined' && typeof Shopify.currency !== 'undefined' && typeof Shopify.currency.active === 'string') {
								//discountUnit = Shopify.currency.active;
								currencySymbol = utils.getPredefinedCurrencySymbol(Shopify.currency.active);
								if (currencySymbol === '') {
									currencySymbol = utils.getCurrencySymbol(Shopify.currency.active);
								}
							}
							
							discountUnit = currencySymbol;
							
							if (volumeDiscount.discount_type === 'percentage') {
								discountUnit = '%';
							}
							
							var maxQuantity = '';
							if (volumeDiscount.range_type === 'range' && volumeDiscount.max_items !== null) {
								maxQuantity = volumeDiscount.max_items
							}
							
							var minCartValue = '';
							if (volumeDiscount.range_type === 'min_cart_value') {
								minCartValue = bndlr.formatPrice(volumeDiscount.min_cart_value*100); // volumeDiscount.min_cart_value+' '+currencySymbol;
							}
							
							var keyValue = {
								'quantity' 			: volumeDiscount.min_items,
								'max_quantity' 		: maxQuantity,
								'discount_value' 	: this.addTrailingZeros(volumeDiscount.discount_value),
								'discount_unit' 	: discountUnit,
								'min_value'			: minCartValue
							};
							
							var extraClass = '';
							if (hasSavingsText) {
								extraClass = ' bndlr-has-savings-text ';
							}
							
							var quantityAttribute = '';
							if (volumeDiscount.min_items !== '') {
								quantityAttribute = 'data-quantity="'+volumeDiscount.min_items+'"';
							}
							
							if (volumeDiscount.max_items !== '' && volumeDiscount.max_items !== null) {
								quantityAttribute += ' data-quantity-max="'+volumeDiscount.max_items+'"';
							}
							
							bundleHtml += '<div class="bndlr-volume-discount bndlr-volume-style-0 '+extraClass+'" '+quantityAttribute+'>';
							
								bundleHtml += '<div class="bndlr-volume-main-text">' +
									GlobalUtility.liquidReplaceMulti(volumeDiscount.description, keyValue) + 
								'</div>';
								
								
								// Show savings text
								if (hasSavingsText) {
									bundleHtml += '<div class="bndlr-volume-saving-text">' +
										GlobalUtility.liquidReplaceMulti(volumeDiscount.savings_text, keyValue) + 
									'</div>';
								}


							bundleHtml += '</div>';
						}
					bundleHtml += '</div>';
					
										
				bundleHtml += '</div>';
		
		} catch(e) {
			bundlerConsole.log(e);
			canDisplayBundle = false;
		}
	
		
		
		if (canDisplayBundle === false) {
			bundlerConsole.log('Skipping bundle', bundle.name);
			return true;
		}
		
		$element = $(keySelector);
		
		if ($element.length > 0) {
			var $bundle = $(bundleHtml);
			$element.html($bundle);
		}
		
		idleCallback(function() {
			
			$(document).trigger('bundler_bundle_widget_created');
		
			try {
				var event = new CustomEvent("bundler:bundle_widget_created", {
					detail: {
						products: []
					}
				});
				document.dispatchEvent(event);
			} catch(e) {
				bundlerConsole.log(e);
			}
			
		}.bind(bndlr));
		
		this.showHideVolumeDiscountWidget($element, keySelector);
		
		
	},
	showHideVolumeDiscountWidget: function($widget, keySelector) {		
		// Get form element 
		// Get selected variant 
		// Assign it's value to the attribute on widget 
		// Show/hide the widget based on it's value 
		// Set up event listeners and update this when the selected variant changes
		
		// Get form element 
		var $form = this.getFormElement($widget);

		if ($form !== null) {
			// Get selected variant 
			var selectedVariantId = this.getSelectedVariantId($form);

			
			if (selectedVariantId !== null) {
				// Assign it's value to the attribute on widget 
				$widget.attr('data-variant-id', selectedVariantId);
				
				// Show/hide the widget based on it's value
				this.showHideWidget($widget, selectedVariantId);
				
				var self = this;
				// Listener should be set up only on the first call
				this.setVariantMutationObserver($form, keySelector, function(vid) {
					// 
					self.showHideWidget($widget, vid);
					self.showVolumeDiscountBundle(true); // Added on 2023-06-13 (braithwaite-gallery)
				});
			}
		}
	},
	setVariantMutationObserver: function($form, keySelector, callback) {
		try {

			var mutationCallback = function(mutationsList, observer) {

				// SELECT
				// Make sure that the attribute was changed
				if (typeof mutationsList[0] !== 'undefined' && 
					mutationsList[0].type === 'attributes' &&
					typeof mutationsList[0].attributeName === 'string' && 
						mutationsList[0].attributeName === 'selected') {
						
						// debounce
						debounce('variant_changed'+keySelector, function() {
							var $selector = $(mutationsList[0].target).closest('select');
							var name = $selector.attr('name');

							if (name === 'id') {
								var selectedVariant = $selector.val();
								if (typeof selectedVariant !== 'undefined') {
									callback(selectedVariant);
								}
							}
						}, 100);
						
						
						// INPUT
					} else if (typeof mutationsList[0] !== 'undefined' && 
					
					// Check if this is input element
					typeof mutationsList[0].target === 'object' && 
					typeof mutationsList[0].target.tagName === 'string' && 
						mutationsList[0].target.tagName === 'INPUT' && 
					
					// Checkif this is the input element with the ID name
					typeof mutationsList[0].target === 'object' && 
					typeof mutationsList[0].target.name === 'string' && 
						mutationsList[0].target.name === 'id' && 
					
					// Check if the value or data-value attribute was changed
					typeof mutationsList[0].type === 'string' && 
						mutationsList[0].type === 'attributes' && 
					typeof mutationsList[0].attributeName === 'string' && 
						(mutationsList[0].attributeName === 'value' || mutationsList[0].attributeName === 'data-value')) {

																				// debounce
							debounce('variant_changed'+keySelector, function() {
								var $input = $(mutationsList[0].target);
								var selectedVariant = $input.val();

								if (typeof selectedVariant !== 'undefined') {
									callback(selectedVariant);
								}
							}, 100);
												
					}
			};

			var observer = new MutationObserver(mutationCallback);

			var selectors = [
				'select[name="id"]', // Should only be used for select elements in the form
				'input[name="id"][type="hidden"]', // Should only be used for hidden elements, as these get the value change
				'input[name="id"][style="display: none;"]', // Should only be used for hidden elements, as these get the value change
				'input[name="id"][hidden]' // Should only be used for hidden elements, as these get the value change
			];
			
			// loop through cart drawers and set the observers
			for(var si = 0; si<selectors.length; si++) {
				var elmnts = $form.find(selectors[si]);
				if (elmnts.length) {
					for (var sj = 0; sj<elmnts.length; sj++) {
						observer.observe(elmnts[sj], {attributes: true, childList: true, subtree: true});
					}
				}
			}
			
		} catch(e) {
			console.log(e);
		}
	},
	showHideWidget: function($widget, variantId) {
		// Check if this variant is in this bundle 

		var bundleId = $widget.attr('data-bundle');
		var bundle = bndlr.getBundleById(bundleId);
		
		if (this.canShowVolumeWidget(bundle, variantId)) {
			// Can show widget 
			$widget.show();
		} else {
			console.log('cant show widget', variantId);
			// Can't show widget
			$widget.hide();
		}
		
	},
	canShowVolumeWidget(bundle, variantId) {
		if (bundle.product_target_type === 'all_products') {
			return true;
		}

		if (variantId === '') { // This caused an issue in thompsonferrier where the volume discount widget got hidden because variant ID was an empty string.
			return true;
		}

		if (typeof bundle.products !== 'undefined') {
			for (var k in bundle.products) {
				if (bundle.products.hasOwnProperty(k)) {
					for(var j in bundle.products[k].variants) {
						if (bundle.products[k].variants.hasOwnProperty(j)) {
							if (bundle.products[k].variants[j].id === variantId) {
								return true;
							}
						}
					}
				}
			}
		}
		
				
		return false;
		
	},
	getSelectedVariantId: function($form) {
		var formDataString = $form.serialize();

		if (formDataString.length > 0) {
			var formDataObject = this.queryStringToObject(formDataString);

			if (typeof formDataObject.id === 'undefined') {
				var pageflyWrapper = $form.closest('[data-default-variant]');
				if (pageflyWrapper.length > 0) {
					var variantId = pageflyWrapper.attr('data-default-variant');
					if (typeof variantId !== 'undefined' && variantId !== '') {
						formDataObject.id = variantId
					}
				}
			}
			
			
			if (typeof formDataObject.id !== 'undefined') {
				return formDataObject.id;
			}
		}
			
		return null;
	},
	getFormElement: function($widget) {
		//var $widget = $(keySelector);

		var $parent = $widget.parent();
		if ($parent.is('form')) {
			var $form = $parent;
		} else {
			var $form = $parent.find('form');

			if ($form.length === 0) {
				$form = $parent.closest('form');
			}
			
			var $appBlock = $widget.closest('.shopify-app-block');
			if ($appBlock.length > 0) {
				$form = $appBlock.parent().find('form[data-type="add-to-cart-form"]');
			}
		}
		
		var config = [
			{
				p: '.product-single__box',
				c: 'form.product-form[action="/cart/add"]'
			}, {
				p: '.product-detail__detail',
				c: 'form[action="/cart/add"]'
			}
		];
		
		if ($form.length === 0) {
			// product-single__box
			for(var l = 0; l < config.length; l++) {
				var conf = config[l];
				
				var $closest = $widget.closest(conf.p);
				if ($closest.length > 0) {
					var child = $closest.find(conf.c);
					
					if (child.length > 0) {
						$form = child; 
						l = config.length; // Stop the loop 
					}
				}
			}
		}

		if ($form.length > 0) {
			return $form;
		}
		
		return null;
	},
	queryStringToObject: function(queryString) {
		var i = 0;
		var values = {};
		var params = queryString.split("&");

		for (i=0;i<params.length;i++) {
			val = params[i].split("=");
			var key 	= decodeURIComponent(val[0]);
			var value 	= decodeURIComponent(val[1]);
			values[key] = value;
		}
		return values;
	},
	extractProperties: function(queryString) {
		var i = 0;
		var values = {};
		var params = queryString.split("&");

		for (i=0;i<params.length;i++) {
			val = params[i].split("=");
			var key 	= decodeURIComponent(val[0]);
			var value 	= decodeURIComponent(val[1]);
			
			if (key.indexOf('properties') !== -1) {
				key = key.replace('properties[', '').replace(']', '');
				
				values[key] = value;
			}
		}
		return values;
	},
	init: function() {
				
				
		if (typeof clientSpecifics['volume_discounts_modify_selectors'] !== 'undefined') {
			this.targetElementSelectors = clientSpecifics['volume_discounts_modify_selectors'].modify(this.targetElementSelectors);
		}
		
		document.addEventListener('bundler:bundle_widget_created', function() {
			debounce('volume-bundle-widget-created-listener', function() {

				if (
					$('.bundler-volume-target-element .bndlr-volume-main-text').first().height() === 0 
					&& $('.bundler-volume-target-element .bndlr-volume-main-text').first().text() !== ''
					&& $('.bundler-volume-target-element .bndlr-volume-main-text').length > 0

				) {
					// Font size set by theme is probably 0. Set font size!
					$('.bundler-volume-target-element').css({'font-size':'16px', 'line-height': '1.5'});
				}
				if (
					$('.bundler-volume-target-element .bndlr-volume-title').first().height() === 0 
					&& $('.bundler-volume-target-element .bndlr-volume-title').first().text() !== ''
					&& $('.bundler-volume-target-element .bndlr-volume-title').length > 0

				) {
					// Font size set by theme is probably 0. Set font size!
					$('.bundler-volume-target-element').css({'font-size':'16px', 'line-height': '1.5'});
				}
			});
		});
				
				
				
		/*
			function queryStringToObject(queryString) {
				var i = 0;
				var values = {};
				var params = queryString.split("&");

				for (i=0;i<params.length;i++) {
					val = params[i].split("=");
					values[val[0]] = val[1];
				}
				return values;
			}
			*/
			
			var self = this;
			
			var volumeButtonSelector = '.bndlr-volume-discount .bndlr-volume-saving-text';
			
					
			$(document).on('click', volumeButtonSelector, function(e) {
								
				e.stopPropagation();
				e.stopImmediatePropagation();

				var $el = $(this);
				var $quantEl = $el.closest('[data-quantity]');
				if ($quantEl.length === 1) {
					var quantity = $quantEl.attr('data-quantity')*1;
					
					// TODO Use the this.getFormElement() method to get the form element through one function
					var $parent = $quantEl.closest('.bundler-volume-target-element').parent();
					if ($parent.is('form')) {
						var $form = $parent;
					} else {
						var $form = $parent.find('form[action*="/cart/add"]');
						
						if ($form.length === 0) {
							$form = $parent.closest('.product-page--right-column').find('form[action="/cart/add"]');
						}
						
						if ($form.length === 0) {
							$form = $parent.closest('product-info').find('product-form form[action="/cart/add"] .product-form__buttons').closest('form[action="/cart/add"]');
						}
						
						if ($form.length === 0) {
							$form = $parent.closest('form[action*="/cart/add"]');
						}
						
						if ($form.length === 0) {
							if ($parent.closest('.pf-c').length > 0) {
								// It appears that we are in Pagefly 
								// Try to get the selected variant from the dropdown selector 
								
								var $PfVariantSelector = $parent.closest('.pf-c').find('.pf-variant-select');
								
								if ($PfVariantSelector.length === 1) {
									var variantId = $PfVariantSelector.val();
									
									if (typeof variantId !== 'undefined') {
										$form = $('<form action="/cart/add"><input name="id" value="'+variantId+'" /></form>');
									}
								}
							}
						}

						var $appBlock = $quantEl.closest('.shopify-app-block');
						if ($appBlock.length > 0 && $form.length === 0) {
							$form = $appBlock.parent().find('form[data-type="add-to-cart-form"]');
						}

						if ($form.length === 0) {
							$form = $parent.closest('.product__section-details').find('form[action*="/cart/add"]');
						}
						
						if ($form.length === 0) {
							$form = $parent.closest('.product-info').find('form[action*="/cart/add"]:not([id^="complementary-product-"])');
						}
						
						if ($form.length === 0) {
							$form = $parent.closest('.index-sections').find('.featured-product-section form[action*="/cart/add"]');
						}
						
						if ($form.length === 0) {
							$form = $parent.closest('.product-single__details').find('form[action*="/cart/add"][id^="AddToCartForm--template--"]');
						}
						if ($form.length === 0) {
							$form = $parent.closest('.product-single__primary-blocks').find('form[action*="/cart/add"].product-form--single');
						}
						if ($form.length === 0) {
							$form = $parent.closest('.m-product-info--wrapper').find('form[action*="/cart/add"]');
						}
						if ($form.length === 0) {
							$form = $parent.closest('#callBackVariant_ppr').find('form#cart-form_ppr');
						}
						
													if ($form.length === 0) {
								$form = $parent.closest('body').find('form[action*="/cart/add"]');
							}
											}

					// 
											if (($form.length === 0 || ($el.closest('[data-bndlr-ccid]').length === 1 || $form.find('[name="id"]').length === 0) && $el.closest('[data-bndlr-variant-id]').length === 1)) {

							// Form wasn't found 
							// Try to get the variant info from the volume discount widget
							var $volumeDiscountWidget = $el.closest('.bndlr-volume[data-bndlr-variant-id]');
							var variantId = $volumeDiscountWidget.attr('data-bndlr-variant-id');
							
							if (typeof variantId !== 'undefined' && variantId !== '') {
								$form = $('<form action="/cart/add"><input name="id" value="'+variantId+'" /></form>');
							}
						}
					
					if ($form.length > 0) {
						
						var formDataString = $form.serialize();
						
						if (formDataString.length > 0) {

							var formDataObject = self.queryStringToObject(formDataString);
							
							var properties = self.extractProperties(formDataString);
							if (Object.keys(properties).length > 0) {
								formDataObject['properties'] = properties;
							}
							
							if (typeof formDataObject.quantity === 'undefined' || formDataObject.quantity < quantity) {
								formDataObject.quantity = quantity;
							}
							
							if (typeof formDataObject.id === 'undefined') {
								var pageflyWrapper = $form.closest('[data-default-variant]');
								if (pageflyWrapper.length > 0) {
									var variantId = pageflyWrapper.attr('data-default-variant');
									if (typeof variantId !== 'undefined' && variantId !== '') {
										formDataObject.id = variantId
									}
								}
							}
							
														
							if (typeof formDataObject.id === 'undefined') {
								var $volumeDiscountWidget = $el.closest('.bndlr-volume[data-bndlr-variant-id]');
								var variantId = $volumeDiscountWidget.attr('data-bndlr-variant-id');
								
								if (typeof variantId !== 'undefined') {
									formDataObject.id = variantId
								}
							}
							
														
							
							if (typeof formDataObject.id !== 'undefined') {
							
								$el.addClass('bndlr-loading');
								
								var url = $form.attr('action');
								
																
								return fetch(url, {
									method: 'POST',
									cache: 'no-cache',
									credentials: 'same-origin',
									headers: {
										'Content-Type': 'application/json'
										//'Content-Type': 'application/x-www-form-urlencoded',
									},
									redirect: 'follow',
									referrerPolicy: 'no-referrer',
									body: JSON.stringify(formDataObject)
								}).then(function(data) {
									// After add to cart
									
																		
									try {
										setTimeout(function () {
											// Set a timeout to remove the loading spinner in case the customer comes back in Chrome
											$el.removeClass('bndlr-loading');
										}, 5000);
									} catch(e) {}
									
																			bndlr.prepareInvoice(false);
																	}).catch(function(e) {
									console.log('bundler add to cart FAILED', e);
								});
							}
						}
					}
				}
			});
			
			
				
		
				
				
		
		
		$(document).on('click', 'variant-radios label, .swatch-element label, .swatch-element, .variant__button-label, fieldset.product-form__input label, .option-selector__btns .opt-label, fieldset.single-option-radio label[for^="ProductSelect-option-template--"], [data-swatch-option], .product-form .block-swatch label, .product__selectors[data-product-variants] .radio__button label, [class*="#product-options-radio"] [class*="#product-options-radio-item-body"], .size-container .size-container__option', function() {
			// Variant select changed
			// Find the correct bundle
			debounce('refresh-volume-discount-widget', function() {
				VolumeDiscounts.showVolumeDiscountBundle(true);
			}, 250);
		});
		
		$(document).on('change', 'select.single-option-selector', function() {			
			// Variant select changed
			// Find the correct bundle
			debounce('refresh-volume-discount-widget', function() {
				VolumeDiscounts.showVolumeDiscountBundle(true);
			}, 250);
		});
	}
};			
						
			var errorHandler = {
				displayError: function(message, bundleId) {
					var $bundleContainer = $('.bundler-target-element[data-bundle="'+bundleId+'"]');
					
					if ($bundleContainer.length === 0) {
						return true;
					}
					
					if ($bundleContainer.find('.bndlr-error').length === 0) {
						$bundleContainer.append('<div class="bndlr-error"></div>');
						$bundleContainer.attr('data-bundle-widget-status', 'error');
					}
					
					$bundleContainer.find('.bndlr-bundle-loading').remove();
					
					$bundleErrorContainer = $bundleContainer.find('.bndlr-error').first();
					
					var hash = this.getHash(message);
					if ($bundleErrorContainer.find('span[data-hash="'+hash+'"]').length === 0) {
						$bundleErrorContainer.append('<span data-hash="'+hash+'">' + message+'</span><br />');
					}
					
					
				},
				getHash: function(string) {
					var hash = 0, i, chr;
					if (this.length === 0)  {
						return hash;
					}
					var chr = 0;
					for (var i = 0; i<string.length; i++) {
						chr = string.charCodeAt(i);
						hash  = ((hash << 5) - hash) + chr;
						hash |= 0; // Convert to 32bit integer
					}
					
					return 'h'+hash;					
				}
			}

			// Queue for handling multiple ajax requests and triggering callback after they are all finished
			var queue = {
				queue: {},
				add: function(key, action, afterFinish) { // The last parameter tells us what todo at the end. If we pass undefined, then the one who passes a function will overwrite it.
				
					if (typeof this.queue[key] === 'undefined') {
						this.queue[key] = {
							finish: afterFinish,
							q: [],
							tick: 0
						};
					}

                    if (typeof this.queue[key].finish === 'undefined' && typeof afterFinish !== 'undefined') {
						this.queue[key].finish = afterFinish;
					}
					
					this.queue[key].q.push(action);
				},
				process: function(key) {
					if (typeof this.queue[key] !== 'undefined') {
						var total = this.queue[key].q.length;
						
						var tick = this.queue[key].tick;
						if (typeof this.queue[key].q[tick] !== 'undefined') {
							this.queue[key].q[tick]();
						}
					}
				},
				tick: function(key) {
					if (typeof this.queue[key] !== 'undefined') {
						this.queue[key].tick++;
						
						if (this.queue[key].tick === this.queue[key].q.length) {
							this.queue[key].finish();
							
							delete this.queue[key];
						} else {
							this.process(key);
						}
					}
				},
				cancel: function(key) {
					delete this.queue[key];
				}
			};
			
			
			if (typeof clientSpecifics['before_init'] !== 'undefined') {
				// Useful for disabling the app based on custom logic (e.g. wholesale customers, etc.)
				clientSpecifics['before_init'].trigger();
			}
			
						
			
			
				// completelyDisableBundlerApp allows merchants to disable the app based on a custom logic (e.g. wholesale customers, etc.)
				if (typeof window.completelyDisableBundlerApp === 'undefined' || window.completelyDisableBundlerApp === false) {
				
					idleCallback(bndlr.init.bind(bndlr));
					
					if (typeof window.bndlrPOS === 'undefined') {
						idleCallback(function() {
							debounce('bundlr_refresh', function() {
								// Debounce this call so that if the document changes into a ready state, the bundles don't show up twice
								bndlr.showBundle.bind(bndlr)();
							}, 100);
						});
													idleCallback(VolumeDiscounts.init.bind(VolumeDiscounts));
							idleCallback(VolumeDiscounts.showVolumeDiscountBundle.bind(VolumeDiscounts));
												
						idleCallback(DiscountEstimator.showPopup.bind(DiscountEstimator));
						
											}

				} else {
					bundlerConsole.log('Bundler app was disabled via JavaScript variable completelyDisableBundlerApp');
				}
						
			// These are publicly exposed methods, which can be used by other apps and integrations
			// methods which start with an underscore (_) are meant for internal usage between different app components
			window.bndlr = {
				checkout				: bndlr.prepareInvoice,
				goToCheckout			: (function() {bndlr.prepareInvoice(undefined, undefined, false);}),
				canUseCheckout			: bndlr.canUseCheckout,
				setCheckoutParams		: bndlr.setCheckoutParams,
				preventBundlerCheckout	: bndlr.preventBundlerCheckout,
				enableBundlerCheckout	: bndlr.enableBundlerCheckout,
				outputBundles			: bndlr.outputBundles,
				outputProductUrls		: bndlr.outputProductUrls,
				getProductUrls			: bndlr.getProductUrls,
				getBundles				: bndlr.getBundles,
				fixCartPrices			: bndlr.fixCartPrices,
				resetIsInShowBundle		: bndlr.resetIsInShowBundle,
				refresh					: (function() {bndlr.showBundle.bind(bndlr)();}),
				refreshVolumeDiscounts	: (function() {
											idleCallback(VolumeDiscounts.showVolumeDiscountBundle.bind(VolumeDiscounts));
									}),
				getCheckoutInfo			: bndlr.getCheckoutInfo,
				updateCartDiscounts		: (function() {DiscountEstimator.updateCartDiscounts(true); }),
				updateCartWithDiscounts	: function(cart) {
					return DiscountEstimator.updateCartWithDiscounts.bind(DiscountEstimator)(cart)
				},
				getProductConfig		: function() {
					return Library.Products.get();
				}
			};
			
			/*
			// Refresh the bundler again, as some themes sometimes don't show the widget. It might be that the page gets rerendered.
			setTimeout(function() {
				window.bndlr.refresh();
			}, 1500);
			*/
			
						
												// This caused an issue where the bundle was displayed twice.
					if (document.readyState !== 'complete') {
						// Set up the document ready listener only if the document state wasn't yet complete 
						$(document).ready(function() {
							debounce('bundlr_refresh', function() {
								window.bndlr.refresh();
								window.bndlr.refreshVolumeDiscounts();
							}, 1000);
						});
					}
										
			
			if (typeof window.opcLoadCart === 'function') {
				window.opcLoadCart = function() {
					window.bndlr.checkout();
				}
			}
			
			// Add the removeBundledItemsFromCart method to the collection of internal functiona so we can use it in the funnels functionality
			_internalFunctionCollection['removeBundledItemsFromCart'] 					= (function(items) {DiscountEstimator.removeBundledItemsFromCart.bind(DiscountEstimator)(items);});
			_internalFunctionCollection['removeBundledItemsFromCartForScopedBundles'] 	= (function(items, scopedBundles) {DiscountEstimator.removeBundledItemsFromCartForScopedBundles.bind(DiscountEstimator)(items, scopedBundles);});
			_internalFunctionCollection['canShowBundle'] 								= bndlr.canShowBundle.bind(bndlr);
			
			Object.freeze(window.bndlr);
			
			
			
			var event = new CustomEvent("bundler:loaded");
			document.dispatchEvent(event);
			
			document.addEventListener('bundlerPOS:triggerPOSsystem', function() {
				if (typeof window.bndlrPOS !== 'undefined') {
					window.bndlrPOS.init(bndlr, bundles, DiscountEstimator, queue);
					
					if (typeof window.bndlrPOSShowBundles !== 'undefined' && window.bndlrPOSShowBundles === true) {
						try {
							window.bndlr.refresh();
						} catch(e) {
							if (typeof window.log === 'function') {
								window.log(e.message);
							}
						}
					}
				}
			});
			
			if (typeof window.bndlrPOS !== 'undefined') {
				window.bndlrPOS.init(bndlr, bundles, DiscountEstimator, queue);

				if (typeof window.bndlrPOSShowBundles !== 'undefined' && window.bndlrPOSShowBundles === true) {
					try {
						idleCallback(bndlr.showBundle.bind(bndlr));
					} catch(e) {
						if (typeof window.log === 'function') {
							window.log(e.message);
						}
					}
				}
			}
			
						
			
			function ClassChangeObserver() {};

ClassChangeObserver.prototype.observe = function(modalSelectors) {
	try {
		// loop through selectors and set observers
		for (var key in modalSelectors) {
			if (modalSelectors.hasOwnProperty(key)) {
				var modals = $(key);
				
				if (modals.length) {
					
					var observedClass 	= modalSelectors[key].observedClass;
					var callback 		= modalSelectors[key].callback;
					
					var observedAttribute = {
						name		: '',
						oldValue	: ''
					};
					if (typeof modalSelectors[key].observedAttribute !== 'undefined') {
						observedAttribute = modalSelectors[key].observedAttribute;
					}
					
					var mutationCallback = function(mutations, observer) {
						try {
							mutations.forEach(function(mutation) {
								
								if (observedAttribute.name != '') {
									if (mutation.attributeName == observedAttribute.name) {
										// Check if the oldValue of the mutation was the one defined in the observer
										var oldValue 		= mutation.oldValue;

										if (oldValue !== null || (typeof observedAttribute.canBeNull === 'boolean' && observedAttribute.canBeNull === true)) {
											if (oldValue === null) {
												oldValue = '';
											}
											var prevState 		= oldValue.indexOf(observedAttribute.oldValue) !== -1 ? true : false;
											
											if(prevState) {
												// Run callback
												callback();
											}
										}
									}
								} else if(mutation.attributeName == "class"){
									var oldValue 		= mutation.oldValue;
									var prevState 		= oldValue.indexOf(observedClass) !== -1 ? true : false;
									var currentState 	= mutation.target.classList.contains(observedClass);
									
									if(currentState !== prevState) {
										if (currentState) {
											// Run callback
											callback();
										}
									}
								}
								
								
							});
						} catch(e) {
							console.log(e);
						}
					};

					var observer = new MutationObserver(mutationCallback);
					
					for (var j = 0; j<modals.length; j++) {
						observer.observe(modals[j], {attributes: true, attributeOldValue: true});
					}
				}
			}
		}
		
	} catch(e) {
		console.log(e);
	}
}
	
var ClassChangeObserver = new ClassChangeObserver();
			
						
						
						
						
		};
		
		function getA() {
			return navigator.userAgent;
		}
		
		function getCharsX() {
			return String.fromCharCode(105)+'g'+String.fromCharCode(104);
		}
		
						
				
		var forcejQuery = false;
		
				
				forcejQuery = true; // Force out jQuery as it turns out that some newer jqueries don't work
		
		var versionMatches = true;
		if (typeof jQuery === 'undefined' || typeof jQuery.fn === 'undefined' || (parseFloat(jQuery.fn.jquery) < 3) || parseFloat(jQuery.fn.jquery) === 3.3 || (parseFloat(jQuery.fn.jquery) >= 3.4)) {
			versionMatches = false;
		}

				
		if (forcejQuery || (typeof jQuery === 'undefined') || (typeof jQuery.fn === 'undefined') || versionMatches === false || typeof jQuery.ajax === 'undefined') {
							var jqueryUrl = '//ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js';
						
						
			
			loadScript(jqueryUrl, function(){

				jQuery341 = jQuery.noConflict(true);
				bundler(jQuery341);
				if (typeof BundlerPromotions === 'function') {
					BundlerPromotions(jQuery341);
				}
			});
		} else {
			bundler(jQuery);
			
			if (typeof BundlerPromotions === 'function') {
				BundlerPromotions(jQuery);
			}
		}
		
				
		// Mark bundler as loaded
		window.bundlerLoaded2 = true;
		
		} catch(e) {
			console.log(e.message);
					}
	})();
}
