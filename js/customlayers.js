/* @preserve
 * Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
 * (c) 2010-2023 Vladimir Agafonkin, (c) 2010-2011 CloudMade
 *
 * Modified heavily by Wojtek Kaniewski.
 */

L.Control.CustomLayers = L.Control.extend({
  	// @section
  	// @aka Control.Layers options
  	options: {
  		// @option collapsed: Boolean = true
  		// If `true`, the control will be collapsed into an icon and expanded on mouse hover, touch, or keyboard activation.
  		collapsed: true,
  		position: 'topright',

  		// @option autoZIndex: Boolean = true
  		// If `true`, the control will assign zIndexes in increasing order to all of its layers so that the order is preserved when switching them on/off.
  		autoZIndex: true,

  		// @option hideSingleBase: Boolean = false
  		// If `true`, the base layers in the control will be hidden when there is only one.
  		hideSingleBase: false,

  		// @option sortLayers: Boolean = false
  		// Whether to sort the layers. When `false`, layers will keep the order
  		// in which they were added to the control.
  		sortLayers: false,

  		// @option sortFunction: Function = *
  		// A [compare function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
  		// that will be used for sorting the layers, when `sortLayers` is `true`.
  		// The function receives both the `L.Layer` instances and their names, as in
  		// `sortFunction(layerA, layerB, nameA, nameB)`.
  		// By default, it sorts layers alphabetically by their name.
  		sortFunction: function (layerA, layerB, nameA, nameB) {
  			return nameA < nameB ? -1 : (nameB < nameA ? 1 : 0);
  		}
  	},

  	initialize: function (overlays, options) {
  		L.setOptions(this, options);

  		this._layerControlChecks = [];
  		this._layerControlRadios = [];
  		this._layers = [];
  		this._lastZIndex = 0;
  		this._handlingClick = false;
  		this._preventClick = false;

  		for (i in overlays) {
  			this._addLayer(overlays[i].group, overlays[i].color, i);
  		}
  	},

  	onAdd: function (map) {
  		this._initLayout();
  		this._update();

  		this._map = map;

  		for (var i = 0; i < this._layers.length; i++) {
  			this._layers[i].layer.on('add remove', this._onLayerChange, this);
  		}

  		return this._container;
  	},

  	addTo: function (map) {
  		L.Control.prototype.addTo.call(this, map);
  		// Trigger expand after Layers Control has been inserted into DOM so that is now has an actual height.
  		return this._expandIfNotCollapsed();
  	},

  	onRemove: function () {
  		for (var i = 0; i < this._layers.length; i++) {
  			this._layers[i].layer.off('add remove', this._onLayerChange, this);
  		}
  	},

  	// @method removeLayer(layer: Layer): this
  	// Remove the given layer from the control.
  	removeLayer: function (layer) {
  		layer.off('add remove', this._onLayerChange, this);

  		var obj = this._getLayer(L.Util.stamp(layer));
  		if (obj) {
  			this._layers.splice(this._layers.indexOf(obj), 1);
  		}
  		return (this._map) ? this._update() : this;
  	},

  	// @method expand(): this
  	// Expand the control container if collapsed.
  	expand: function () {
  		L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
  		this._section.style.height = null;
  		var acceptableHeight = this._map.getSize().y - (this._container.offsetTop + 50);
  		if (acceptableHeight < this._section.clientHeight) {
  			L.DomUtil.addClass(this._section, 'leaflet-control-layers-scrollbar');
  			this._section.style.height = acceptableHeight + 'px';
  		} else {
  			L.DomUtil.removeClass(this._section, 'leaflet-control-layers-scrollbar');
  		}
  		return this;
  	},

  	// @method collapse(): this
  	// Collapse the control container if expanded.
  	collapse: function () {
  		L.DomUtil.removeClass(this._container, 'leaflet-control-layers-expanded');
  		return this;
  	},

  	_initLayout: function () {
  		var className = 'leaflet-control-layers',
  		    container = this._container = L.DomUtil.create('div', className),
  		    collapsed = this.options.collapsed;

  		// makes this work on IE touch devices by stopping it from firing a mouseout event when the touch is released
  		container.setAttribute('aria-haspopup', true);

  		L.DomEvent.disableClickPropagation(container);
  		L.DomEvent.disableScrollPropagation(container);

  		var section = this._section = L.DomUtil.create('section', className + '-list');

  		if (collapsed) {
  			this._map.on('click', this.collapse, this);

  			L.DomEvent.on(container, {
  				mouseenter: this._expandSafely,
  				mouseleave: this.collapse
  			}, this);
  		}

  		var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
  		link.href = '#';
  		link.title = 'Layers';
  		link.setAttribute('role', 'button');

  		L.DomEvent.on(link, {
  			keydown: function (e) {
  				if (e.keyCode === 13) {
  					this._expandSafely();
  				}
  			},
  			// Certain screen readers intercept the key event and instead send a click event
  			click: function (e) {
  				L.DomEvent.preventDefault(e);
  				this._expandSafely();
  			}
  		}, this);

  		if (!collapsed) {
  			this.expand();
  		}

  		this._overlaysList = L.DomUtil.create('div', className + '-overlays', section);

  		container.appendChild(section);
  	},

  	_getLayer: function (id) {
  		for (var i = 0; i < this._layers.length; i++) {

  			if (this._layers[i] && L.Util.stamp(this._layers[i].layer) === id) {
  				return this._layers[i];
  			}
  		}
  	},

  	_addLayer: function (layer, color, name) {
  		if (this._map) {
  			layer.on('add remove', this._onLayerChange, this);
  		}

  		this._layers.push({
  			layer: layer,
            color: color,
  			name: name
  		});

  		if (this.options.sortLayers) {
  			this._layers.sort(bind(function (a, b) {
  				return this.options.sortFunction(a.layer, b.layer, a.name, b.name);
  			}, this));
  		}

  		if (this.options.autoZIndex && layer.setZIndex) {
  			this._lastZIndex++;
  			layer.setZIndex(this._lastZIndex);
  		}

  		this._expandIfNotCollapsed();
  	},

  	_update: function () {
  		if (!this._container) { return this; }

  		L.DomUtil.empty(this._overlaysList);

  		this._layerControlChecks = [];
        this._layerControlRadios = [];
        this._layerControlAll = null;
  		var i, obj;

        var singleLayer = null;
        var singleLayerIdx = null;
        var allLayers = true;

  		for (i = 0; i < this._layers.length; i++) {
  			if (this._map.hasLayer(this._layers[i].layer)) {
                if (singleLayer === null) {
                    singleLayer = true;
                    singleLayerIdx = i;
                } else if (singleLayer === true) {
                    singleLayer = false;
                    singleLayerIdx = null;
                }
            } else {
                allLayers = false;
            }
  		}

  		for (i = 0; i < this._layers.length; i++) {
  			obj = this._layers[i];
  			this._addItem(obj, i === singleLayerIdx);
  		}

        this._addAll(allLayers);

  		return this;
  	},

  	_onLayerChange: function (e) {
  		if (!this._handlingClick) {
  			this._update();
  		}

  		var obj = this._getLayer(L.Util.stamp(e.target));

  		// @namespace Map
  		// @section Layer events
  		// @event overlayadd: LayersControlEvent
  		// Fired when an overlay is selected through the [layers control](#control-layers).
  		// @event overlayremove: LayersControlEvent
  		// Fired when an overlay is deselected through the [layers control](#control-layers).
  		// @namespace Control.Layers
  		var type = (e.type === 'add' ? 'overlayadd' : 'overlayremove');

  		if (type) {
  			this._map.fire(type, obj);
  		}
  	},

  	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see https://stackoverflow.com/a/119079)
  	_createRadioElement: function (name, checked) {

  		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' +
  				name + '"' + (checked ? ' checked="checked"' : '') + '/>';

  		var radioFragment = document.createElement('div');
  		radioFragment.innerHTML = radioHtml;

  		return radioFragment.firstChild;
  	},

  	_addItem: function (obj, isSingle) {
  		var label = document.createElement('label'),
  		    checked = this._map.hasLayer(obj.layer),
  		    inputRadio,
            inputCheck;

		inputRadio = this._createRadioElement('leaflet-base-layers_' + L.Util.stamp(this), isSingle);

  		this._layerControlRadios.push(inputRadio);
  		inputRadio.layerId = L.Util.stamp(obj.layer);

        L.DomEvent.on(inputRadio, 'click', this._onInputRadioClick, this);

        var tmp = L.Util.stamp(obj);
	    inputCheck = document.createElement('input');
        inputCheck.name = 'leaflet-base-layers_' + tmp;
  		inputCheck.type = 'checkbox';
  		inputCheck.className = 'leaflet-control-layers-selector';
  		inputCheck.defaultChecked = checked;

  		this._layerControlChecks.push(inputCheck);
  		inputCheck.layerId = L.Util.stamp(obj.layer);

  		L.DomEvent.on(inputCheck, 'click', this._onInputCheckClick, this);

  		var name = document.createElement('span');
        name.innerHTML = ' <div style="display: inline-block; vertical-align: middle; height: 1em; width: 1em; border: 1px solid black; background-color: ' + obj.color + ';">&nbsp;</div> ' + obj.name;

  		// Helps from preventing layer control flicker when checkboxes are disabled
  		// https://github.com/Leaflet/Leaflet/issues/2771
  		var holder = document.createElement('span');

        label.setAttribute("for", inputCheck.name);
  		label.appendChild(holder);
  		holder.appendChild(inputRadio);
  		holder.appendChild(inputCheck);
  		holder.appendChild(name);

  		this._overlaysList.appendChild(label);

  		return label;
  	},

  	_addAll: function (allLayers) {
  		var label = document.createElement('label'),
  		    inputRadio,
            inputCheck;

		inputRadio = this._createRadioElement('leaflet-base-layers_' + L.Util.stamp(this));
        inputRadio.disabled = true;

	    inputCheck = document.createElement('input');
  		inputCheck.type = 'checkbox';
  		inputCheck.className = 'leaflet-control-layers-selector';
  		inputCheck.defaultChecked = allLayers;
        inputCheck.disabled = allLayers;

  		this._layerControlAll = inputCheck;

  		L.DomEvent.on(inputCheck, 'click', this._onInputAllClick, this);

  		var name = document.createElement('span');
        name.innerHTML = ' <div style="display: inline-block; vertical-align: middle; height: 1em; width: 1em; padding: 1px;">&nbsp;</div> Wszystkie';

  		// Helps from preventing layer control flicker when checkboxes are disabled
  		// https://github.com/Leaflet/Leaflet/issues/2771
  		var holder = document.createElement('span');

  		label.appendChild(holder);
  		holder.appendChild(inputRadio);
  		holder.appendChild(inputCheck);
  		holder.appendChild(name);

  		this._overlaysList.appendChild(label);

  		return label;
  	},

  	_onInputCheckClick: function () {
  		// expanding the control on mobile with a click can cause adding a layer - we don't want this
  		if (this._preventClick) {
  			return;
  		}

  		var inputs = this._layerControlChecks,
  		    input, layer;
  		var addedLayers = [],
  		    removedLayers = [];

  		this._handlingClick = true;

        var singleLayer = null;
        var singleLayerIdx = null;
        var allLayers = true;

  		for (var i = inputs.length - 1; i >= 0; i--) {
  			input = inputs[i];
  			layer = this._getLayer(input.layerId).layer;

  			if (input.checked) {
                if (singleLayer === null) {
                    singleLayer = true;
                    singleLayerIdx = i;
                } else if (singleLayer === true) {
                    singleLayer = false;
                    singleLayerIdx = null;
                }
  				addedLayers.push(layer);
  			} else if (!input.checked) {
  				removedLayers.push(layer);
                allLayers = false;
  			}
  		}

        for (var i = this._layerControlRadios.length - 1; i >= 0; i--) {
            this._layerControlRadios[i].checked = (i === singleLayerIdx);
        }

  		// Bugfix issue 2318: Should remove all old layers before readding new ones
  		for (i = 0; i < removedLayers.length; i++) {
  			if (this._map.hasLayer(removedLayers[i])) {
  				this._map.removeLayer(removedLayers[i]);
  			}
  		}
  		for (i = 0; i < addedLayers.length; i++) {
  			if (!this._map.hasLayer(addedLayers[i])) {
  				this._map.addLayer(addedLayers[i]);
  			}
  		}

        this._layerControlAll.checked = allLayers;
        this._layerControlAll.disabled = allLayers;

  		this._handlingClick = false;

  		this._refocusOnMap();
  	},

  	_onInputRadioClick: function () {
  		// expanding the control on mobile with a click can cause adding a layer - we don't want this
  		if (this._preventClick) {
  			return;
  		}

  		var inputs = this._layerControlRadios,
  		    input, layer;
  		var addedLayers = [],
  		    removedLayers = [];

  		this._handlingClick = true;

  		for (var i = inputs.length - 1; i >= 0; i--) {
  			input = inputs[i];
  			layer = this._getLayer(input.layerId).layer;

            this._layerControlChecks[i].checked = input.checked;

  			if (input.checked) {
  				addedLayers.push(layer);
  			} else if (!input.checked) {
  				removedLayers.push(layer);
  			}
  		}

  		// Bugfix issue 2318: Should remove all old layers before readding new ones
  		for (i = 0; i < removedLayers.length; i++) {
  			if (this._map.hasLayer(removedLayers[i])) {
  				this._map.removeLayer(removedLayers[i]);
  			}
  		}
  		for (i = 0; i < addedLayers.length; i++) {
  			if (!this._map.hasLayer(addedLayers[i])) {
  				this._map.addLayer(addedLayers[i]);
  			}
  		}

        this._layerControlAll.checked = false;
        this._layerControlAll.disabled = false;

  		this._handlingClick = false;

  		this._refocusOnMap();
  	},

  	_onInputAllClick: function () {
        var inputs = this._layerControlChecks;
        for (var i = inputs.length - 1; i >= 0; i--)
            inputs[i].checked = true;
        inputs = this._layerControlRadios;
        for (var i = inputs.length - 1; i >= 0; i--)
            inputs[i].checked = false;
        this._onInputCheckClick();
    },

  	_expandIfNotCollapsed: function () {
  		if (this._map && !this.options.collapsed) {
  			this.expand();
  		}
  		return this;
  	},

  	_expandSafely: function () {
  		var section = this._section;
  		this._preventClick = true;
  		L.DomEvent.on(section, 'click', L.DomEvent.preventDefault);
  		this.expand();
  		var that = this;
  		setTimeout(function () {
  			L.DomEvent.off(section, 'click', L.DomEvent.preventDefault);
  			that._preventClick = false;
  		});
  	}

});

L.Control.customLayers = function (overlays, options) {
  	return new L.Control.CustomLayers(overlays, options);
};
