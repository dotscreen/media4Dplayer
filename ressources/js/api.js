var API = {};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getConfig = function(callback_function){
    json.load({
        url: "ressources/json/config.json",
        callback: function(data) {
			Config = data;
			callback_function();
        }
    });
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.loadConfigurationSet = function(callback_function){
	json.load({
        url: Config.perfectMemoryWS + "configuration/sets",
		headers: {
			"Accept-language":"fr"
		},
        callback: function(data) {
			if(typeOf(callback_function) === "function"){
				callback_function(data);
			}
        }
    });
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getUserTokens = function(callback_function){
	json.load({
        url: Config.perfectMemoryWS + "tokens",
		type:"post",
		headers: {
		    "Authorization": "Basic " + btoa("guest:fEjebruph3zA")
		},
        callback: function(data) {
			if(typeOf(data) === "object"){
				User.tokens = data;
			}

			if(typeOf(callback_function) === "function"){
				callback_function();
			}
        },
		onError:function(){

		}
    });
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getFavorites = function(callback_function){
	if(typeOf(callback_function) === "function"){
		Navigation.blockNavigation = true;
		json.load({
			url: Config.perfectMemoryWS + "medias?auth_token=" + User.tokens.auth_token + "&types=movie&max_count=10&offset=0&sort_fields=created_at",
			callback: function(data) {

				if(typeOf(data) === "array" && data.length){

					// Génère une liste d'ID
					var ids = [], positions = [], x, dl = data.length;
					for(x=0;x<dl;x++){
						ids.push({FTV_UID:data[x].root_id});
						positions.push(data[x].root_id);
					}

					// Charge les items les uns après les autres (la méthode when/then tombe en fail si l'une des requetes échoue)
					API.getItemsListForSearch(10, ids, function(list){
						if(list.length){

							// Rétablie les positions
							var sortedList = [];
							for(var i=0;i<positions.length;i++){

								// Si l'item se trouve dans la nouvelle list l'insère dans la liste triée
								for(var z=0;z<list.length;z++){
									if(list[z].root_id === positions[i]){
										sortedList.push(list[z]);
									}
								}
							}

							Model.getResults(sortedList, function(favorites){
								callback_function({favorites:favorites});
							});

						}else{
							callback_function();
						}
						Navigation.blockNavigation = false;
					});
				}else{
					callback_function();
				}
			},
			headers: {
				"Accept-language":"fr"
			}
		});
	}
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.autocomplete = function(term, method, callback_function){
	if(method === "content"){
		json.load({
			url: Config.TSPWS,
			callback: function(data) {
				if(typeOf(callback_function) === "function"){
					callback_function(data);
				}
			},
			type:"post",
			data:{type:"autocomplete",phrase:term},
			contentType:"application/x-www-form-urlencoded"
		});

	}else if(typeOf(callback_function) === "function"){
		callback_function();
	}
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getTermsOfAffination = function(term, method, callback_function){
	if(method === "content"){
		json.load({
			url: Config.TSPWS,
			callback: function(data) {
				Model.getTermsOfAffination(method, data, callback_function);
			},
			type:"post",
			data:{type:"wordCloud",phrase:term},
			contentType:"application/x-www-form-urlencoded"
		});

	}else if(typeOf(callback_function) === "function"){
		callback_function();
	}
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getResults = function(params, method, callback_function){
	if(typeOf(callback_function) === "function" && typeOf(params) === "object"){
		if(method === "content"){
			json.load({
				url: Config.TSPWS,
				callback: function(data) {

					// Doit enlever les doublons
					data = removeDuplicateItemInList(data, "FTV_UID");

					// Charge les items les uns après les autres (la méthode when/then tombe en fail si l'une des requetes échoue)
					API.getItemsListForSearch(Config.limitResultForSearch, data, function(list){
						if(list.length){
							Model.getResults(list, callback_function);

						}else{
							callback_function();
						}
					});
				},
				type:"post",
				data:params,
				contentType:"application/x-www-form-urlencoded"
			});

		}else{
			callback_function();
		}
	}
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getItemsListForSearch = function(limit, data, callback){

	var list = [];
	if(typeOf(data) === "array" && limit && typeOf(callback) === "function"){

		// Mémorise la position du texte dans les ST
		var subtitleWordPos = {};

		var l = data.length, count = 0;
		var _onLoadMediaData = function(jqXHR, textStatus){
			if(textStatus === "success" && jqXHR.responseJSON){

				var data = jqXHR.responseJSON;
				var _onLoadTitle = function(title){
					if(title){
						data.title = title;
						if(typeOf(data.types) === "array"){
							for(var i=0;i<data.types.length;i++){
								if(["audiovisual_programme","documentary","info_magazine"].indexOf(data.types[i]) !== -1){
									data.subWordPos = subtitleWordPos[data.root_id];
									break;
								}
							}
						}
						//data.subWordPos = typeOf(data.types) === "array" && ["audiovisual_programme","documentary","info_magazine"].indexOf(data.types) !== -1 ? subtitleWordPos[data.root_id] : null;
						list.push(data);
					}else{
						log("L'item avec ce label n'a pas de titre : "+data.label);
					}
					count++;
					if(count === l || count === limit){
						callback(list);
					}
				};

				// Fait une requete pour récuperer le titre du programme
				API.getProgramTitle(data.id, _onLoadTitle);

			}else{
				count++;
				if(count === l || count === limit){
					callback(list);
				}
			}
		};

		// Récupère les infos du programme
		var i, media;
		for(i=0;i<data.length&&i<limit;i++){
			media = data[i];

			if(typeOf(media.morceaux_soustitre) === "array" && typeOf(media.morceaux_soustitre[0]) === "object" && media.morceaux_soustitre[0].capBegin && media.morceaux_soustitre[0].capEnd){
				subtitleWordPos[media.FTV_UID] = media.morceaux_soustitre[0];
			}
			if(typeOf(media) === "object" && media.FTV_UID){
				$.ajax({
					url: Config.perfectMemoryWS + "medias/root_id:"+media.FTV_UID+"?auth_token=" + User.tokens.auth_token,
					complete:_onLoadMediaData,
					timeout:Config.jsonTimeout * 1000,
					headers: {
						"Accept-language":"fr"
					}
				});
			}
		}
	}
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getProgramTitle = function(id, callback){
	$.ajax({
		url: Config.perfectMemoryWS + "medias/"+id+"/annotations?media_predicate_id="+Config.predicate_id+"&auth_token=" + User.tokens.auth_token,
		complete:function(jqXHR, textStatus){
			if(textStatus === "success" && jqXHR.responseJSON){
				try{
					callback(jqXHR.responseJSON[0].subject.label);
				}catch(e){
					callback();
				}
			}
		},
		timeout:Config.jsonTimeout * 1000,
		headers: {
			"Accept-language":"fr"
		}
	});
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getMedia = function(id, callback_function){
	json.load({
        url: Config.perfectMemoryWS + "medias/"+id+"?auth_token=" + User.tokens.auth_token,
        callback: function(data) {
			console.log(data);

			if(typeOf(callback_function) === "function"){
				callback_function(data);
			}
        },
		headers: {
			"Accept-language":"fr"
		}
    });
};

/* @description Launches a request to get the config json of the environnement
 * @param {String} env The environnement
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.searchMedia = function(term, callback_function){
    json.load({
        url: Config.perfectMemoryWS + "medias/search?auth_token=" + User.tokens.auth_token,
		type:"post",
        callback: function(data) {
			console.log(data);

			if(typeOf(callback_function) === "function"){
				callback_function(data);
			}
        },
		headers: {
			"Accept-language":"fr"
		},
		data:JSON.stringify({"max_count":30,"offset":0,"filters":[],"sort_order":-1,"sort_fields":"created_at",value:term})
    });
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Launches a request to get the apps list
 * @param {String} url The WS url
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getAppsList = function(url, callback_function){
	if(json.cache["apps"]){
		callback_function(json.cache["apps"]);

	}else{
		json.load({url:url, callback:function(data, jqXhr){
			Model.getAppsList(data, jqXhr, callback_function);
		}});
	}
};

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Launches a request to get the submenu's data
 * @param {Array} urls A list of program's url
 * @param {Integer} appIndex The app position in apps list
 * @param {Function} callback_function The function which will be triggered after receiving data
 */

API.getAppPlaylistsOfUser = function(urls, appIndex, callback_function){
	/*if(json.cache["programs"] && json.cache["programs"].appIndex === appIndex){
		callback_function(json.cache["programs"]);

	}else{
		json.load({url:url, callback:function(data, jqXhr){
			Model.getAppPlaylistsOfUser(data, jqXhr, callback_function);
		}, dataType:"xml",contentType:"text/xml; charset=utf-8"});*/
		var def = this.getMultipleJSON(urls);
		$.when.apply($, def)
			.then(function(){
			Model.getAppPlaylistsOfUser(getWSResponseForMultipleRequests(arguments, urls.length), null, callback_function);
		}, function(){
			callback_function();
		});
	//}
};

																	/* **********************/
																	/*	 AUTRES FONCTIONS	*/
																	/* **********************/

/**
 * @author Johny EUGENE (DOTSCREEN)
 * @description Launches a request to get mutiple JSON
 * @param {Array} list Params's list for each request
 * @return {Array} list of jQuery Ajax object
 */

API.getMultipleJSON = function(list){
	$.Deferred();
    var deferreds = [];
    var i, l = list.length;
    for(i=0;i<l;i++){
		if(typeOf(list[i]) === "string"){
			deferreds.push($.ajax({
				url:list[i],
				timeout:Config.jsonTimeout * 1000
			}));
		}else{
			deferreds.push($.ajax(list[i]));
		}
    }

    return deferreds;
};